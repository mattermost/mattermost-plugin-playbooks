package sqlstore

import (
	"database/sql"
	"time"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"
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

func DataMigration(kvAPI pluginkvstore.KVAPI, db *sql.DB) error {
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

	var allIncidents []oldIncident
	for _, header := range headers {
		i, err := getIncident(header.ID)
		if err != nil {
			// odds are this should not happen, so default to failing fast
			return errors.Wrapf(err, "failed to get incident id '%s'", header.ID)
		}
		allIncidents = append(allIncidents, *i)
	}

	// INSERT ALL INCIDENTS TO DB
	// INSERT ALL PLAYBOOKS TO DB

	return nil
}
