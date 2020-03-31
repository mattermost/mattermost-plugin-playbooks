package incident

// HeaderFilter header filter type.
type HeaderFilter func(Header) bool

// TeamHeaderFilter filters headers by teamID.
func TeamHeaderFilter(teamID string) HeaderFilter {
	return func(h Header) bool {
		return h.TeamID == teamID
	}
}
