package apioptions

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

	// Sort sorts by this header field in json format (eg, "created_at", "ended_at", "name", etc.);
	// defaults to "created_at".
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

func ValidateOptions(options *HeaderFilterOptions) error {
	if options.PerPage == 0 {
		options.PerPage = PerPageDefault
	}

	if options.TeamID != "" && !model.IsValidId(options.TeamID) {
		return errors.New("bad parameter 'team_id': must be 26 characters or blank")
	}

	sort := strings.ToLower(options.Sort)
	switch sort {
	case "create_at", "createat", "": // default
		options.Sort = "CreateAt"
	case "id":
		options.Sort = "ID"
	case "name":
		options.Sort = "Name"
	case "commander_user_id", "commanderuserid":
		options.Sort = "CommanderUserID"
	case "team_id", "teamid":
		options.Sort = "TeamID"
	case "end_at", "endat":
		options.Sort = "EndAt"
	case "status":
		options.Sort = "IsActive"
	default:
		return errors.New("bad parameter 'sort'")
	}

	order := strings.ToLower(options.Order)
	switch order {
	case "desc", "": // default
		options.Order = "DESC"
	case "asc":
		options.Order = "ASC"
	default:
		return errors.New("bad parameter 'order_by'")
	}

	if options.CommanderID != "" && !model.IsValidId(options.CommanderID) {
		return errors.New("bad parameter 'commander_id': must be 26 characters or blank")
	}

	// Put search term cleaning here, when we need it.

	return nil
}
