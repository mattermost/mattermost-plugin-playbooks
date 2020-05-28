package pluginkvstore

import (
	"sort"
	"strings"
	"unicode"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

const (
	allHeadersKey  = "all_headers"
	incidentKey    = "incident_"
	perPageDefault = 1000
)

type idHeaderMap map[string]incident.Header

// Ensure incidentStore implements the incident.Store interface.
var _ incident.Store = (*incidentStore)(nil)

// incidentStore holds the information needed to fulfill the methods in the store interface.
type incidentStore struct {
	pluginAPI KVAPI
}

// NewIncidentStore creates a new store for incident ServiceImpl.
func NewIncidentStore(pluginAPI KVAPI) incident.Store {
	newStore := &incidentStore{
		pluginAPI: pluginAPI,
	}
	return newStore
}

// GetIncidents gets all the incidents, abiding by the filter options.
func (s *incidentStore) GetIncidents(options incident.HeaderFilterOptions) ([]incident.Incident, error) {
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

	return result, nil
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

	saved, err := s.pluginAPI.Set(toIncidentKey(incdnt.ID), incdnt)
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

	saved, err := s.pluginAPI.Set(toIncidentKey(incdnt.ID), incdnt)
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
		incdnt, err := s.getIncident(header.ID)
		if err != nil {
			return "", errors.Wrapf(err, "failed to get incident for id (%s)", header.ID)
		}

		for _, incidentChannelID := range incdnt.ChannelIDs {
			if incidentChannelID == channelID {
				return incdnt.ID, nil
			}
		}
	}
	return "", errors.Wrapf(incident.ErrNotFound, "channel with id (%s) does not have an incident", channelID)
}

// NukeDB removes all incident related data.
func (s *incidentStore) NukeDB() error {
	return s.pluginAPI.DeleteAll()
}

// toIncidentKey converts an incident to an internal key used to store in the KV Store.
func toIncidentKey(incidentID string) string {
	return incidentKey + incidentID
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
	if err := s.pluginAPI.Get(toIncidentKey(incidentID), &incdnt); err != nil {
		return nil, errors.Wrapf(err, "failed to get incident")
	}
	if incdnt.ID == "" {
		return nil, incident.ErrNotFound
	}
	return &incdnt, nil
}

func (s *incidentStore) getIDHeaders() (idHeaderMap, error) {
	headers := idHeaderMap{}
	if err := s.pluginAPI.Get(allHeadersKey, &headers); err != nil {
		return nil, errors.Wrapf(err, "failed to get all headers value")
	}
	return headers, nil
}

func (s *incidentStore) updateHeader(incdnt *incident.Incident) error {
	headers, err := s.getIDHeaders()
	if err != nil {
		return errors.Wrapf(err, "failed to get all headers")
	}

	headers[incdnt.ID] = incdnt.Header

	// TODO: Should be using CompareAndSet, but deep copy is expensive.
	if saved, err := s.pluginAPI.Set(allHeadersKey, headers); err != nil {
		return errors.Wrapf(err, "failed to set all headers value")
	} else if !saved {
		return errors.New("failed to set all headers value")
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
		sortFn = func(i, j int) bool { return orderFn(headers[i].Name > headers[j].Name) }
	case incident.CommanderUserID:
		sortFn = func(i, j int) bool { return orderFn(headers[i].CommanderUserID > headers[j].CommanderUserID) }
	case incident.TeamID:
		sortFn = func(i, j int) bool { return orderFn(headers[i].TeamID > headers[j].TeamID) }
	case incident.EndedAt:
		sortFn = func(i, j int) bool { return orderFn(headers[i].EndedAt > headers[j].EndedAt) }
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
