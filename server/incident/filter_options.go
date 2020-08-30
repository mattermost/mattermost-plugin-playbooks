package incident

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const PerPageDefault = 1000

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

// HeaderFilterOptions specifies the optional parameters when getting headers.
type HeaderFilterOptions struct {
	// Gets all the headers with this TeamID.
	TeamID string

	// Pagination options.
	Page    int
	PerPage int

	// Sort sorts by this header field in json format (eg, "create_at", "end_at", "name", etc.);
	// defaults to "create_at".
	Sort string

	// OrderBy orders by Asc (ascending), or Desc (descending); defaults to desc.
	Order string

	// Status filters by All, Ongoing, or Ended; defaults to All.
	Status Status

	// CommanderID filters by commander's Mattermost user ID. Defaults to blank (no filter).
	CommanderID string

	// SearchTerm returns results of the search term and respecting the other header filter options.
	// The search term acts as a filter and respects the Sort and Order fields (i.e., results are
	// not returned in relevance order).
	SearchTerm string

	// Permissions Check
	HasPermissionsTo func(channelID string) bool
}

const (
	SortByCreateAt        = "create_at"
	SortByID              = "id"
	SortByName            = "name"
	SortByCommanderUserID = "commander_user_id"
	SortByTeamID          = "team_id"
	SortByEndAt           = "end_at"
	SortByStatus          = "status"
	SortByIsActive        = "is_active"

	OrderAsc  = "asc"
	OrderDesc = "desc"
)

func IsValidSortBy(sortBy string) bool {
	switch sortBy {
	case SortByCreateAt,
		SortByID,
		SortByName,
		SortByCommanderUserID,
		SortByTeamID,
		SortByEndAt,
		SortByIsActive:
		return true
	}

	return false
}

func IsValidOrderBy(orderBy string) bool {
	return orderBy == OrderAsc || orderBy == OrderDesc
}

func ValidateOptions(options *HeaderFilterOptions) error {
	if options.PerPage == 0 {
		options.PerPage = PerPageDefault
	}

	if options.TeamID != "" && !model.IsValidId(options.TeamID) {
		return errors.New("bad parameter 'team_id': must be 26 characters or blank")
	}

	sort := strings.ToLower(options.Sort)
	switch sort {
	case SortByCreateAt, "": // default
		options.Sort = "CreateAt"
	case SortByID:
		options.Sort = "ID"
	case SortByName:
		options.Sort = "Name"
	case SortByCommanderUserID:
		options.Sort = "CommanderUserID"
	case SortByTeamID:
		options.Sort = "TeamID"
	case SortByEndAt:
		options.Sort = "EndAt"
	case SortByIsActive:
		options.Sort = "IsActive"
	default:
		return errors.New("bad parameter 'sort'")
	}

	order := strings.ToLower(options.Order)
	switch order {
	case OrderDesc, "": // default
		options.Order = OrderDesc
	case OrderAsc:
		options.Order = OrderAsc
	default:
		return errors.New("bad parameter 'order_by'")
	}

	if options.CommanderID != "" && !model.IsValidId(options.CommanderID) {
		return errors.New("bad parameter 'commander_id': must be 26 characters or blank")
	}

	// Put search term cleaning here, when we need it.

	return nil
}
