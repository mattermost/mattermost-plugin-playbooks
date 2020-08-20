package sqlstore

import (
	"database/sql"
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

	// CREATE TABLE Playbook (
	//    ID VARCHAR(26) PRIMARY KEY,
	//    Title VARCHAR(65535) NOT NULL,
	//    TeamID VARCHAR(26) NOT NULL,
	//    CreatePublicIncident BOOLEAN NOT NULL,
	//    CreateAt BIGINT NOT NULL,
	//    DeleteAt BIGINT NOT NULL DEFAULT 0,
	//    InBackstage BOOLEAN NOT NULL DEFAULT FALSE
	// );
	playbookInsert := builder.
		Insert("Playbook").
		Columns(
			"ID",
			"Title",
			"TeamID",
			"CreatePublicIncident",
			"CreateAt",
		)

	// CREATE TABLE PlaybookMember (
	//    PlaybookID VARCHAR(26) NOT NULL REFERENCES Playbook(ID)
	//    MemberID VARCHAR(26) NOT NULL,
	// );
	playbookMemberInsert := builder.
		Insert("PlaybookMember").
		Columns(
			"PlaybookID",
			"MemberID",
		)

	// CREATE TABLE Checklist (
	//    ID VARCHAR(26) PRIMARY KEY,
	//    Title VARCHAR(65535) NOT NULL,
	//    Sequence BIGINT NOT NULL,
	//    PlaybookID VARCHAR(26) NOT NULL REFERENCES Playbook(ID)
	// );
	checklistInsert := builder.
		Insert("Checklist").
		Columns(
			"ID",
			"Title",
			"Sequence",
			"PlaybookID",
		)
	// CREATE TABLE ChecklistItem (
	//    ID VARCHAR(26) PRIMARY KEY,
	//    Title VARCHAR(65535) NOT NULL,
	//    State VARCHAR(32) NOT NULL DEFAULT '',
	//    StateModified BIGINT NOT NULL DEFAULT 0, --  should change the field type at the same time
	//    StateModifiedPostID VARCHAR(26) NOT NULL DEFAULT '',
	//    AssigneeID VARCHAR(26) NOT NULL DEFAULT '',
	//    AssigneeModified BIGINT NOT NULL DEFAULT 0, --  should change the field type at the same time
	//    AssigneeModifiedPostID VARCHAR(26) NOT NULL DEFAULT '',
	//    Command VARCHAR(65535) NOT NULL,
	//    DeleteAt BIGINT NOT NULL DEFAULT 0,
	//    Sequence BIGINT NOT NULL,
	//    ChecklistID VARCHAR(26) NOT NULL REFERENCES Checklist(ID)
	// );
	checklistItemInsert := builder.
		Insert("ChecklistItem").
		Columns(
			"ID",
			"Title",
			"State",
			"StateModified",
			"StateModifiedPostID",
			"AssigneeID",
			"AssigneeModified",
			"AssigneeModifiedPostID",
			"Command",
			"DeleteAt",
			"Sequence",
			"ChecklistID",
		)

	for _, playbook := range playbooks {
		playbookInsert = playbookInsert.Values(
			playbook.ID,
			playbook.Title,
			playbook.TeamID,
			playbook.CreatePublicIncident,
			0,
		)

		for _, memberID := range playbook.MemberIDs {
			playbookMemberInsert = playbookMemberInsert.Values(
				playbook.ID,
				memberID,
			)
		}

		for checklistSeq, checklist := range playbook.Checklists {
			checklistID := model.NewId()
			checklistInsert = checklistInsert.
				Values(
					checklistID,
					checklist.Title,
					checklistSeq,
					playbook.ID,
				)

			for itemSeq, item := range checklist.Items {
				checklistItemInsert = checklistItemInsert.
					Values(
						model.NewId(),
						item.Title,
						item.State,
						item.StateModified.Unix(),
						item.StateModifiedPostID,
						item.AssigneeID,
						item.AssigneeModified.Unix(),
						item.AssigneeModifiedPostID,
						item.Command,
						0,
						itemSeq,
						checklistID,
					)
			}
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

	checklistInsertQuery, checklistInsertArgs, err := checklistInsert.ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to convert checklistInsert into SQL")
	}

	if _, err := db.Exec(checklistInsertQuery, checklistInsertArgs); err != nil {
		return errors.Wrapf(err, "failed to insert data into Checklist table")
	}

	checklistItemInsertQuery, checklistItemInsertArgs, err := checklistItemInsert.ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to convert checklistItemInsert into SQL")

	}

	if _, err := db.Exec(checklistItemInsertQuery, checklistItemInsertArgs); err != nil {
		return errors.Wrapf(err, "failed to insert data into ChecklistItem table")
	}

	// CREATE TABLE Incident (
	//    ID VARCHAR(26) PRIMARY KEY,
	//    Name VARCHAR(26) NOT NULL,
	//    IsActive BOOLEAN NOT NULL,
	//    CommanderUserID VARCHAR(26) NOT NULL,
	//    TeamID VARCHAR(26) NOT NULL,
	//    ChannelID VARCHAR(26) NOT NULL UNIQUE, -- should change the field name at the same time
	//    CreateAt BIGINT NOT NULL, -- should change the field name at the same time
	//    EndedAt BIGINT NOT NULL DEFAULT 0,
	//    DeleteAt BIGINT NOT NULL DEFAULT 0,
	//    ActiveStage BIGINT NOT NULL,
	//    PostID VARCHAR(26) NOT NULL DEFAULT '',
	//    PlaybookID VARCHAR(26) NOT NULL REFERENCES Playbook(ID)
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
			"EndedAt",
			"DeleteAt",
			"ActiveStage",
			"PostID",
			"PlaybookID",
		)

	for _, incident := range incidents {
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
