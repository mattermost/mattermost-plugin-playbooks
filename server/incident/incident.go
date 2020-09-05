package incident

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
)

// Incident holds the detailed information of an incident.
type Incident struct {
	Header
	PostID     string               `json:"post_id"`
	PlaybookID string               `json:"playbook_id"`
	Checklists []playbook.Checklist `json:"checklists"`
}

func (i *Incident) Clone() *Incident {
	newIncident := *i
	var newChecklists []playbook.Checklist
	for _, c := range i.Checklists {
		newChecklists = append(newChecklists, c.Clone())
	}
	newIncident.Checklists = newChecklists
	return &newIncident
}

// Header holds the summary information of an incident.
type Header struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	IsActive        bool   `json:"is_active"`
	CommanderUserID string `json:"commander_user_id"`
	TeamID          string `json:"team_id"`
	ChannelID       string `json:"channel_id"`
	CreateAt        int64  `json:"create_at"`
	EndAt           int64  `json:"end_at"`
	DeleteAt        int64  `json:"delete_at"`
	ActiveStage     int    `json:"active_stage"`
}

type UpdateOptions struct {
	ActiveStage *int `json:"active_stage"`
}

// Details holds the incident's channel and team metadata.
type Details struct {
	Incident
	ChannelName        string `json:"channel_name"`
	ChannelDisplayName string `json:"channel_display_name"`
	TeamName           string `json:"team_name"`
	NumMembers         int64  `json:"num_members"`
	TotalPosts         int64  `json:"total_posts"`
}

// GetIncidentsResults collects the results of the GetIncidents call: the list of Incidents matching
// the HeaderFilterOptions, and the TotalCount of the matching incidents before paging was applied.
type GetIncidentsResults struct {
	TotalCount int        `json:"total_count"`
	PageCount  int        `json:"page_count"`
	HasMore    bool       `json:"has_more"`
	Items      []Incident `json:"items"`
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

// ErrPermission is used to indicate a user does not have permissions
var ErrPermission = errors.New("permissions error")

// ErrIncidentNotActive is used to indicate trying to run a command on an incident that has ended.
var ErrIncidentNotActive = errors.New("incident not active")

// ErrIncidentActive is used to indicate trying to run a command on an incident that is active.
var ErrIncidentActive = errors.New("incident active")

// Service is the incident/service interface.
type Service interface {
	// GetIncidents returns filtered incidents and the total count before paging.
	GetIncidents(options HeaderFilterOptions) (*GetIncidentsResults, error)

	// CreateIncident creates a new incident.
	CreateIncident(incdnt *Incident, public bool) (*Incident, error)

	// OpenCreateIncidentDialog opens an interactive dialog to start a new incident.
	OpenCreateIncidentDialog(teamID, commanderID, triggerID, postID, clientID string, playbooks []playbook.Playbook) error

	// EndIncident completes the incident with the given ID by the given user.
	EndIncident(incidentID string, userID string) error

	// RestartIncident restarts the incident with the given ID by the given user.
	RestartIncident(incidentID, userID string) error

	// OpenEndIncidentDialog opens a interactive dialog so the user can confirm an incident should
	// be ended.
	OpenEndIncidentDialog(incidentID string, triggerID string) error

	// GetIncident gets an incident by ID. Returns error if it could not be found.
	GetIncident(incidentID string) (*Incident, error)

	// GetIncidentWithDetails gets an incident with the detailed metadata.
	GetIncidentWithDetails(incidentID string) (*Details, error)

	// GetIncidentIDForChannel get the incidentID associated with this channel. Returns ErrNotFound
	// if there is no incident associated with this channel.
	GetIncidentIDForChannel(channelID string) (string, error)

	// GetCommanders returns all the commanders of incidents selected
	GetCommanders(options HeaderFilterOptions) ([]CommanderInfo, error)

	// IsCommander returns true if the userID is the commander for incidentID.
	IsCommander(incidentID string, userID string) bool

	// ChangeCommander processes a request from userID to change the commander for incidentID
	// to commanderID. Changing to the same commanderID is a no-op.
	ChangeCommander(incidentID string, userID string, commanderID string) error

	// ModifyCheckedState modifies the state of the specified checklist item
	// Idempotent, will not perform any actions if the checklist item is already in the specified state
	ModifyCheckedState(incidentID, userID, newState string, checklistNumber int, itemNumber int) error

	// ToggleCheckedState checks or unchecks the specified checklist item
	ToggleCheckedState(incidentID, userID string, checklistNumber, itemNumber int) error

	// SetAssignee sets the assignee for the specified checklist item
	// Idempotent, will not perform any actions if the checklist item is already assigned to assigneeID
	SetAssignee(incidentID, userID, assigneeID string, checklistNumber, itemNumber int) error

	// AddChecklistItem adds an item to the specified checklist
	AddChecklistItem(incidentID, userID string, checklistNumber int, checklistItem playbook.ChecklistItem) error

	// RemoveChecklistItem removes an item from the specified checklist
	RemoveChecklistItem(incidentID, userID string, checklistNumber int, itemNumber int) error

	// RenameChecklistItem changes the title of a specified checklist item
	RenameChecklistItem(incidentID, userID string, checklistNumber int, itemNumber int, newTitle, newCommand string) error

	// MoveChecklistItem moves a checklist item from one position to anouther
	MoveChecklistItem(incidentID, userID string, checklistNumber int, itemNumber int, newLocation int) error

	// GetChecklistAutocomplete returns the list of checklist items for incidentID to be used in autocomplete
	GetChecklistAutocomplete(incidentID string) ([]model.AutocompleteListItem, error)

	// ChangeActiveStage processes a request from userID to change the active
	// stage of incidentID to stageIdx.
	ChangeActiveStage(incidentID, userID string, stageIdx int) (*Incident, error)

	// NukeDB removes all incident related data.
	NukeDB() error
}

// Store defines the methods the ServiceImpl needs from the interfaceStore.
type Store interface {
	// GetIncidents returns filtered incidents and the total count before paging.
	GetIncidents(options HeaderFilterOptions) (*GetIncidentsResults, error)

	// CreateIncident creates a new incident.
	CreateIncident(incdnt *Incident) (*Incident, error)

	// UpdateIncident updates an incident.
	UpdateIncident(incdnt *Incident) error

	// GetIncident gets an incident by ID.
	GetIncident(incidentID string) (*Incident, error)

	// GetIncidentByChannel gets an incident associated with the given channel id.
	GetIncidentIDForChannel(channelID string) (string, error)

	// GetAllIncidentMembersCount returns the count of all members of the
	// incident associated with the given channel id since the beginning of the
	// incident, excluding bots.
	GetAllIncidentMembersCount(channelID string) (int64, error)

	// GetCommanders returns the commanders of the incidents selected by options
	GetCommanders(options HeaderFilterOptions) ([]CommanderInfo, error)

	// NukeDB removes all incident related data.
	NukeDB() error
}

// Telemetry defines the methods that the ServiceImpl needs from the RudderTelemetry.
type Telemetry interface {
	// CreateIncidenttracks the creation of a new incident.
	CreateIncident(incident *Incident, public bool)

	// EndIncident tracks the end of an incident.
	EndIncident(incident *Incident)

	// RestartIncident tracks the restart of an incident.
	RestartIncident(incident *Incident)

	// ModifyCheckedState tracks the checking and unchecking of items by the user
	// identified by userID in the incident identified by incidentID.
	ModifyCheckedState(incidentID, userID, newState string)

	// SetAssignee tracks the changing of an assignee on an item by the user
	// identified by userID in the incident identified by incidentID.
	SetAssignee(incidentID, userID string)

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
