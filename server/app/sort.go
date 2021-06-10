package app

// SortField enumerates the available fields we can sort on.
type SortField string

const (
	// SortByTitle sorts by the title field of a playbook.
	SortByTitle SortField = "title"

	// SortByStages sorts by the number of checklists in a playbook.
	SortByStages SortField = "stages"

	// SortBySteps sorts by the number of steps in a playbook.
	SortBySteps SortField = "steps"

	// SortByCreateAt sorts by the created time of an incident or playbook.
	SortByCreateAt = "create_at"

	// SortByID sorts by the primary key of an incident or playbook.
	SortByID = "id"

	// SortByName sorts by the name of an incident.
	SortByName = "name"

	// SortByOwnerUserID sorts by the user id of the owner of an incident.
	SortByOwnerUserID = "owner_user_id"

	// SortByTeamID sorts by the team id of an incident or playbook.
	SortByTeamID = "team_id"

	// SortByEndAt sorts by the end time of an incident.
	SortByEndAt = "end_at"

	// SortByStatus sorts by the status of an incident.
	SortByStatus = "status"
)

// SortDirection is the type used to specify the ascending or descending order of returned results.
type SortDirection string

const (
	// DirectionDesc is descending order.
	DirectionDesc SortDirection = "DESC"

	// DirectionAsc is ascending order.
	DirectionAsc SortDirection = "ASC"
)

func IsValidDirection(direction SortDirection) bool {
	return direction == DirectionAsc || direction == DirectionDesc
}
