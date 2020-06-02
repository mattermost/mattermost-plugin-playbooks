package playbook

import (
	"time"

	"github.com/pkg/errors"
)

// ErrNotFound used to indicate entity not found.
var ErrNotFound = errors.New("not found")

// Playbook represents the planning before an incident type is initiated.
type Playbook struct {
	ID         string      `json:"id"`
	Title      string      `json:"title"`
	TeamID     string      `json:"team_id"`
	Checklists []Checklist `json:"checklists"`
}

// Checklist represents a checklist in a playbook
type Checklist struct {
	Title string          `json:"title"`
	Items []ChecklistItem `json:"items"`
}

// ChecklistItem represents an item in a checklist
type ChecklistItem struct {
	Title           string    `json:"title"`
	Checked         bool      `json:"checked"`
	CheckedModified time.Time `json:"checked_modified"`
	CheckedPostID   string    `json:"checked_post_id"`
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
	GetPlaybooksForTeam(teamID string) ([]Playbook, error)
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
