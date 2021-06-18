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
	SortByCreateAt SortField = "create_at"

	// SortByID sorts by the primary key of an incident or playbook.
	SortByID SortField = "id"

	// SortByName sorts by the name of an incident.
	SortByName SortField = "name"

	// SortByOwnerUserID sorts by the user id of the owner of an incident.
	SortByOwnerUserID SortField = "owner_user_id"

	// SortByTeamID sorts by the team id of an incident or playbook.
	SortByTeamID SortField = "team_id"

	// SortByEndAt sorts by the end time of an incident.
	SortByEndAt SortField = "end_at"

	// SortByStatus sorts by the status of an incident.
	SortByStatus SortField = "status"

	// SortByLastStatusUpdateAt sorts by when the incident was last updated.
	SortByLastStatusUpdateAt SortField = "last_status_update_at"
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
