package sqlstore

import (
	"encoding/json"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
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
	Description      string `json:"description"`
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
	Description          string         `json:"description"`
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

func DataMigration(store *SQLStore, tx *sqlx.Tx, kvAPI KVAPI) error {
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

	playbookInsert := store.builder.
		Insert("IR_Playbook").
		Columns(
			"ID",
			"Title",
			"Description",
			"TeamID",
			"CreatePublicIncident",
			"CreateAt",
			"DeleteAt",
			"ChecklistsJSON",
			"NumStages",
			"NumSteps",
		)

	playbookMemberInsert := store.builder.
		Insert("IR_PlaybookMember").
		Columns(
			"PlaybookID",
			"MemberID",
		)

	for _, playbook := range playbooks {
		checklistsJSON, err := oldChecklistsToJSON(playbook.Checklists)
		if err != nil {
			return errors.Wrapf(err, "failed to convert checklists from playbook '%s' to JSON", playbook.ID)
		}

		playbookInsert = playbookInsert.Values(
			playbook.ID,
			playbook.Title,
			playbook.Description,
			playbook.TeamID,
			playbook.CreatePublicIncident,
			model.GetMillis(), // Creation date is set to now
			0,
			checklistsJSON,
			len(playbook.Checklists),
			numSteps(playbook.Checklists),
		)

		for _, memberID := range playbook.MemberIDs {
			playbookMemberInsert = playbookMemberInsert.Values(
				playbook.ID,
				memberID,
			)
		}
	}

	incidentInsert := store.builder.
		Insert("IR_Incident").
		Columns(
			"ID",
			"Name",
			"Description",
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
		checklistsJSON, err := oldChecklistsToJSON(incident.Playbook.Checklists)
		if err != nil {
			return errors.Wrapf(err, "failed to convert checklists from incident '%s' to JSON", incident.ID)
		}
		incidentInsert = incidentInsert.Values(
			incident.ID,
			incident.Name,
			incident.Description,
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

	if len(playbooks) > 0 {
		if _, err := store.execBuilder(tx, playbookInsert); err != nil {
			return errors.Wrapf(err, "failed inserting data into Playbook table")
		}

		if _, err := store.execBuilder(tx, playbookMemberInsert); err != nil {
			return errors.Wrapf(err, "failed inserting data into PlaybookMember table")
		}
	}

	if len(incidents) > 0 {
		if _, err := store.execBuilder(tx, incidentInsert); err != nil {
			return errors.Wrapf(err, "failed inserting data into Incident table")
		}
	}
	return nil
}

func oldChecklistsToJSON(oldChecklists []oldChecklist) ([]byte, error) {
	newChecklists := make([]playbook.Checklist, len(oldChecklists))
	for i, oldChecklist := range oldChecklists {
		newItems := make([]playbook.ChecklistItem, len(oldChecklist.Items))

		for j, oldItem := range oldChecklist.Items {
			newItems[j] = playbook.ChecklistItem{
				ID:                     model.NewId(),
				Title:                  oldItem.Title,
				State:                  oldItem.State,
				StateModified:          model.GetMillisForTime(oldItem.StateModified),
				StateModifiedPostID:    oldItem.StateModifiedPostID,
				AssigneeID:             oldItem.AssigneeID,
				AssigneeModified:       model.GetMillisForTime(oldItem.AssigneeModified),
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

func numSteps(checklists []oldChecklist) int {
	steps := 0
	for _, p := range checklists {
		steps += len(p.Items)
	}
	return steps
}
