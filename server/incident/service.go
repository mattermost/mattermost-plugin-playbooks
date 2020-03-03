package incident

import (
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/pkg/errors"
)

// Incident
type Incident struct {
	ID string
}

type Service interface {
	// CreateIncident Creates a new incident.
	CreateIncident(incident *Incident) (*Incident, error)

	// GetIncident Gets an incident by ID.
	GetIncident(ID string) (*Incident, error)

	// GetAllIncidents Gets all incidents.
	GetAllIncidents() ([]Incident, error)
}

type ServiceImpl struct {
	store Store
}

var _ Service = &ServiceImpl{}

func NewService(api plugin.API, helpers plugin.Helpers) *ServiceImpl {
	return &ServiceImpl{
		store: NewStore(api, helpers),
	}
}

func (s *ServiceImpl) CreateIncident(incident *Incident) (*Incident, error) {
	return nil, errors.New("not implemented")
}

// GetIncident Gets an incident by ID.
func (s *ServiceImpl) GetIncident(ID string) (*Incident, error) {
	return nil, errors.New("not implemented")
}

// GetAllIncidents Gets all incidents
func (s *ServiceImpl) GetAllIncidents() ([]Incident, error) {
	return nil, errors.New("not implemented")
}
