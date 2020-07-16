package pluginkvstore

import (
	"encoding/json"
	"sort"
	"strings"
	"unicode"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

const (
	// IncidentKey is the key for individual incidents. Only exported for testing.
	IncidentKey = keyVersionPrefix + "incident_"
	// IncidentHeadersKey is the key for the incident headers index. Only exported for testing.
	IncidentHeadersKey = keyVersionPrefix + "all_headers"
	perPageDefault     = 1000
)

type idHeaderMap map[string]incident.Header

func (i idHeaderMap) clone() idHeaderMap {
	newMap := make(idHeaderMap, len(i))
	for k, v := range i {
		newMap[k] = v
	}
	return newMap
}

// Ensure incidentStore implements the incident.Store interface.
var _ incident.Store = (*incidentStore)(nil)

// incidentStore holds the information needed to fulfill the methods in the store interface.
type incidentStore struct {
	pluginAPI    PluginAPIClient
	log          bot.Logger
	queryBuilder sq.StatementBuilderType
}

// NewIncidentStore creates a new store for incident ServiceImpl.
func NewIncidentStore(pluginAPI PluginAPIClient, log bot.Logger) incident.Store {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if pluginAPI.Store.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	newStore := &incidentStore{
		pluginAPI:    pluginAPI,
		log:          log,
		queryBuilder: builder,
	}
	return newStore
}

// GetIncidents gets all the incidents, abiding by the filter options, and the total count before paging.
func (s *incidentStore) GetIncidents(options incident.HeaderFilterOptions) (*incident.GetIncidentsResults, error) {
	headersMap, err := s.getIDHeaders()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get all headers value")
	}

	headers := toHeaders(headersMap)
	var filtered []incident.Header

	for _, header := range headers {
		if headerMatchesFilters(header, options) {
			filtered = append(filtered, header)
		}
	}

	// First satisfy Sort/Order, then filter by search term if available. This works because the
	// search does not rank based on relevance; it is essentially a search filter.
	sortHeaders(filtered, options.Sort, options.Order)
	if options.SearchTerm != "" {
		filtered = searchHeaders(filtered, options.SearchTerm)
	}

	totalCount := len(filtered)
	filtered = pageHeaders(filtered, options.Page, options.PerPage)

	var result []incident.Incident
	for _, header := range filtered {
		i, err := s.getIncident(header.ID)
		if err != nil {
			// odds are this should not happen, so default to failing fast
			return nil, errors.Wrapf(err, "failed to get incident id '%s'", header.ID)
		}
		result = append(result, *i)
	}

	return &incident.GetIncidentsResults{
		Incidents:  result,
		TotalCount: totalCount,
	}, nil
}

// CreateIncident creates a new incident.
func (s *incidentStore) CreateIncident(incdnt *incident.Incident) (*incident.Incident, error) {
	if incdnt == nil {
		return nil, errors.New("incident is nil")
	}
	if incdnt.ID != "" {
		return nil, errors.New("ID should not be set")
	}
	incdnt.ID = model.NewId()

	saved, err := s.pluginAPI.KV.Set(toIncidentKey(incdnt.ID), incdnt)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to store new incident")
	} else if !saved {
		return nil, errors.New("failed to store new incident")
	}

	// Update Headers
	if err := s.updateHeader(incdnt); err != nil {
		return nil, errors.Wrapf(err, "failed to update headers")
	}

	return incdnt, nil
}

// UpdateIncident updates an incident.
func (s *incidentStore) UpdateIncident(incdnt *incident.Incident) error {
	if incdnt == nil {
		return errors.New("incident is nil")
	}
	if incdnt.ID == "" {
		return errors.New("ID should be set")
	}

	headers, err := s.getIDHeaders()
	if err != nil {
		return errors.Wrapf(err, "failed to get all headers value")
	}

	if _, exists := headers[incdnt.ID]; !exists {
		return errors.Wrapf(err, "incident with id (%s) does not exist", incdnt.ID)
	}

	saved, err := s.pluginAPI.KV.Set(toIncidentKey(incdnt.ID), incdnt)
	if err != nil {
		return errors.Wrapf(err, "failed to update incident")
	} else if !saved {
		return errors.New("failed to update incident")
	}

	// Update Headers
	if err := s.updateHeader(incdnt); err != nil {
		return errors.Wrapf(err, "failed to update headers")
	}

	return nil
}

// GetIncident gets an incident by ID.
func (s *incidentStore) GetIncident(incidentID string) (*incident.Incident, error) {
	headers, err := s.getIDHeaders()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get all headers value")
	}

	if _, exists := headers[incidentID]; !exists {
		return nil, errors.Wrapf(incident.ErrNotFound, "incident with id (%s) does not exist", incidentID)
	}

	return s.getIncident(incidentID)
}

// GetIncidentIDForChannel gets an incident associated to the given channel id.
func (s *incidentStore) GetIncidentIDForChannel(channelID string) (string, error) {
	headers, err := s.getIDHeaders()
	if err != nil {
		return "", errors.Wrapf(err, "failed to get all headers value")
	}

	// Search for which incident has the given channel associated
	for _, header := range headers {
		if header.PrimaryChannelID == channelID {
			return header.ID, nil
		}
	}
	return "", errors.Wrapf(incident.ErrNotFound, "channel with id (%s) does not have an incident", channelID)
}

