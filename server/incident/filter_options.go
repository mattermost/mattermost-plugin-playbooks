package incident

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const PerPageDefault = 1000

// FilterOptions specifies the optional parameters when getting headers.
type FilterOptions struct {
	// Gets all the headers with this TeamID.
	TeamID string

	// Pagination options.
	Page    int
	PerPage int

	// Sort sorts by this header field in json format (eg, "create_at", "end_at", "name", etc.);
	// defaults to "create_at".
	Sort string

	// Direction orders by Asc (ascending), or Desc (descending); defaults to desc.
	Direction string

	// Status filters by current status
	Status string

	// CommanderID filters by commander's Mattermost user ID. Defaults to blank (no filter).
	CommanderID string

	// MemberID filters incidents that have this member. Defaults to blank (no filter).
	MemberID string

	// SearchTerm returns results of the search term and respecting the other header filter options.
	// The search term acts as a filter and respects the Sort and Direction fields (i.e., results are
	// not returned in relevance order).
	SearchTerm string
}

const (
	SortByCreateAt        = "create_at"
	SortByID              = "id"
	SortByName            = "name"
	SortByCommanderUserID = "commander_user_id"
	SortByTeamID          = "team_id"
	SortByEndAt           = "end_at"
	SortByStatus          = "status"

	DirectionAsc  = "asc"
	DirectionDesc = "desc"
)

func IsValidSortBy(sortBy string) bool {
	switch sortBy {
	case SortByCreateAt,
		SortByID,
		SortByName,
		SortByCommanderUserID,
		SortByTeamID,
		SortByEndAt:
		return true
	}

	return false
}

func IsValidDirection(direction string) bool {
	return direction == DirectionAsc || direction == DirectionDesc
}

func ValidateOptions(options *FilterOptions) error {
	if options.PerPage == 0 {
		options.PerPage = PerPageDefault
	}

	if !model.IsValidId(options.TeamID) {
		return errors.New("bad parameter 'team_id': must be 26 characters")
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
	case SortByStatus:
		options.Sort = "CurrentStatus"
	default:
		return errors.New("bad parameter 'sort'")
	}

	direction := strings.ToLower(options.Direction)
	switch direction {
	case DirectionAsc, "": // default
		options.Direction = DirectionAsc
	case DirectionDesc:
		options.Direction = DirectionDesc
	default:
		return errors.New("bad parameter 'direction'")
	}

	if options.CommanderID != "" && !model.IsValidId(options.CommanderID) {
		return errors.New("bad parameter 'commander_id': must be 26 characters or blank")
	}

	if options.MemberID != "" && !model.IsValidId(options.MemberID) {
		return errors.New("bad parameter 'member_id': must be 26 characters or blank")
	}

	return nil
}
