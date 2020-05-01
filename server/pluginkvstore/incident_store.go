package pluginkvstore

import (
	"errors"
	"fmt"
	"sort"

	"github.com/lithammer/fuzzysearch/fuzzy"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	allHeadersKey  = "all_headers"
	incidentKey    = "incident_"
	perPageDefault = 1000
)

type idHeaderMap map[string]incident.Header

// Ensure incidentStore implements the playbook.Store interface.
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

// GetAllHeaders gets all the header information.
func (s *incidentStore) GetHeaders(options incident.HeaderFilterOptions) ([]incident.Header, error) {
	headersMap, err := s.getIDHeaders()
	if err != nil {
		return nil, fmt.Errorf("failed to get all headers value: %w", err)
	}

	// Build the filters we need to apply
	var headerFilters []incident.HeaderFilter
	if options.TeamID != "" {
		headerFilters = append(headerFilters, incident.TeamHeaderFilter(options.TeamID))
	}
	if options.Active {
		headerFilters = append(headerFilters, incident.ActiveFilter())
	}
	if options.CommanderID != "" {
		headerFilters = append(headerFilters, incident.CommanderFilter(options.CommanderID))
	}

	headers := toHeaders(headersMap)
	var result []incident.Header

	for _, header := range headers {
		if incident.HeaderMatchesFilters(header, headerFilters...) {
			result = append(result, header)
		}
	}

	// We cannot satisfy both Sort/OrderBy and a search term (which returns results ordered by relevance)
	if options.Search != "" {
		result = searchHeaders(options.Search, result)
	} else {
		sortHeaders(result, options.Sort, options.OrderBy)
	}
	result = pageHeaders(result, options.Page, options.PerPage)

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
		return nil, fmt.Errorf("failed to store new incident: %w", err)
	} else if !saved {
		return nil, errors.New("failed to store new incident")
	}

	// Update Headers
	if err := s.updateHeader(incdnt); err != nil {
		return nil, fmt.Errorf("failed to update headers: %w", err)
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
		return fmt.Errorf("failed to get all headers value: %w", err)
	}

	if _, exists := headers[incdnt.ID]; !exists {
		return fmt.Errorf("incident with id (%s) does not exist", incdnt.ID)
	}

	saved, err := s.pluginAPI.Set(toIncidentKey(incdnt.ID), incdnt)
	if err != nil {
		return fmt.Errorf("failed to update incident: %w", err)
	} else if !saved {
		return errors.New("failed to update incident")
	}

	// Update Headers
	if err := s.updateHeader(incdnt); err != nil {
		return fmt.Errorf("failed to update headers: %w", err)
	}

	return nil
}

// GetIncident gets an incident by ID.
func (s *incidentStore) GetIncident(incidentID string) (*incident.Incident, error) {
	headers, err := s.getIDHeaders()
	if err != nil {
		return nil, fmt.Errorf("failed to get all headers value: %w", err)
	}

	if _, exists := headers[incidentID]; !exists {
		return nil, fmt.Errorf("incident with id (%s) does not exist: %w", incidentID, incident.ErrNotFound)
	}

	return s.getIncident(incidentID)
}

// GetIncidentIDForChannel gets an incident associated to the given channel id.
func (s *incidentStore) GetIncidentIDForChannel(channelID string) (string, error) {
	headers, err := s.getIDHeaders()
	if err != nil {
		return "", fmt.Errorf("failed to get all headers value: %w", err)
	}

	// Search for which incident has the given channel associated
	for _, header := range headers {
		incdnt, err := s.getIncident(header.ID)
		if err != nil {
			return "", fmt.Errorf("failed to get incident for id (%s): %w", header.ID, err)
		}

		for _, incidentChannelID := range incdnt.ChannelIDs {
			if incidentChannelID == channelID {
				return incdnt.ID, nil
			}
		}
	}
	return "", fmt.Errorf("channel with id (%s) does not have an incident: %w", channelID, incident.ErrNotFound)
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
		return nil, fmt.Errorf("failed to get incident: %w", err)
	}
	if incdnt.ID == "" {
		return nil, incident.ErrNotFound
	}
	return &incdnt, nil
}

func (s *incidentStore) getIDHeaders() (idHeaderMap, error) {
	headers := idHeaderMap{}
	if err := s.pluginAPI.Get(allHeadersKey, &headers); err != nil {
		return nil, fmt.Errorf("failed to get all headers value: %w", err)
	}
	return headers, nil
}

func (s *incidentStore) updateHeader(incdnt *incident.Incident) error {
	headers, err := s.getIDHeaders()
	if err != nil {
		return fmt.Errorf("failed to get all headers: %w", err)
	}

	headers[incdnt.ID] = incdnt.Header

	// TODO: Should be using CompareAndSet, but deep copy is expensive.
	if saved, err := s.pluginAPI.Set(allHeadersKey, headers); err != nil {
		return fmt.Errorf("failed to set all headers value: %w", err)
	} else if !saved {
		return errors.New("failed to set all headers value")
	}

	return nil
}

// sortHeaders defaults to sorting by "created_at", descending.
func sortHeaders(headers []incident.Header, field string, orderBy incident.OrderByOption) {
	var orderFn = func(b bool) bool { return b }
	if orderBy == incident.Asc {
		orderFn = func(b bool) bool { return !b }
	}

	var sortFn = func(i, j int) bool { return orderFn(headers[i].CreatedAt > headers[j].CreatedAt) }
	switch field {
	case "id":
		sortFn = func(i, j int) bool { return orderFn(headers[i].ID > headers[j].ID) }
	case "name":
		sortFn = func(i, j int) bool { return orderFn(headers[i].Name > headers[j].Name) }
	case "commander_user_id":
		sortFn = func(i, j int) bool { return orderFn(headers[i].CommanderUserID > headers[j].CommanderUserID) }
	case "team_id":
		sortFn = func(i, j int) bool { return orderFn(headers[i].TeamID > headers[j].TeamID) }
	case "ended_at":
		sortFn = func(i, j int) bool { return orderFn(headers[i].EndedAt > headers[j].EndedAt) }
	}

	sort.Slice(headers, sortFn)
}

func pageHeaders(headers []incident.Header, page int, perPage int) []incident.Header {
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

func searchHeaders(term string, headers []incident.Header) []incident.Header {
	var searchableFields []string
	for _, h := range headers {
		searchableFields = append(searchableFields, h.Name)
	}

	ranks := fuzzy.RankFind(term, searchableFields)

	var results []incident.Header
	for _, r := range ranks {
		results = append(results, headers[r.OriginalIndex])
	}

	return results
}
