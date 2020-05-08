package pluginkvstore

import "github.com/mattermost/mattermost-plugin-incident-response/server/incident"

// HeaderFilter header filter type.
type HeaderFilter func(incident.Header) bool

// TeamFilter filters headers by teamID.
func teamFilter(teamID string) HeaderFilter {
	return func(h incident.Header) bool {
		return h.TeamID == teamID
	}
}

// ActiveFilter returns headers that are active.
func activeFilter() HeaderFilter {
	return func(h incident.Header) bool {
		return h.IsActive
	}
}

// CommanderFilter filters headers by commanderID.
func commanderFilter(commanderID string) HeaderFilter {
	return func(h incident.Header) bool {
		return h.CommanderUserID == commanderID
	}
}

// headerMatchesFilters returns true if the header matches the HeaderFilters.
func headerMatchesFilters(header incident.Header, filters ...HeaderFilter) bool {
	for _, filter := range filters {
		if !filter(header) {
			return false
		}
	}
	return true
}
