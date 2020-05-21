package incident

import (
	"errors"

	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
)

// Incident holds the detailed information of an incident.
type Incident struct {
	Header
	ChannelIDs []string           `json:"channel_ids"`
	PostID     string             `json:"post_id"`
	Playbook   *playbook.Playbook `json:"playbook"`
}

// Header holds the summary information of an incident.
type Header struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	IsActive        bool   `json:"is_active"`
	CommanderUserID string `json:"commander_user_id"`
	TeamID          string `json:"team_id"`
	CreatedAt       int64  `json:"created_at"`
	EndedAt         int64  `json:"ended_at"`
}

// CommanderInfo holds the summary information of a commander.
type CommanderInfo struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

// DialogState holds the start incident interactive dialog's state as it appears in the client
// and is submitted back to the server.
type DialogState struct {
	PostID   string `json:"post_id"`
	ClientID string `json:"client_id"`
}

// ErrNotFound used to indicate entity not found.
var ErrNotFound = errors.New("not found")

// ErrChannelDisplayNameInvalid is used to indicate a channel name is too long.
var ErrChannelDisplayNameInvalid = errors.New("channel name is invalid or too long")

// ErrIncidentNotActive is used to indicate trying to run a command on an incident that has ended.
var ErrIncidentNotActive = errors.New("incident not active")

// Service is the incident/service interface.
type Service interface {
	// GetHeaders returns filtered headers.
	GetIncidents(options HeaderFilterOptions) ([]Incident, error)

	// CreateIncident creates a new incident.
	CreateIncident(incdnt *Incident) (*Incident, error)

	// OpenCreateIncidentDialog opens an interactive dialog to start a new incident.
	OpenCreateIncidentDialog(commanderID, triggerID, postID, clientID string, playbooks []playbook.Playbook) error

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

	// GetCommandersForTeam returns all the commanders of incidents in this team.
	GetCommandersForTeam(teamID string) ([]CommanderInfo, error)

	// IsCommander returns true if the userID is the commander for incidentID.
	IsCommander(incidentID string, userID string) bool

	// ChangeCommander processes a request from userID to change the commander for incidentID
	// to commanderID. Changing to the same commanderID is a no-op.
	ChangeCommander(incidentID string, userID string, commanderID string) error

	// ModifyCheckedState checks or unchecks the specified checklist item
	// Idempotent, will not perform any actions if the checklist item is already in the specified state
	ModifyCheckedState(incidentID, userID string, newState bool, checklistNumber int, itemNumber int) error

	// AddChecklistItem adds an item to the specified checklist
	AddChecklistItem(incidentID, userID string, checklistNumber int, checklistItem playbook.ChecklistItem) error

	// RemoveChecklistItem removes an item from the specified checklist
	RemoveChecklistItem(incidentID, userID string, checklistNumber int, itemNumber int) error

	// RenameChecklistItem changes the title of a specified checklist item
	RenameChecklistItem(incidentID, userID string, checklistNumber int, itemNumber int, newTitle string) error

	// MoveChecklistItem moves a checklist item from one position to anouther
	MoveChecklistItem(incidentID, userID string, checklistNumber int, itemNumber int, newLocation int) error

	// NukeDB removes all incident related data.
	NukeDB() error
}

// Store defines the methods the ServiceImpl needs from the interfaceStore.
type Store interface {
	// GetHeaders returns filtered incidents.
	GetIncidents(options HeaderFilterOptions) ([]Incident, error)

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

	// ModifyCheckedState tracks the checking and unchecking of items by the user
	// identified by userID in the incident identified by incidentID.
	ModifyCheckedState(incidentID, userID string, newState bool)

	// AddChecklistItem tracks the creation of a new checklist item by the user
	// identified by userID in the incident identified by incidentID.
	AddChecklistItem(incidentID, userID string)

	// RemoveChecklistItem tracks the removal of a checklist item by the user
	// identified by userID in the incident identified by incidentID.
	RemoveChecklistItem(incidentID, userID string)

	// RenameChecklistItem tracks the update of a checklist item by the user
	// identified by userID in the incident identified by incidentID.
	RenameChecklistItem(incidentID, userID string)

	// MoveChecklistItem tracks the uncheking of checked item by the user
	// identified by userID in the incident identified by incidentID.
	MoveChecklistItem(incidentID, userID string)
}
