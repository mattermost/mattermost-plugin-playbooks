package sqlstore

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type oldIncident struct {
	oldHeader
	PostID   string       `json:"post_id"`
	Playbook *oldPlaybook `json:"playbook"`
}

type oldHeader struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	IsActive         bool   `json:"is_active"`
	CommanderUserID  string `json:"commander_user_id"`
	TeamID           string `json:"team_id"`
	PrimaryChannelID string `json:"primary_channel_id"`
	CreatedAt        int64  `json:"created_at"`
	EndedAt          int64  `json:"ended_at"`
	ActiveStage      int    `json:"active_stage"`
}

type oldPlaybook struct {
	ID                   string         `json:"id"`
	Title                string         `json:"title"`
	TeamID               string         `json:"team_id"`
	CreatePublicIncident bool           `json:"create_public_incident"`
	Checklists           []oldChecklist `json:"checklists"`
	MemberIDs            []string       `json:"member_ids"`
}

type oldChecklist struct {
	Title string             `json:"title"`
	Items []oldChecklistItem `json:"items"`
}

type oldChecklistItem struct {
	Title                  string    `json:"title"`
	State                  string    `json:"state"`
	StateModified          time.Time `json:"state_modified"`
	StateModifiedPostID    string    `json:"state_modified_post_id"`
	AssigneeID             string    `json:"assignee_id"`
	AssigneeModified       time.Time `json:"assignee_modified"`
	AssigneeModifiedPostID string    `json:"assignee_modified_post_id"`
	Command                string    `json:"command"`
	Description            string    `json:"description"`
}

type oldPlaybookIndex struct {
	PlaybookIDs []string `json:"playbook_ids"`
}

