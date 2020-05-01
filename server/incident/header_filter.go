package incident

// OrderByOption is the type used to specify the ascending or descending order of returned results.
type OrderByOption int

const (
	// Desc is descending order.
	Desc OrderByOption = iota

	// Asc is ascending order.
	Asc
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
	Sort string

	// OrderBy orders by Asc (ascending), or Desc (descending); defaults to desc.
	OrderBy OrderByOption

	// Active filters by active. If true, return only active incidents. If false, return
	// all incidents. Defaults to false.
	Active bool

	// CommanderID filters by commander's Mattermost user ID. Defaults to blank (no filter).
	CommanderID string

	// Search returns results of the search term, ordered by relevance, and respecting the other
	// header filter options (except Sort & OrderBy which are mutually exclusive of relevance
	// ordering).
	Search string
}

// HeaderFilter header filter type.
type HeaderFilter func(Header) bool

// TeamHeaderFilter filters headers by teamID.
func TeamHeaderFilter(teamID string) HeaderFilter {
	return func(h Header) bool {
		return h.TeamID == teamID
	}
}

// ActiveFilter returns headers that are active.
func ActiveFilter() HeaderFilter {
	return func(h Header) bool {
		return h.IsActive
	}
}

// CommanderFilter filters headers by commanderID.
func CommanderFilter(commanderID string) HeaderFilter {
	return func(h Header) bool {
		return h.CommanderUserID == commanderID
	}
}

// HeaderMatchesFilters returns true if the header matches the HeaderFilters.
func HeaderMatchesFilters(header Header, filters ...HeaderFilter) bool {
	for _, filter := range filters {
		if !filter(header) {
			return false
		}
	}
	return true
}
