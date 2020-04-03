package playbook

const (
	ChecklistItemStateUnchecked = "unchecked"
	ChecklistItemStateChecked   = "checked"
)

type Playbook struct {
	ID         string      `json:"id"`
	ParentID   string      `json:"parent_id"`
	Title      string      `json:"title"`
	Checklists []Checklist `json:"checklists"`
}

type Checklist struct {
	Title string          `json:"title"`
	Items []ChecklistItem `json:"items"`
}

type ChecklistItem struct {
	Title string `json:"title"`
	State string `json:"state"`
}

type Service interface {
	Get(id string) (Playbook, error)
	Create(playbook Playbook) (string, error)
	GetPlaybooks() ([]Playbook, error)
}

type Store interface {
	Get(id string) (Playbook, error)
	Create(playbook Playbook) (string, error)
	GetPlaybooks() ([]Playbook, error)
}
