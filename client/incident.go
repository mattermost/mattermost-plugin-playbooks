package client

import "time"

// Incident represents an incident.
type Incident struct {
	ID                      string          `json:"id"`
	Name                    string          `json:"name"`
	Description             string          `json:"description"`
	CommanderUserID         string          `json:"commander_user_id"`
	ReporterUserID          string          `json:"reporter_user_id"`
	TeamID                  string          `json:"team_id"`
	ChannelID               string          `json:"channel_id"`
	CreateAt                int64           `json:"create_at"`
	EndAt                   int64           `json:"end_at"`
	DeleteAt                int64           `json:"delete_at"`
	ActiveStage             int             `json:"active_stage"`
	ActiveStageTitle        string          `json:"active_stage_title"`
	PostID                  string          `json:"post_id"`
	PlaybookID              string          `json:"playbook_id"`
	Checklists              []Checklist     `json:"checklists"`
	StatusPosts             []StatusPost    `json:"status_posts"`
	ReminderPostID          string          `json:"reminder_post_id"`
	PreviousReminder        time.Duration   `json:"previous_reminder"`
	BroadcastChannelID      string          `json:"broadcast_channel_id"`
	ReminderMessageTemplate string          `json:"reminder_message_template"`
	InvitedUserIDs          []string        `json:"invited_user_ids"`
	TimelineEvents          []TimelineEvent `json:"timeline_events"`
}

// StatusPost is information added to the incident when selecting from the db and sent to the
// client; it is not saved to the db.
type StatusPost struct {
	ID       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	DeleteAt int64  `json:"delete_at"`
}

// IncidentMetadata tracks ancillary metadata about an incident.
type IncidentMetadata struct {
	ChannelName        string `json:"channel_name"`
	ChannelDisplayName string `json:"channel_display_name"`
	TeamName           string `json:"team_name"`
	NumMembers         int64  `json:"num_members"`
	TotalPosts         int64  `json:"total_posts"`
}

// TimelineEventType describes a type of timeline event.
type TimelineEventType string

const (
	IncidentCreated   TimelineEventType = "incident_created"
	TaskStateModified TimelineEventType = "task_state_modified"
	StatusUpdated     TimelineEventType = "status_updated"
	CommanderChanged  TimelineEventType = "commander_changed"
	AssigneeChanged   TimelineEventType = "assignee_changed"
	RanSlashCommand   TimelineEventType = "ran_slash_command"
)

// TimelineEvent represents an event recorded to an incident's timeline.
type TimelineEvent struct {
	ID            string            `json:"id"`
	IncidentID    string            `json:"incident_id"`
	CreateAt      int64             `json:"create_at"`
	DeleteAt      int64             `json:"delete_at"`
	EventAt       int64             `json:"event_at"`
	EventType     TimelineEventType `json:"event_type"`
	Summary       string            `json:"summary"`
	Details       string            `json:"details"`
	PostID        string            `json:"post_id"`
	SubjectUserID string            `json:"subject_user_id"`
	CreatorUserID string            `json:"creator_user_id"`
}

// IncidentCreateOptions specifies the parameters for IncidentsService.Create method.
type IncidentCreateOptions struct {
	Name            string `json:"name"`
	CommanderUserID string `json:"commander_user_id"`
	TeamID          string `json:"team_id"`
	Description     string `json:"description"`
	PostID          string `json:"post_id"`
	PlaybookID      string `json:"playbook_id"`
}

// Sort enumerates the available fields we can sort on.
type Sort string

const (
	// SortByCreateAt sorts by the "create_at" field. It is the default.
	SortByCreateAt Sort = "create_at"

	// SortByID sorts by the "id" field.
	SortByID Sort = "id"

	// SortByName sorts by the "name" field.
	SortByName Sort = "name"

	// SortByCommanderUserID sorts by the "commander_user_id" field.
	SortByCommanderUserID Sort = "commander_user_id"

	// SortByTeamID sorts by the "team_id" field.
	SortByTeamID Sort = "team_id"

	// SortByEndAt sorts by the "end_at" field.
	SortByEndAt Sort = "end_at"
)

// SortDirection determines whether results are sorted ascending or descending.
type SortDirection string

const (
	// Desc sorts the results in descending order.
	SortDesc SortDirection = "desc"

	// Asc sorts the results in ascending order.
	SortAsc SortDirection = "asc"
)

// IncidentListOptions specifies the optional parameters to the
// IncidentsService.List method.
type IncidentListOptions struct {
	// For paginated result sets, page of results to retrieve. 0 based indx.
	Page int `url:"page,omitempty"`

	// For paginated result sets, the number of results to include per page.
	PerPage int `url:"per_page,omitempty"`

	// TeamID filters incidents to those in the given team.
	TeamID string `url:"team_id,omitempty"`

	Sort      Sort          `url:"sort,omitempty"`
	Direction SortDirection `url:"direction,omitempty"`

	// Status filters by All, Ongoing, or Ended; defaults to All.
	Status Status `url:"status,omitempty"`

	// CommanderID filters by commander's Mattermost user ID. Defaults to blank (no filter).
	CommanderID string `url:"commander_user_id,omitempty"`

	// MemberID filters incidents that have this member. Defaults to blank (no filter).
	MemberID string `url:"member_id,omitempty"`

	// SearchTerm returns results of the search term and respecting the other header filter options.
	// The search term acts as a filter and respects the Sort and Direction fields (i.e., results are
	// not returned in relevance order).
	SearchTerm string `url:"search_term,omitempty"`
}

// IncidentList contains the paginated result.
type IncidentList struct {
	TotalCount int  `json:"total_count"`
	PageCount  int  `json:"page_count"`
	HasMore    bool `json:"has_more"`
	Items      []*Incident
}

// Status is the type used to specify the activity status of the incident.
type Status string

const (
	StatusReported Status = "Reported"
	StatusActive   Status = "Active"
	StatusResolved Status = "Resolved"
	StatusArchived Status = "Archived"
)

type GetIncidentsResults struct {
	TotalCount int        `json:"total_count"`
	PageCount  int        `json:"page_count"`
	HasMore    bool       `json:"has_more"`
	Items      []Incident `json:"items"`
	Disabled   bool       `json:"disabled"`
}

// StatusUpdateOptions are the fields required to update an incident's status
type StatusUpdateOptions struct {
	Status            Status `json:"status"`
	Message           string `json:"message"`
	ReminderInSeconds int64  `json:"reminder"`
}
