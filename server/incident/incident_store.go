package incident

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const (
	allHeadersKey = "all_headers"
	incidentKey   = "incident_"
)

type idHeaderMap map[string]Header

// incidentStore Implements incident store interface.
var _ Store = (*incidentStore)(nil)

// incidentStore holds the information needed to fulfill the methods in the store interface.
type incidentStore struct {
	pluginAPI *pluginapi.Client
}

// NewStore creates a new store for incident ServiceImpl.
func NewStore(pluginAPI *pluginapi.Client) Store {
	newStore := &incidentStore{
		pluginAPI: pluginAPI,
	}
	return newStore
}

// GetAllHeaders Gets all the header information.
func (s *incidentStore) GetHeaders(options HeaderFilterOptions) ([]Header, error) {
	headersMap, err := s.getIDHeaders()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get all headers value")
	}

	headers := toHeader(headersMap)
	var result []Header

	for _, header := range headers {
		if headerMatchesFilter(header, options) {
			result = append(result, header)
		}
	}

	return result, nil
}

// CreateIncident Creates a new incident.
func (s *incidentStore) CreateIncident(incident *Incident) (*Incident, error) {
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
func (s *incidentStore) UpdateIncident(incident *Incident) error {
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
func (s *incidentStore) GetIncident(id string) (*Incident, error) {
	headers, err := s.getIDHeaders()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get all headers value")
	}

	if _, exists := headers[id]; !exists {
		return nil, errors.Errorf("incident with id (%s) does not exist", id)
	}

	return s.getIncident(id)
}

// GetIncidentByChannel Gets an incident associated to the given channel id.
func (s *incidentStore) GetIncidentByChannel(channelID string, active bool) (*Incident, error) {
	headers, err := s.getIDHeaders()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get all headers value")
	}

	// Search for which incident has the given channel associated
	for _, header := range headers {
		if header.IsActive != active {
			continue
		}

		incident, err := s.getIncident(header.ID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get incident for channel")
		}

		for _, incidentChannelID := range incident.ChannelIDs {
			if incidentChannelID == channelID {

				return incident, nil
			}
		}
	}
	return nil, errors.Wrapf(ErrNotFound, "channel with id (%s) does not have incidents", channelID)
}

// NukeDB Removes all incident related data.
func (s *incidentStore) NukeDB() error {
	return s.pluginAPI.KV.DeleteAll()
}

// toIncidentKey converts an incident to an internal key used to store in the KV Store.
func toIncidentKey(incidentID string) string {
	return incidentKey + incidentID
}

func toHeader(headers idHeaderMap) []Header {
	var result []Header
	for _, value := range headers {
		result = append(result, value)
	}

	return result
}

func (s *incidentStore) getIncident(incidentID string) (*Incident, error) {
	var incident Incident
	if err := s.pluginAPI.KV.Get(toIncidentKey(incidentID), &incident); err != nil {
		return nil, errors.Wrap(err, "failed to get incident")
	}
	return &incident, nil
}

func (s *incidentStore) getIDHeaders() (idHeaderMap, error) {
	headers := idHeaderMap{}
	if err := s.pluginAPI.KV.Get(allHeadersKey, &headers); err != nil {
		return nil, errors.Wrap(err, "failed to get all headers value")
	}
	return headers, nil
}

func (s *incidentStore) updateHeader(incident *Incident) error {
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

func headerMatchesFilter(header Header, options HeaderFilterOptions) bool {
	if options.TeamID != "" {
		return header.TeamID == options.TeamID
	}

	return true
}
