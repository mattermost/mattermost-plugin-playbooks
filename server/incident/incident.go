package incident

import (
	"encoding/json"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"

	"github.com/mattermost/mattermost-plugin-api/cluster"
)

// Incident holds the detailed information of an incident.
//
// NOTE: when adding a column to the db, search for "When adding an Incident column" to see where
// that column needs to be added in the sqlstore code.
type Incident struct {
	ID                      string               `json:"id"`
	Name                    string               `json:"name"` // DB from channel
	Description             string               `json:"description"`
	CommanderUserID         string               `json:"commander_user_id"`
	TeamID                  string               `json:"team_id"`
	ChannelID               string               `json:"channel_id"`
	CreateAt                int64                `json:"create_at"` // DB from channel
	EndAt                   int64                `json:"end_at"`
	DeleteAt                int64                `json:"delete_at"` // DB from channel
	ActiveStage             int                  `json:"active_stage"`
	ActiveStageTitle        string               `json:"active_stage_title"`
	PostID                  string               `json:"post_id"`
	PlaybookID              string               `json:"playbook_id"`
	Checklists              []playbook.Checklist `json:"checklists"`
	StatusPosts             []StatusPost         `json:"status_posts"`
	ReminderPostID          string               `json:"reminder_post_id"`
	PreviousReminder        time.Duration        `json:"previous_reminder"`
	BroadcastChannelID      string               `json:"broadcast_channel_id"`
	ReminderMessageTemplate string               `json:"reminder_message_template"`
}

func (i *Incident) Clone() *Incident {
	newIncident := *i
	var newChecklists []playbook.Checklist
	for _, c := range i.Checklists {
		newChecklists = append(newChecklists, c.Clone())
	}
	newIncident.Checklists = newChecklists

	var newStatusPosts []StatusPost
	newStatusPosts = append(newStatusPosts, i.StatusPosts...)
	newIncident.StatusPosts = newStatusPosts

	return &newIncident
}

func (i *Incident) MarshalJSON() ([]byte, error) {
	type Alias Incident

	old := (*Alias)(i.Clone())
	// replace nils with empty slices for the frontend
	if old.Checklists == nil {
		old.Checklists = []playbook.Checklist{}
	}
	for j, cl := range old.Checklists {
		if cl.Items == nil {
			old.Checklists[j].Items = []playbook.ChecklistItem{}
		}
	}
	if old.StatusPosts == nil {
		old.StatusPosts = []StatusPost{}
	}

	return json.Marshal(old)
}

func (i *Incident) CurrentStatus() string {
	post := findNewestNonDeletedStatusPost(i.StatusPosts)
	if post == nil {
		return StatusReported
	}
	if post.Status == "" {
		// Backwards compatability with existing incidents
		return StatusActive
	}

	return post.Status
}

func (i *Incident) IsActive() bool {
	currentStatus := i.CurrentStatus()
	return currentStatus != StatusResolved && currentStatus != StatusArchived
}

func (i *Incident) LastResolvedAt() int64 {
	var resolvedPost *StatusPost
	for j := len(i.StatusPosts) - 1; j > 0; j-- {
		if i.StatusPosts[j].DeleteAt != 0 {
			continue
		}
		if i.StatusPosts[j].Status != StatusResolved && i.StatusPosts[j].Status != StatusArchived {
			break
		}
		resolvedPost = &i.StatusPosts[j]
	}

	if resolvedPost == nil {
		return 0
	}

	return resolvedPost.CreateAt
}

const (
	StatusReported = "Reported"
	StatusActive   = "Active"
	StatusResolved = "Resolved"
	StatusArchived = "Archived"
)

// StatusPost is information added to the incident when selecting from the db and sent to the
// client; it is not saved to the db.
type StatusPost struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	CreateAt int64  `json:"create_at"`
	DeleteAt int64  `json:"delete_at"`
}

type UpdateOptions struct {
}

// StatusUpdateOptions encapsulates the fields that can be set when updating an incident's status
type StatusUpdateOptions struct {
	Status   string
	Message  string
	Reminder time.Duration
}

