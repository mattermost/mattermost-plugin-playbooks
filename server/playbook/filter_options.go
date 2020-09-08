package playbook

// SortField enumerates the available fields we can sort on.
type SortField string

const (
	// Title sorts by the "Title" field.
	SortByTitle SortField = "Title"

	// Stages sorts by the number of checklists in a playbook.
	SortByStages SortField = "Stages"

	// Steps sorts by the the number of steps in a playbook.
	SortBySteps SortField = "Steps"
)

// SortDirection is the type used to specify the ascending or descending order of returned results.
type SortDirection string

const (
	// Desc is descending order.
	OrderDesc SortDirection = "DESC"

	// Asc is ascending order.
	OrderAsc SortDirection = "ASC"
)

// Options specifies the parameters when getting playbooks.
type Options struct {
	Sort      SortField
	Direction SortDirection
}

func IsValidSort(sort SortField) bool {
	switch sort {
	case SortByTitle,
		SortByStages,
		SortBySteps:
		return true
	}

	return false
}

func IsValidDirection(direction SortDirection) bool {
	return direction == OrderAsc || direction == OrderDesc
}
