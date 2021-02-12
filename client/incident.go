package client

import "time"

// Incident represents an incident.
type Incident struct {
	ID                      string          `json:"id"`
	Name                    string          `json:"name"`
	Description             string          `json:"description"`
	IsActive                bool            `json:"is_active"`
	CommanderUserID         string          `json:"commander_user_id"`
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
	StatusPostIDs           []string        `json:"status_post_ids"`
	StatusPosts             []StatusPost    `json:"status_posts"`
	ReminderPostID          string          `json:"reminder_post_id"`
	PreviousReminder        time.Duration   `json:"previous_reminder"`
	BroadcastChannelID      string          `json:"broadcast_channel_id"`
	ReminderMessageTemplate string          `json:"reminder_message_template"`
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

// IncidentListOptions specifies the optional parameters to the
// IncidentsService.List method.
type IncidentListOptions struct {
	// For paginated result sets, page of results to retrieve. 0 based indx.
	Page int `url:"page,omitempty"`

	// For paginated result sets, the number of results to include per page.
	PerPage int `url:"per_page,omitempty"`

	// TeamID filters incidents to those in the given team.
	TeamID string `url:"team_id,omitempty"`

	Sort      IncidentSort  `url:"sort,omitempty"`
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

// IncidentSort enumerates the available fields we can sort on.
type IncidentSort string

const (
	// CreateAt sorts by the "create_at" field. It is the default.
	CreateAt IncidentSort = "create_at"

	// ID sorts by the "id" field.
	ID IncidentSort = "id"

	// Name sorts by the "name" field.
	Name IncidentSort = "name"

	// CommanderUserID sorts by the "commander_user_id" field.
	CommanderUserID IncidentSort = "commander_user_id"

	// TeamID sorts by the "team_id" field.
	TeamID IncidentSort = "team_id"

	// EndAt sorts by the "end_at" field.
	EndAt IncidentSort = "end_at"
)

// IncidentList contains the paginated result.
type IncidentList struct {
	TotalCount int  `json:"total_count"`
	PageCount  int  `json:"page_count"`
	HasMore    bool `json:"has_more"`
	Items      []*Incident
}

// Status is the type used to specify the activity status of the incident.
type Status int

const (
	// All are all incidents (active and ended).
	All Status = iota

	// Ongoing are incidents that are currently under way.
	Ongoing

	// Ended are incidents that are finished.
	Ended
)

type GetIncidentsResults struct {
	TotalCount int        `json:"total_count"`
	PageCount  int        `json:"page_count"`
	HasMore    bool       `json:"has_more"`
	Items      []Incident `json:"items"`
}
