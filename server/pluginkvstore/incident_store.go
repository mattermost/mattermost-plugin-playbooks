package pluginkvstore

import (
	"fmt"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const (
	allHeadersKey = "all_headers"
	incidentKey   = "incident_"
)

type idHeaderMap map[string]incident.Header

// incidentStore Implements incident store interface.
var _ incident.Store = (*incidentStore)(nil)

// incidentStore holds the information needed to fulfill the methods in the store interface.
type incidentStore struct {
	pluginAPI *pluginapi.Client
}

// NewIncidentStore creates a new store for incident ServiceImpl.
func NewIncidentStore(pluginAPI *pluginapi.Client) incident.Store {
	newStore := &incidentStore{
		pluginAPI: pluginAPI,
	}
	return newStore
}

// GetAllHeaders Gets all the header information.
func (s *incidentStore) GetHeaders(options incident.HeaderFilterOptions) ([]incident.Header, error) {
	headersMap, err := s.getIDHeaders()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get all headers value")
	}

	headers := toHeader(headersMap)
	var result []incident.Header

	for _, header := range headers {
		if headerMatchesFilter(header, options) {
			result = append(result, header)
		}
	}

	return result, nil
}

// CreateIncident Creates a new incident.
func (s *incidentStore) CreateIncident(incident *incident.Incident) (*incident.Incident, error) {
	if incident == nil {
		return nil, errors.New("incident is nil")
	}
	if incident.ID != "" {
		return nil, errors.New("ID should not be set")
	}
	incident.ID = model.NewId()

	saved, err := s.pluginAPI.KV.Set(toIncidentKey(incident.ID), incident)
	if err != nil {
		return nil, errors.Wrap(err, "failed to store new incident")
	} else if !saved {
		return nil, errors.New("failed to store new incident")
	}

	// Update Headers
	if err := s.updateHeader(incident); err != nil {
		return nil, errors.Wrap(err, "failed to update headers")
	}

	return incident, nil
}

// UpdateIncident updates an incident.
func (s *incidentStore) UpdateIncident(incident *incident.Incident) error {
	if incident == nil {
		return errors.New("incident is nil")
	}
	if incident.ID == "" {
		return errors.New("ID should be set")
	}

	headers, err := s.getIDHeaders()
	if err != nil {
		return errors.Wrap(err, "failed to get all headers value")
	}

	if _, exists := headers[incident.ID]; !exists {
		return errors.Errorf("incident with id (%s) does not exist", incident.ID)
	}

	saved, err := s.pluginAPI.KV.Set(toIncidentKey(incident.ID), incident)
	if err != nil {
		return errors.Wrap(err, "failed to update incident")
	} else if !saved {
		return errors.New("failed to update incident")
	}

	// Update Headers
	if err := s.updateHeader(incident); err != nil {
		return errors.Wrap(err, "failed to update headers")
	}

	return nil
}

// GetIncident Gets an incident by ID.
func (s *incidentStore) GetIncident(id string) (*incident.Incident, error) {
	headers, err := s.getIDHeaders()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get all headers value")
	}

	if _, exists := headers[id]; !exists {
		return nil, errors.Errorf("%w: incident with id (%s) does not exist", incident.ErrNotFound, id)
	}

	return s.getIncident(id)
}

// GetIncidentByChannel Gets an incident associated to the given channel id.
func (s *incidentStore) GetIncidentByChannel(channelID string, active bool) (*incident.Incident, error) {
	headers, err := s.getIDHeaders()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get all headers value")
	}

	// Search for which incident has the given channel associated
	for _, header := range headers {
		inc, err := s.getIncident(header.ID)
		if err != nil {
			return nil, errors.Errorf("failed to get incident for id (%s): %w", header.ID, err)
		}

		for _, incidentChannelID := range inc.ChannelIDs {
			if incidentChannelID == channelID {
				return inc, nil
			}
		}
	}
	return nil, errors.Errorf("channel with id (%s) does not have an incident: %w", channelID, incident.ErrNotFound)
}

// NukeDB Removes all incident related data.
func (s *incidentStore) NukeDB() error {
	return s.pluginAPI.KV.DeleteAll()
}

// toIncidentKey converts an incident to an internal key used to store in the KV Store.
func toIncidentKey(incidentID string) string {
	return incidentKey + incidentID
}

func toHeader(headers idHeaderMap) []incident.Header {
	var result []incident.Header
	for _, value := range headers {
		result = append(result, value)
	}

	return result
}

func (s *incidentStore) getIncident(incidentID string) (*incident.Incident, error) {
	var inc incident.Incident
	if err := s.pluginAPI.KV.Get(toIncidentKey(incidentID), &inc); err != nil {
		return nil, fmt.Errorf("failed to get incident: %w", err)
	}
	if inc.ID == "" {
		return nil, incident.ErrNotFound
	}
	return &inc, nil
}

func (s *incidentStore) getIDHeaders() (idHeaderMap, error) {
	headers := idHeaderMap{}
	if err := s.pluginAPI.KV.Get(allHeadersKey, &headers); err != nil {
		return nil, errors.Wrap(err, "failed to get all headers value")
	}
	return headers, nil
}

func (s *incidentStore) updateHeader(incident *incident.Incident) error {
	headers, err := s.getIDHeaders()
	if err != nil {
		return errors.Wrap(err, "failed to get all headers")
	}

	headers[incident.ID] = incident.Header

	// TODO: Should be using CompareAndSet, but deep copy is expensive.
	if saved, err := s.pluginAPI.KV.Set(allHeadersKey, headers); err != nil {
		return errors.Wrap(err, "failed to set all headers value")
	} else if !saved {
		return errors.New("failed to set all headers value")
	}

	return nil
}

func headerMatchesFilter(header incident.Header, options incident.HeaderFilterOptions) bool {
	if options.TeamID != "" {
		return header.TeamID == options.TeamID
	}

	return true
}
