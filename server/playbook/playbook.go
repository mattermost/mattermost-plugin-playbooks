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
	TeamID               string      `json:"team_id"`
	CreatePublicIncident bool        `json:"create_public_incident"`
	Checklists           []Checklist `json:"checklists"`
	MemberIDs            []string    `json:"member_ids"`
}

// Checklist represents a checklist in a playbook
type Checklist struct {
	Title string          `json:"title"`
	Items []ChecklistItem `json:"items"`
}

// ChecklistItem represents an item in a checklist
type ChecklistItem struct {
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

// SortField enumerates the available fields we can sort on.
type SortField string

const (
	// Title sorts by the "title" field.
	Title SortField = "title"

	// Stages sorts by the number of checklists in a playbook.
	Stages SortField = "stages"

	// Steps sorts by the the number of steps in a playbook.
	Steps SortField = "steps"
)

// SortDirection is the type used to specify the ascending or descending order of returned results.
type SortDirection string

const (
	// Desc is descending order.
	Desc SortDirection = "desc"

	// Asc is ascending order.
	Asc SortDirection = "asc"
)

// Options specifies the parameters when getting playbooks.
type Options struct {
	Sort      SortField
	Direction SortDirection
}

// Service is the playbook service for managing playbooks
type Service interface {
	// Get retrieves a playbook. Returns ErrNotFound if not found.
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
