package incident

import "github.com/pkg/errors"

// ErrNotFound used to indicate entity not found.
var ErrNotFound = errors.New("not found")

// State Incident state.
type State int

const (
	// Open When an incident is open.
	Open State = iota + 1

	// Closed When an incident is closed.
	Closed State = 2
)

// Header struct holds basic information about an incident.
type Header struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	State           State  `json:"state"`
	CommanderUserID string `json:"commander_user_id"`
}

// Incident struct
type Incident struct {
	Header
	Type string
}

// Service Incident service interface.
type Service interface {
	// GetAllHeaders Gets all the header information.
	GetAllHeaders() ([]Header, error)

	// CreateIncident Creates a new incident.
	CreateIncident(incident *Incident) (*Incident, error)

	// GetIncident Gets an incident by ID.
	GetIncident(ID string) (*Incident, error)

	// GetAllIncidents Gets all incidents.
	GetAllIncidents() ([]Incident, error)
}