// Metadata tracks ancillary metadata about an incident.
type Metadata struct {
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

type SQLStatusPost struct {
	IncidentID string
	PostID     string
	Status     string
}

func (r GetIncidentsResults) Clone() GetIncidentsResults {
	newGetIncidentsResults := r

	newGetIncidentsResults.Items = make([]Incident, 0, len(r.Items))
	for _, i := range r.Items {
		newGetIncidentsResults.Items = append(newGetIncidentsResults.Items, *i.Clone())
	}

	return newGetIncidentsResults
}

func (r GetIncidentsResults) MarshalJSON() ([]byte, error) {
	type Alias GetIncidentsResults

	old := Alias(r.Clone())

	// replace nils with empty slices for the frontend
	if old.Items == nil {
		old.Items = []Incident{}
	}

	return json.Marshal(old)
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

// RequesterInfo holds the userID and teamID that this request is regarding, and permissions
// for the user making the request
type RequesterInfo struct {
	UserID          string
	UserIDtoIsAdmin map[string]bool
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

// ErrMalformedIncident is used to indicate an incident is not valid
var ErrMalformedIncident = errors.New("incident active")

// Service is the incident/service interface.
type Service interface {
	// GetIncidents returns filtered incidents and the total count before paging.
	GetIncidents(requesterInfo RequesterInfo, options FilterOptions) (*GetIncidentsResults, error)

	// CreateIncident creates a new incident. userID is the user who initiated the CreateIncident.
	CreateIncident(incdnt *Incident, userID string, public bool) (*Incident, error)

	// OpenCreateIncidentDialog opens an interactive dialog to start a new incident.
	OpenCreateIncidentDialog(teamID, commanderID, triggerID, postID, clientID string, playbooks []playbook.Playbook, isMobileApp bool) error

	// OpenUpdateStatusDialog opens an interactive dialog so the user can update the incident's status.
	OpenUpdateStatusDialog(incidentID, triggerID string) error

	// UpdateStatus updates an incident's status.
	UpdateStatus(incidentID, userID string, options StatusUpdateOptions) error

	// GetIncident gets an incident by ID. Returns error if it could not be found.
	GetIncident(incidentID string) (*Incident, error)

	// GetIncidentMetadata gets ancillary metadata about an incident.
	GetIncidentMetadata(incidentID string) (*Metadata, error)

	// GetIncidentIDForChannel get the incidentID associated with this channel. Returns ErrNotFound
	// if there is no incident associated with this channel.
	GetIncidentIDForChannel(channelID string) (string, error)

	// GetCommanders returns all the commanders of incidents selected
	GetCommanders(requesterInfo RequesterInfo, options FilterOptions) ([]CommanderInfo, error)

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

	// RunChecklistItemSlashCommand executes the slash command associated with the specified checklist item.
	RunChecklistItemSlashCommand(incidentID, userID string, checklistNumber, itemNumber int) (string, error)

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

	// NukeDB removes all incident related data.
	NukeDB() error

	// SetReminder sets a reminder. After timeInMinutes in the future, the commander will be
	// reminded to update the incident's status.
	SetReminder(incidentID string, timeInMinutes time.Duration) error

	// RemoveReminder removes the pending reminder for incidentID (if any).
	RemoveReminder(incidentID string)

	// HandleReminder is the handler for all reminder events.
	HandleReminder(key string)

	// RemoveReminderPost will remove the reminder in the incident channel (if any).
	RemoveReminderPost(incidentID string) error

	// ChangeCreationDate changes the creation date of the specified incident.
	ChangeCreationDate(incidentID string, creationTimestamp time.Time) error
}

// Store defines the methods the ServiceImpl needs from the interfaceStore.
type Store interface {
	// GetIncidents returns filtered incidents and the total count before paging.
	GetIncidents(requesterInfo RequesterInfo, options FilterOptions) (*GetIncidentsResults, error)

	// CreateIncident creates a new incident.
	CreateIncident(incdnt *Incident) (*Incident, error)

	// UpdateIncident updates an incident.
	UpdateIncident(incdnt *Incident) error

	// UpdateIncident updates an incident.
	UpdateStatus(statusPost *SQLStatusPost) error

	// GetIncident gets an incident by ID.
	GetIncident(incidentID string) (*Incident, error)

	// GetIncidentByChannel gets an incident associated with the given channel id.
	GetIncidentIDForChannel(channelID string) (string, error)

	// GetAllIncidentMembersCount returns the count of all members of the
	// incident associated with the given channel id since the beginning of the
	// incident, excluding bots.
	GetAllIncidentMembersCount(channelID string) (int64, error)

	// GetCommanders returns the commanders of the incidents selected by options
	GetCommanders(requesterInfo RequesterInfo, options FilterOptions) ([]CommanderInfo, error)

	// NukeDB removes all incident related data.
	NukeDB() error

	// ChangeCreationDate changes the creation date of the specified incident.
	ChangeCreationDate(incidentID string, creationTimestamp time.Time) error
}

// Telemetry defines the methods that the ServiceImpl needs from the RudderTelemetry.
// Unless otherwise noted, userID is the user initiating the event.
type Telemetry interface {
	// CreateIncident tracks the creation of a new incident.
	CreateIncident(incident *Incident, userID string, public bool)

	// EndIncident tracks the end of an incident.
	EndIncident(incident *Incident, userID string)

	// RestartIncident tracks the restart of an incident.
	RestartIncident(incident *Incident, userID string)

	// ChangeCommander tracks changes in commander.
	ChangeCommander(incident *Incident, userID string)

	// UpdateStatus tracks when an incident's status has been updated
	UpdateStatus(incident *Incident, userID string)

	// ModifyCheckedState tracks the checking and unchecking of items.
	ModifyCheckedState(incidentID, userID, newState string, wasCommander, wasAssignee bool)

	// SetAssignee tracks the changing of an assignee on an item.
	SetAssignee(incidentID, userID string)

	// AddTask tracks the creation of a new checklist item.
	AddTask(incidentID, userID string)

	// RemoveTask tracks the removal of a checklist item.
	RemoveTask(incidentID, userID string)

	// RenameTask tracks the update of a checklist item.
	RenameTask(incidentID, userID string)

	// MoveTask tracks the unchecking of checked item.
	MoveTask(incidentID, userID string)

	// RunTaskSlashCommand tracks the execution of a slash command attached to
	// a checklist item.
	RunTaskSlashCommand(incidentID, userID string)
}

type JobOnceScheduler interface {
	Start() error
	SetCallback(callback func(string)) error
	ListScheduledJobs() ([]cluster.JobOnceMetadata, error)
	ScheduleOnce(key string, runAt time.Time) (*cluster.JobOnce, error)
	Cancel(key string)
}
