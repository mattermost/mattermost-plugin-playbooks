package pluginkvstore

import (
	"errors"
	"fmt"
	"sort"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
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

// GetAllHeaders gets all the header information.
func (s *incidentStore) GetIncidents(options incident.FilterOptions) ([]incident.Incident, error) {
	headersMap, err := s.getIDHeaders()
	if err != nil {
		return nil, fmt.Errorf("failed to get all headers value: %w", err)
	}

	headers := toHeaders(headersMap)
	var filtered []incident.Header

	for _, header := range headers {
		if headerMatchesFilter(header, options) {
			filtered = append(filtered, header)
		}
	}

	sortHeaders(filtered, options.Sort, options.Order)
	filtered = pageHeaders(filtered, options.Page, options.PerPage)

	var result []incident.Incident
	for _, header := range filtered {
		i, err := s.getIncident(header.ID)
		if err != nil {
			// odds are this should not happen, so default to failing fast
			return nil, fmt.Errorf("failed to get incident id '%s': %w", header.ID, err)
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

func headerMatchesFilter(header incident.Header, options incident.FilterOptions) bool {
	if options.TeamID != "" {
		return header.TeamID == options.TeamID
	}

	return true
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
