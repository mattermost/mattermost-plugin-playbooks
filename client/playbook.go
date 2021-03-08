package client

// Playbook represents the planning before an incident type is initiated.
type Playbook struct {
	ID                          string      `json:"id"`
	Title                       string      `json:"title"`
	Description                 string      `json:"description"`
	TeamID                      string      `json:"team_id"`
	CreatePublicIncident        bool        `json:"create_public_incident"`
	CreateAt                    int64       `json:"create_at"`
	DeleteAt                    int64       `json:"delete_at"`
	NumStages                   int64       `json:"num_stages"`
	NumSteps                    int64       `json:"num_steps"`
	Checklists                  []Checklist `json:"checklists"`
	MemberIDs                   []string    `json:"member_ids"`
	BroadcastChannelID          string      `json:"broadcast_channel_id"`
	ReminderMessageTemplate     string      `json:"reminder_message_template"`
	ReminderTimerDefaultSeconds int64       `json:"reminder_timer_default_seconds"`
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
