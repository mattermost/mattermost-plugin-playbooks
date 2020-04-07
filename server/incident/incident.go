package incident

import "errors"

// Incident holds the detailed information of an incident.
type Incident struct {
	Header
	ChannelIDs []string `json:"channel_ids"`
	PostID     string   `json:"post_id"`
}

// Header holds the summary information of an incident.
type Header struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	IsActive        bool   `json:"is_active"`
	CommanderUserID string `json:"commander_user_id"`
	TeamID          string `json:"team_id"`
	CreatedAt       int64  `json:"created_at"`
}

// ErrNotFound used to indicate entity not found.
var ErrNotFound = errors.New("not found")

// ErrChannelExists is used to indicate a channel with that name already exists.
var ErrChannelExists = errors.New("channel exists")

// ErrIncidentNotActive is used to indicate trying to run a command on an incident that has ended.
var ErrIncidentNotActive = errors.New("incident not active")

// HeaderFilterOptions specifies the optional parameters when getting headers.
type HeaderFilterOptions struct {
	// Gets all the headers with this TeamID.
	TeamID string
}

// Service is the incident/service interface.
type Service interface {
	// GetHeaders returns filtered headers.
	GetHeaders(options HeaderFilterOptions) ([]Header, error)

	// CreateIncident creates a new incident.
	CreateIncident(incdnt *Incident) (*Incident, error)

	// CreateIncidentDialog opens an interactive dialog to start a new incident.
	CreateIncidentDialog(commanderID string, triggerID string, postID string, clientID string) error

	// EndIncident completes the incident with the given ID by the given user.
	EndIncident(incidentID string, userID string) error

	// EndIncident completes the incident associated to the given channelID by the given user.
	EndIncidentByChannel(channelID string, userID string) error

	// GetIncident gets an incident by ID.
	GetIncident(id string) (*Incident, error)

	// NukeDB removes all incident related data.
	NukeDB() error
}

// Store defines the methods the ServiceImpl needs from the interfaceStore.
type Store interface {
	// GetHeaders returns filtered headers.
	GetHeaders(options HeaderFilterOptions) ([]Header, error)

	// CreateIncident creates a new incident.
	CreateIncident(incdnt *Incident) (*Incident, error)

	// UpdateIncident updates an incident.
	UpdateIncident(incdnt *Incident) error

	// GetIncident gets an incident by ID.
	GetIncident(id string) (*Incident, error)

	// GetIncidentByChannel gets an incident associated with the given channel id.
	GetIncidentIDForChannel(channelID string) (string, error)

	// NukeDB removes all incident related data.
	NukeDB() error
}
