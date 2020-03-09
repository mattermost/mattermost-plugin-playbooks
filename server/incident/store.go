package incident

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/pkg/errors"
)

const (
	allHeadersKey = "all_headers"
	incidentKey   = "incident_"
)

type idHeaderMap map[string]Header

// Store Incident store interface.
type Store interface {
	// GetAllHeaders Gets all the header information.
	GetAllHeaders() ([]Header, error)

	// CreateIncident Creates a new incident.
	CreateIncident(incident *Incident) (*Incident, error)

	// GetIncident Gets an incident by ID.
	GetIncident(ID string) (*Incident, error)

	// GetAllIncidents Gets all incidents
	GetAllIncidents() ([]Incident, error)
}

var _ Store = &StoreImpl{}

// StoreImpl Implements incident store interface.
type StoreImpl struct {
	pluginAPI *pluginapi.Client
	helpers   plugin.Helpers
}

// NewStore creates a new store for incident service.
func NewStore(pluginAPI *pluginapi.Client, helpers plugin.Helpers) *StoreImpl {
	newStore := &StoreImpl{
		pluginAPI: pluginAPI,
		helpers:   helpers,
	}
	return newStore
}

// GetAllHeaders Creates a new incident.
func (s *StoreImpl) GetAllHeaders() ([]Header, error) {
	headers := idHeaderMap{}
	if err := s.pluginAPI.KV.Get(allHeadersKey, &headers); err != nil {
		return nil, errors.Wrap(err, "failed to get all headers value")
	}

	return toHeader(headers), nil
}

// CreateIncident Creates a new incident.
func (s *StoreImpl) CreateIncident(incident *Incident) (*Incident, error) {
	if incident == nil {
		return nil, errors.New("incident is nil")
	}
	if incident.ID != "" {
		return nil, errors.New("ID should not bet set")
	}
	incident.ID = model.NewId()

	saved, err := s.pluginAPI.KV.Set(toIncidentKey(incident), incident)
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

func (s *StoreImpl) updateHeader(incident *Incident) error {
	headers := idHeaderMap{}
	if err := s.pluginAPI.KV.Get(allHeadersKey, &headers); err != nil {
		return errors.Wrap(err, "failed to get all headers value")
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

// GetIncident Gets an incident by ID.
func (s *StoreImpl) GetIncident(ID string) (*Incident, error) {
	return nil, errors.New("not implemented")
}

// GetAllIncidents Gets all incidents
func (s *StoreImpl) GetAllIncidents() ([]Incident, error) {
	return nil, errors.New("not implemented")
}

// toIncidentKey converts an incident to an internal key used to store in the KV Store.
func toIncidentKey(incident *Incident) string {
	return incidentKey + incident.ID
}

func toHeader(headers idHeaderMap) []Header {
	var result []Header
	for _, value := range headers {
		result = append(result, value)
	}

	return result
}
