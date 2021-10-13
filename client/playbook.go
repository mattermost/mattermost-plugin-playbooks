package client

// Playbook represents the planning before a playbook run is initiated.
type Playbook struct {
	ID                             string      `json:"id"`
	Title                          string      `json:"title"`
	Description                    string      `json:"description"`
	TeamID                         string      `json:"team_id"`
	CreatePublicPlaybookRun        bool        `json:"create_public_playbook_run"`
	CreateAt                       int64       `json:"create_at"`
	DeleteAt                       int64       `json:"delete_at"`
	NumStages                      int64       `json:"num_stages"`
	NumSteps                       int64       `json:"num_steps"`
	Checklists                     []Checklist `json:"checklists"`
	MemberIDs                      []string    `json:"member_ids"`
	ReminderMessageTemplate        string      `json:"reminder_message_template"`
	ReminderTimerDefaultSeconds    int64       `json:"reminder_timer_default_seconds"`
	InvitedUserIDs                 []string    `json:"invited_user_ids"`
	InvitedGroupIDs                []string    `json:"invited_group_ids"`
	InvitedUsersEnabled            bool        `json:"invited_users_enabled"`
	FollowersEnabled               bool        `json:"followers_enabled"`
	FollowerIDs                    []string    `json:"follower_ids"`
	DefaultOwnerID                 string      `json:"default_owner_id"`
	DefaultOwnerEnabled            bool        `json:"default_owner_enabled"`
	BroadcastChannelIDs            []string    `json:"broadcast_channel_ids"`
	BroadcastEnabled               bool        `json:"broadcast_enabled"`
	ExportChannelOnFinishedEnabled bool        `json:"export_channel_on_finished_enabled"`
}

// Checklist represents a checklist in a playbook
type Checklist struct {
	ID    string          `json:"id"`
	Title string          `json:"title"`
	Items []ChecklistItem `json:"items"`
}

// ChecklistItem represents an item in a checklist
type ChecklistItem struct {
	ID                     string `json:"id"`
	Title                  string `json:"title"`
	State                  string `json:"state"`
	StateModified          int64  `json:"state_modified"`
	StateModifiedPostID    string `json:"state_modified_post_id"`
	AssigneeID             string `json:"assignee_id"`
	AssigneeModified       int64  `json:"assignee_modified"`
	AssigneeModifiedPostID string `json:"assignee_modified_post_id"`
	Command                string `json:"command"`
	CommandLastRun         int64  `json:"command_last_run"`
	Description            string `json:"description"`
}

// PlaybookCreateOptions specifies the parameters for PlaybooksService.Create method.
type PlaybookCreateOptions struct {
	Title                       string      `json:"title"`
	Description                 string      `json:"description"`
	TeamID                      string      `json:"team_id"`
	CreatePublicPlaybookRun     bool        `json:"create_public_playbook_run"`
	Checklists                  []Checklist `json:"checklists"`
	MemberIDs                   []string    `json:"member_ids"`
	BroadcastChannelID          string      `json:"broadcast_channel_id"`
	ReminderMessageTemplate     string      `json:"reminder_message_template"`
	ReminderTimerDefaultSeconds int64       `json:"reminder_timer_default_seconds"`
	InvitedUserIDs              []string    `json:"invited_user_ids"`
	InvitedGroupIDs             []string    `json:"invited_group_ids"`
	InviteUsersEnabled          bool        `json:"invite_users_enabled"`
	FollowersEnabled            bool        `json:"followers_enabled"`
	FollowerIDs                 []string    `json:"follower_ids"`
	DefaultOwnerID              string      `json:"default_owner_id"`
	DefaultOwnerEnabled         bool        `json:"default_owner_enabled"`
	BroadcastChannelIDs         []string    `json:"broadcast_channel_ids"`
	BroadcastEnabled            bool        `json:"broadcast_enabled"`
}

// PlaybookListOptions specifies the optional parameters to the
// PlaybooksService.List method.
type PlaybookListOptions struct {
	Sort      Sort          `url:"sort,omitempty"`
	Direction SortDirection `url:"direction,omitempty"`
}

type GetPlaybooksResults struct {
	TotalCount int        `json:"total_count"`
	PageCount  int        `json:"page_count"`
	HasMore    bool       `json:"has_more"`
	Items      []Playbook `json:"items"`
}
