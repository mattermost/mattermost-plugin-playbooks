package incident

// SortDirection is the type used to specify the ascending or descending order of returned results.
type SortDirection int

const (
	// Desc is descending order.
	Desc SortDirection = iota

	// Asc is ascending order.
	Asc
)

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

// SortField enumerates the available fields we can sort on.
type SortField int

const (
	// CreatedAt sorts by the "created_at" field. It is the default.
	CreatedAt SortField = iota

	// ID sorts by the "id" field.
	ID

	// Name sorts by the "name" field.
	Name

	// CommanderUserID sorts by the "commander_user_id" field.
	CommanderUserID

	// TeamID sorts by the "team_id" field.
	TeamID

	// EndedAt sorts by the "ended_at" field.
	EndedAt
)

// HeaderFilterOptions specifies the optional parameters when getting headers.
type HeaderFilterOptions struct {
	// Gets all the headers with this TeamID.
	TeamID string

	// Pagination options.
	Page    int
	PerPage int

	// Sort sorts by this header field in json format (eg, "created_at", "ended_at", "name", etc.);
	// defaults to "created_at".
	Sort SortField

	// OrderBy orders by Asc (ascending), or Desc (descending); defaults to desc.
	Order SortDirection

	// Status filters by All, Ongoing, or Ended; defaults to All.
	Status Status

	// CommanderID filters by commander's Mattermost user ID. Defaults to blank (no filter).
	CommanderID string

	// SearchTerm returns results of the search term, ordered by relevance, and respecting the other
	// header filter options (except Sort & Order which are mutually exclusive of relevance
	// ordering).
	SearchTerm string
}
