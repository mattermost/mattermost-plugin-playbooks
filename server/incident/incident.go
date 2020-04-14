package incident

import "errors"

// Incident holds the detailed information of an incident.
type Incident struct {
	Header
	ChannelIDs         []string `json:"channel_ids"`
	PostID             string   `json:"post_id"`
	PlaybookInstanceID string   `json:"playbook_instance_id"`
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

// DialogState holds the start incident interactive dialog's state as it appears in the client
// and is submitted back to the server.
type DialogState struct {
	PostID   string `json:"post_id"`
	ClientID string `json:"client_id"`
}

// ErrNotFound used to indicate entity not found.
var ErrNotFound = errors.New("not found")

// ErrChannelDisplayNameLong is used to indicate a channel name is too long
var ErrChannelDisplayNameLong = errors.New("channel name is too long")

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

	// OpenCreateIncidentDialog opens an interactive dialog to start a new incident.
	OpenCreateIncidentDialog(commanderID, triggerID, postID, clientID string) error

	// EndIncident completes the incident with the given ID by the given user.
	EndIncident(incidentID string, userID string) error

	// OpenEndIncidentDialog opens a interactive dialog so the user can confirm an incident should
	// be ended.
	OpenEndIncidentDialog(incidentID string, triggerID string) error

	// GetIncident gets an incident by ID. Returns error if it could not be found.
	GetIncident(incidentID string) (*Incident, error)

	// GetIncidentIDForChannel get the incidentID associated with this channel. Returns an empty string
	// if there is no incident associated with this channel.
	GetIncidentIDForChannel(channelID string) string

	// IsCommander returns true if the userID is the commander for incidentID.
	IsCommander(incidentID string, userID string) bool

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
	GetIncident(incidentID string) (*Incident, error)

	// GetIncidentByChannel gets an incident associated with the given channel id.
	GetIncidentIDForChannel(channelID string) (string, error)

	// NukeDB removes all incident related data.
	NukeDB() error
}

// Telemetry defines the methods that the ServiceImpl needs from the RudderTelemetry.
type Telemetry interface {
	// CreateIncidenttracks the creation of a new incident.
	CreateIncident(incident *Incident)

	// EndIncident tracks the end of an incident.
	EndIncident(incident *Incident)
}
