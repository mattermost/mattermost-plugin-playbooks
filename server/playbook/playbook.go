package playbook

// Playbook represents the planning before an incident type is initiated.
type Playbook struct {
	ID         string      `json:"id"`
	ParentID   string      `json:"parent_id"`
	Title      string      `json:"title"`
	Checklists []Checklist `json:"checklists"`
}

// Checklist represents a checklist in a playbook
type Checklist struct {
	Title string          `json:"title"`
	Items []ChecklistItem `json:"items"`
}

// ChecklistItem represents an item in a checklist
type ChecklistItem struct {
	Title   string `json:"title"`
	Checked bool   `json:"checked"`
}

// Service is the playbook service for managing playbooks
type Service interface {
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
