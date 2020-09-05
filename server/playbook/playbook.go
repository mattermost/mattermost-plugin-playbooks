package playbook

import (
	"github.com/pkg/errors"
)

// ErrNotFound used to indicate entity not found.
var ErrNotFound = errors.New("not found")

// Playbook represents the planning before an incident type is initiated.
type Playbook struct {
	ID                   string      `json:"id"`
	Title                string      `json:"title"`
	Description          string      `json:"description"`
	TeamID               string      `json:"team_id"`
	CreatePublicIncident bool        `json:"create_public_incident"`
	CreateAt             int64       `json:"create_at"`
	DeleteAt             int64       `json:"delete_at"`
	Checklists           []Checklist `json:"checklists"`
	MemberIDs            []string    `json:"member_ids"`
}

func (p Playbook) Clone() Playbook {
	newPlaybook := p
	var newChecklists []Checklist
	for _, c := range p.Checklists {
		newChecklists = append(newChecklists, c.Clone())
	}
	newPlaybook.Checklists = newChecklists
	newPlaybook.MemberIDs = append([]string(nil), p.MemberIDs...)
	return newPlaybook
}

// Checklist represents a checklist in a playbook
type Checklist struct {
	ID    string          `json:"id"`
	Title string          `json:"title"`
	Items []ChecklistItem `json:"items"`
}

func (c Checklist) Clone() Checklist {
	newChecklist := c
	newChecklist.Items = append([]ChecklistItem(nil), c.Items...)
	return newChecklist
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
	Description            string `json:"description"`
}

// Service is the playbook service for managing playbooks
type Service interface {
	// Get retrieves a playbook. Returns ErrNotFound if not found.
	Get(id string) (Playbook, error)
	// Create creates a new playbook
	Create(playbook Playbook) (string, error)
	// GetPlaybooks retrieves all playbooks
	GetPlaybooks() ([]Playbook, error)
	// GetPlaybooksForTeam retrieves all playbooks on the specified team given the provided options
	GetPlaybooksForTeam(teamID string, opts Options) ([]Playbook, error)
	// Update updates a playbook
	Update(playbook Playbook) error
	// Delete deletes a playbook
	Delete(playbook Playbook) error
}

// Store is an interface for storing playbooks
type Store interface {
	// Get retrieves a playbook
	Get(id string) (Playbook, error)
	// Create creates a new playbook
	Create(playbook Playbook) (string, error)
	// GetPlaybooks retrieves all playbooks
	GetPlaybooks() ([]Playbook, error)
	// GetPlaybooksForTeam retrieves all playbooks on the specified team
	GetPlaybooksForTeam(teamID string, opts Options) ([]Playbook, error)
	// Update updates a playbook
	Update(playbook Playbook) error
	// Delete deletes a playbook
	Delete(id string) error
}

// Telemetry defines the methods that the Playbook service needs from the
// RudderTelemetry.
type Telemetry interface {
	// CreatePlaybook tracks the creation of a playbook.
	CreatePlaybook(playbook Playbook)

	// UpdatePlaybook tracks the update of a playbook.
	UpdatePlaybook(playbook Playbook)

	// DeletePlaybook tracks the deletion of a playbook.
	DeletePlaybook(playbook Playbook)
}

const (
	ChecklistItemStateOpen       = ""
	ChecklistItemStateInProgress = "in_progress"
	ChecklistItemStateClosed     = "closed"
)

func IsValidChecklistItemState(state string) bool {
	return state == ChecklistItemStateClosed ||
		state == ChecklistItemStateInProgress ||
		state == ChecklistItemStateOpen
}

func IsValidChecklistItemIndex(checklists []Checklist, checklistNum, itemNum int) bool {
	return checklists != nil && checklistNum >= 0 && itemNum >= 0 && checklistNum < len(checklists) && itemNum < len(checklists[checklistNum].Items)
}
