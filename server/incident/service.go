package incident

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/pkg/errors"
)

// ServiceImpl implements Incident service interface.
type ServiceImpl struct {
	pluginAPI *pluginapi.Client
	store     Store
}

var _ Service = &ServiceImpl{}

// NewService Creates a new incident service.
func NewService(pluginAPI *pluginapi.Client, helpers plugin.Helpers) *ServiceImpl {
	return &ServiceImpl{
		pluginAPI: pluginAPI,
		store:     NewStore(pluginAPI, helpers),
	}
}

// GetAllHeaders Creates a new incident.
func (s *ServiceImpl) GetAllHeaders() ([]Header, error) {
	return s.store.GetAllHeaders()
}

// CreateIncident Creates a new incident.
func (s *ServiceImpl) CreateIncident(incident *Incident) (*Incident, error) {
	return s.store.CreateIncident(incident)
}

// GetIncident Gets an incident by ID.
func (s *ServiceImpl) GetIncident(ID string) (*Incident, error) {
	return nil, errors.New("not implemented")
}

// GetAllIncidents Gets all incidents
func (s *ServiceImpl) GetAllIncidents() ([]Incident, error) {
	return nil, errors.New("not implemented")
}
