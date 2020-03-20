package incident

import "github.com/pkg/errors"

// ErrNotFound used to indicate entity not found.
var ErrNotFound = errors.New("not found")

// Header holds the summary information of an incident.
type Header struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	IsActive        bool   `json:"is_active"`
	CommanderUserID string `json:"commander_user_id"`
	TeamID          string `json:"team_id"`
}

// Incident holds the detailed information of an incident.
type Incident struct {
	Header
	ChannelIDs []string `json:"channel_ids"`
}

// Service is the incident/Service interface.
type Service interface {
	// GetAllHeaders Gets all the header information.
	GetAllHeaders() ([]Header, error)

	// CreateIncident Creates a new incident.
	CreateIncident(incident *Incident) (*Incident, error)

	// EndIncident Completes the incident associated with the given channelId.
	EndIncident(channelID string) (*Incident, error)

	// GetIncident Gets an incident by ID.
	GetIncident(id string) (*Incident, error)

	// NukeDB Removes all incident related data.
	NukeDB() error
}

// Store Incident store interface.
type Store interface {
	// GetAllHeaders Gets all the header information.
	GetAllHeaders() ([]Header, error)

	// CreateIncident Creates a new incident.
	CreateIncident(incident *Incident) (*Incident, error)

	// UpdateIncident Creates a new incident.
	UpdateIncident(incident *Incident) error

	// GetIncident Gets an incident by ID.
	GetIncident(id string) (*Incident, error)

	// GetIncidentByChannel Gets an incident associated to the given channel id.
	GetIncidentByChannel(channelID string, active bool) (*Incident, error)

	// NukeDB Removes all incident related data.
	NukeDB() error
}