func DataMigration(kvAPI pluginkvstore.KVAPI, builder squirrel.StatementBuilderType, db *sql.DB) error {
	// Get old playbooks
	var playbookIndex oldPlaybookIndex
	if err := kvAPI.Get("v2_playbookindex", &playbookIndex); err != nil {
		return errors.Wrap(err, "unable to get playbook index")
	}

	getPlaybook := func(id string) (oldPlaybook, error) {
		var out oldPlaybook

		if id == "" {
			return out, errors.New("ID cannot be empty")
		}

		err := kvAPI.Get("v2_playbook_"+id, &out)
		if err != nil {
			return out, err
		}

		if out.ID != id {
			return out, playbook.ErrNotFound
		}

		return out, nil
	}

	playbooks := make([]oldPlaybook, 0, len(playbookIndex.PlaybookIDs))
	for _, playbookID := range playbookIndex.PlaybookIDs {
		// Ignoring error here for now. If a playbook is deleted after this function retrieves the index,
		// and error could be generated here that can be ignored. Other errors are unhelpful to the user.
		gotPlaybook, _ := getPlaybook(playbookID)
		playbooks = append(playbooks, gotPlaybook)
	}

	// Get old incidents
	headersMap := make(map[string]oldHeader)
	if err := kvAPI.Get("v2_all_headers", &headersMap); err != nil {
		return errors.Wrapf(err, "failed to get all headers value")
	}

	var headers []oldHeader
	for _, value := range headersMap {
		headers = append(headers, value)
	}

	getIncident := func(incidentID string) (*oldIncident, error) {
		var incdnt oldIncident
		if err := kvAPI.Get("v2_incident_"+incidentID, &incdnt); err != nil {
			return nil, errors.Wrapf(err, "failed to get incident")
		}
		if incdnt.ID == "" {
			return nil, incident.ErrNotFound
		}
		return &incdnt, nil
	}

	var incidents []oldIncident
	for _, header := range headers {
		i, err := getIncident(header.ID)
		if err != nil {
			// odds are this should not happen, so default to failing fast
			return errors.Wrapf(err, "failed to get incident id '%s'", header.ID)
		}
		incidents = append(incidents, *i)
	}

	// CREATE TABLE IR_Playbook (
	//    ID TEXT/VARCHAR(26) PRIMARY KEY,
	//    Title TEXT/VARCHAR(65535) NOT NULL,
	//    TeamID TEXT/VARCHAR(26) NOT NULL,
	//    CreatePublicIncident BOOLEAN NOT NULL,
	//    CreateAt BIGINT NOT NULL,
	//    DeleteAt BIGINT NOT NULL DEFAULT 0,
	//    Checklists JSON/VARCHAR(65535) NOT NULL
	// );
	playbookInsert := builder.
		Insert("IR_Playbook").
		Columns(
			"ID",
			"Title",
			"TeamID",
			"CreatePublicIncident",
			"CreateAt",
			"DeleteAt",
			"Checklists",
		)

	// CREATE TABLE IR_PlaybookMember (
	//    PlaybookID TEXT/VARCHAR(26) NOT NULL REFERENCES IR_Playbook(ID)
	//    MemberID TEXT/VARCHAR(26) NOT NULL,
	// );
	playbookMemberInsert := builder.
		Insert("IR_PlaybookMember").
		Columns(
			"PlaybookID",
			"MemberID",
		)

	for _, playbook := range playbooks {
		checklistsJSON, err := checklistsToJSON(playbook.Checklists)
		if err != nil {
			return errors.Wrapf(err, "failed to convert checklists from playbook '%s' to JSON", playbook.ID)
		}

		playbookInsert = playbookInsert.Values(
			playbook.ID,
			playbook.Title,
			playbook.TeamID,
			playbook.CreatePublicIncident,
			model.GetMillis(), // Creation date is set to now
			0,
			checklistsJSON,
		)

		for _, memberID := range playbook.MemberIDs {
			playbookMemberInsert = playbookMemberInsert.Values(
				playbook.ID,
				memberID,
			)
		}
	}

	playbookInsertQuery, playbookInsertArgs, err := playbookInsert.ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to convert playbookInsert into SQL")
	}

	if _, err := db.Exec(playbookInsertQuery, playbookInsertArgs); err != nil {
		return errors.Wrapf(err, "failed to insert data into Playbook table")
	}

	playbookMemberInsertQuery, playbookMemberInsertArgs, err := playbookMemberInsert.ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to convert playbookMemberInsert into SQL")
	}

	if _, err := db.Exec(playbookMemberInsertQuery, playbookMemberInsertArgs); err != nil {
		return errors.Wrapf(err, "failed to insert data into PlaybookMember table")
	}

	// CREATE TABLE IR_Incident (
	//     ID TEXT/VARCHAR(26) PRIMARY KEY,
	//     Name TEXT/VARCHAR(26) NOT NULL,
	//     IsActive BOOLEAN NOT NULL,
	//     CommanderUserID TEXT/VARCHAR(26) NOT NULL,
	//     TeamID TEXT/VARCHAR(26) NOT NULL,
	//     ChannelID TEXT/VARCHAR(26) NOT NULL UNIQUE,
	//     CreateAt BIGINT NOT NULL,
	//     EndAt BIGINT NOT NULL DEFAULT 0,
	//     DeleteAt BIGINT NOT NULL DEFAULT 0,
	//     ActiveStage BIGINT NOT NULL,
	//     PostID TEXT/VARCHAR(26) NOT NULL DEFAULT '',
	//     PlaybookID TEXT/VARCHAR(26) NOT NULL DEFAULT '',
	//     ChecklistsJSON JSON/VARCHAR(65535) NOT NULL
	// );
	incidentInsert := builder.
		Insert("Incident").
		Columns(
			"ID",
			"Name",
			"IsActive",
			"CommanderUserID",
			"TeamID",
			"ChannelID",
			"CreateAt",
			"EndAt",
			"DeleteAt",
			"ActiveStage",
			"PostID",
			"PlaybookID",
			"ChecklistsJSON",
		)

	for _, incident := range incidents {
		checklistsJSON, err := checklistsToJSON(incident.Playbook.Checklists)
		if err != nil {
			return errors.Wrapf(err, "failed to convert checklists from incident '%s' to JSON", incident.ID)
		}
		incidentInsert = incidentInsert.Values(
			incident.ID,
			incident.Name,
			incident.IsActive,
			incident.CommanderUserID,
			incident.TeamID,
			incident.PrimaryChannelID,
			incident.CreatedAt,
			incident.EndedAt,
			0,
			incident.ActiveStage,
			incident.PostID,
			incident.Playbook.ID,
			checklistsJSON,
		)
	}

	incidentInsertQuery, incidentInsertArgs, err := incidentInsert.ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to convert incidentInsert into SQL")
	}

	if _, err := db.Exec(incidentInsertQuery, incidentInsertArgs); err != nil {
		return errors.Wrapf(err, "failed to insert data into Incident table")
	}

	return nil
}

func checklistsToJSON(oldChecklists []oldChecklist) ([]byte, error) {
	newChecklists := make([]playbook.Checklist, len(oldChecklists))
	for i, oldChecklist := range oldChecklists {
		newItems := make([]playbook.ChecklistItem, len(oldChecklist.Items))

		for j, oldItem := range oldChecklist.Items {
			newItems[j] = playbook.ChecklistItem{
				ID:                     model.NewId(),
				Title:                  oldItem.Title,
				State:                  oldItem.State,
				StateModified:          oldItem.StateModified,
				StateModifiedPostID:    oldItem.StateModifiedPostID,
				AssigneeID:             oldItem.AssigneeID,
				AssigneeModified:       oldItem.AssigneeModified,
				AssigneeModifiedPostID: oldItem.AssigneeModifiedPostID,
				Command:                oldItem.Command,
				Description:            oldItem.Description,
			}
		}

		newChecklists[i] = playbook.Checklist{
			ID:    model.NewId(),
			Title: oldChecklist.Title,
			Items: newItems,
		}
	}

	return json.Marshal(newChecklists)
}
