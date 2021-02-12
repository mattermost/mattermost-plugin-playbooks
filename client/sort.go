package client

// SortDirection determines whether results are sorted ascending or descending.
type SortDirection string

const (
	// Desc sorts the results in descending order.
	SortDesc SortDirection = "desc"

	// Asc sorts the results in ascending order.
	SortAsc SortDirection = "asc"
)