// GetAllIncidentMembersCount returns the count of all members of an incident since the
// beginning of the incident, excluding bots.
func (s *incidentStore) GetAllIncidentMembersCount(incidentID string) (int64, error) {
	db, err := s.pluginAPI.Store.GetMasterDB()
	if err != nil {
		return 0, errors.Wrap(err, "failed to get a database connection")
	}

	query := s.queryBuilder.
		Select("COUNT(DISTINCT UserId)").
		From("ChannelMemberHistory AS u").
		Where(sq.Eq{"ChannelId": incidentID}).
		Where(sq.Expr("u.UserId NOT IN (SELECT UserId FROM Bots)"))

	queryStr, queryArgs, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "failed to build the query to retrieve all members in an incident")
	}

	var numMembers int64
	err = db.QueryRow(queryStr, queryArgs...).Scan(&numMembers)
	if err != nil {
		return 0, errors.Wrap(err, "failed to query database")
	}

	return numMembers, nil
}

// NukeDB removes all incident related data.
func (s *incidentStore) NukeDB() error {
	return s.pluginAPI.KV.DeleteAll()
}

// toIncidentKey converts an incident to an internal key used to store in the KV Store.
func toIncidentKey(incidentID string) string {
	return IncidentKey + incidentID
}

func toHeaders(headers idHeaderMap) []incident.Header {
	var result []incident.Header
	for _, value := range headers {
		result = append(result, value)
	}

	return result
}

func (s *incidentStore) getIncident(incidentID string) (*incident.Incident, error) {
	var incdnt incident.Incident
	if err := s.pluginAPI.KV.Get(toIncidentKey(incidentID), &incdnt); err != nil {
		return nil, errors.Wrapf(err, "failed to get incident")
	}
	if incdnt.ID == "" {
		return nil, incident.ErrNotFound
	}
	return &incdnt, nil
}

func (s *incidentStore) getIDHeaders() (idHeaderMap, error) {
	headers := idHeaderMap{}
	if err := s.pluginAPI.KV.Get(IncidentHeadersKey, &headers); err != nil {
		return nil, errors.Wrapf(err, "failed to get all headers value")
	}
	return headers, nil
}

func (s *incidentStore) updateHeader(incdnt *incident.Incident) error {
	addID := func(oldValue []byte) (interface{}, error) {
		if oldValue == nil {
			return idHeaderMap{incdnt.ID: incdnt.Header}, nil
		}

		var headers idHeaderMap
		if err := json.Unmarshal(oldValue, &headers); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal oldValue into an idHeaderMap")
		}

		newHeaders := headers.clone()
		newHeaders[incdnt.ID] = incdnt.Header
		return newHeaders, nil
	}

	if err := s.pluginAPI.KV.SetAtomicWithRetries(IncidentHeadersKey, addID); err != nil {
		return errors.Wrap(err, "failed to set allHeaders atomically")
	}
	return nil
}

func sortHeaders(headers []incident.Header, sortField incident.SortField, order incident.SortDirection) {
	// order by descending, unless we're told otherwise
	var orderFn = func(b bool) bool { return b }
	if order == incident.Asc {
		orderFn = func(b bool) bool { return !b }
	}

	// sort by CreatedAt, unless we're told otherwise
	var sortFn = func(i, j int) bool { return orderFn(headers[i].CreatedAt > headers[j].CreatedAt) }
	switch sortField {
	case incident.ID:
		sortFn = func(i, j int) bool { return orderFn(headers[i].ID > headers[j].ID) }
	case incident.Name:
		sortFn = func(i, j int) bool {
			return orderFn(strings.ToLower(headers[i].Name) > strings.ToLower(headers[j].Name))
		}
	case incident.CommanderUserID:
		sortFn = func(i, j int) bool { return orderFn(headers[i].CommanderUserID > headers[j].CommanderUserID) }
	case incident.TeamID:
		sortFn = func(i, j int) bool { return orderFn(headers[i].TeamID > headers[j].TeamID) }
	case incident.EndedAt:
		sortFn = func(i, j int) bool { return orderFn(headers[i].EndedAt > headers[j].EndedAt) }
	case incident.ByStatus:
		sortFn = func(i, j int) bool { return orderFn(headers[i].IsActive && !headers[j].IsActive) }
	}

	sort.Slice(headers, sortFn)
}

func pageHeaders(headers []incident.Header, page, perPage int) []incident.Header {
	if perPage == 0 {
		perPage = perPageDefault
	}

	// Note: ignoring overflow for now
	start := min(page*perPage, len(headers))
	end := min(start+perPage, len(headers))
	return headers[start:end]
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func headerMatchesFilters(header incident.Header, options incident.HeaderFilterOptions) bool {
	if options.TeamID != "" && header.TeamID != options.TeamID {
		return false
	}
	if options.Status != incident.All {
		if options.Status == incident.Ongoing && !header.IsActive {
			return false
		}
		if options.Status == incident.Ended && header.IsActive {
			return false
		}
	}
	if options.CommanderID != "" && header.CommanderUserID != options.CommanderID {
		return false
	}

	if options.HasPermissionsTo != nil && !options.HasPermissionsTo(header.PrimaryChannelID) {
		return false
	}

	return true
}

// searchHeaders filters headers (maintaining order) based on the search term. For now, we are
// defining a search "hit" as: the incident name includes the term in its entirety,
// case-insensitive and unicode normalized.
func searchHeaders(headers []incident.Header, term string) []incident.Header {
	term = normalize(term)
	var results []incident.Header
	for _, h := range headers {
		if strings.Contains(normalize(h.Name), term) {
			results = append(results, h)
		}
	}
	return results
}

// normalize removes unicode marks and lowercases text
func normalize(s string) string {
	// create a transformer, from NFC to NFD, removes non-spacing unicode marks, then back to NFC
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	normed, _, _ := transform.String(t, strings.ToLower(s))
	return normed
}
