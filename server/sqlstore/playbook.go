package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type sqlPlaybook struct {
	playbook.Playbook
	ChecklistsJSON              json.RawMessage
	ConcatenatedInvitedUserIDs  string
	ConcatenatedInvitedGroupIDs string
}

// playbookStore is a sql store for playbooks. Use NewPlaybookStore to create it.
type playbookStore struct {
	pluginAPI       PluginAPIClient
	log             bot.Logger
	store           *SQLStore
	queryBuilder    sq.StatementBuilderType
	playbookSelect  sq.SelectBuilder
	memberIDsSelect sq.SelectBuilder
}

// Ensure playbookStore implements the playbook.Store interface.
var _ playbook.Store = (*playbookStore)(nil)

type playbookMembers []struct {
	PlaybookID string
	MemberID   string
}

// NewPlaybookStore creates a new store for playbook service.
func NewPlaybookStore(pluginAPI PluginAPIClient, log bot.Logger, sqlStore *SQLStore) playbook.Store {
	playbookSelect := sqlStore.builder.
		Select("ID", "Title", "Description", "TeamID", "CreatePublicIncident", "CreateAt",
			"DeleteAt", "NumStages", "NumSteps", "BroadcastChannelID",
			"COALESCE(ReminderMessageTemplate, '') ReminderMessageTemplate", "ReminderTimerDefaultSeconds",
			"ConcatenatedInvitedUserIDs", "ConcatenatedInvitedGroupIDs", "InviteUsersEnabled",
			"DefaultCommanderID", "DefaultCommanderEnabled",
			"AnnouncementChannelID", "AnnouncementChannelEnabled",
			"WebhookOnCreationURL", "WebhookOnCreationEnabled").
		From("IR_Playbook")

	memberIDsSelect := sqlStore.builder.
		Select("PlaybookID", "MemberID").
		From("IR_PlaybookMember")

	newStore := &playbookStore{
		pluginAPI:       pluginAPI,
		log:             log,
		store:           sqlStore,
		queryBuilder:    sqlStore.builder,
		playbookSelect:  playbookSelect,
		memberIDsSelect: memberIDsSelect,
	}
	return newStore
}

// Create creates a new playbook
func (p *playbookStore) Create(pbook playbook.Playbook) (id string, err error) {
	if pbook.ID != "" {
		return "", errors.New("ID should be empty")
	}
	pbook.ID = model.NewId()

	rawPlaybook, err := toSQLPlaybook(pbook)
	if err != nil {
		return "", err
	}

	tx, err := p.store.db.Beginx()
	if err != nil {
		return "", errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	_, err = p.store.execBuilder(tx, sq.
		Insert("IR_Playbook").
		SetMap(map[string]interface{}{
			"ID":                          rawPlaybook.ID,
			"Title":                       rawPlaybook.Title,
			"Description":                 rawPlaybook.Description,
			"TeamID":                      rawPlaybook.TeamID,
			"CreatePublicIncident":        rawPlaybook.CreatePublicIncident,
			"CreateAt":                    rawPlaybook.CreateAt,
			"DeleteAt":                    rawPlaybook.DeleteAt,
			"ChecklistsJSON":              rawPlaybook.ChecklistsJSON,
			"NumStages":                   len(rawPlaybook.Checklists),
			"NumSteps":                    getSteps(rawPlaybook.Playbook),
			"BroadcastChannelID":          rawPlaybook.BroadcastChannelID,
			"ReminderMessageTemplate":     rawPlaybook.ReminderMessageTemplate,
			"ReminderTimerDefaultSeconds": rawPlaybook.ReminderTimerDefaultSeconds,
			"ConcatenatedInvitedUserIDs":  rawPlaybook.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs": rawPlaybook.ConcatenatedInvitedGroupIDs,
			"InviteUsersEnabled":          rawPlaybook.InviteUsersEnabled,
			"DefaultCommanderID":          rawPlaybook.DefaultCommanderID,
			"DefaultCommanderEnabled":     rawPlaybook.DefaultCommanderEnabled,
			"AnnouncementChannelID":       rawPlaybook.AnnouncementChannelID,
			"AnnouncementChannelEnabled":  rawPlaybook.AnnouncementChannelEnabled,
			"WebhookOnCreationURL":        rawPlaybook.WebhookOnCreationURL,
			"WebhookOnCreationEnabled":    rawPlaybook.WebhookOnCreationEnabled,
		}))
	if err != nil {
		return "", errors.Wrap(err, "failed to store new playbook")
	}

	if err = p.replacePlaybookMembers(tx, rawPlaybook.Playbook); err != nil {
		return "", errors.Wrap(err, "failed to replace playbook members")
	}

	if err = tx.Commit(); err != nil {
		return "", errors.Wrap(err, "could not commit transaction")
	}

	return rawPlaybook.ID, nil
}

// Get retrieves a playbook
func (p *playbookStore) Get(id string) (out playbook.Playbook, err error) {
	if id == "" {
		return out, errors.New("ID cannot be empty")
	}

	tx, err := p.store.db.Beginx()
	if err != nil {
		return out, errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	withChecklistsSelect := p.playbookSelect.
		Columns("ChecklistsJSON").
		From("IR_Playbook")

	var rawPlaybook sqlPlaybook
	err = p.store.getBuilder(tx, &rawPlaybook, withChecklistsSelect.Where(sq.Eq{"ID": id}))
	if err == sql.ErrNoRows {
		return out, errors.Wrapf(playbook.ErrNotFound, "playbook does not exist for id '%s'", id)
	} else if err != nil {
		return out, errors.Wrapf(err, "failed to get playbook by id '%s'", id)
	}

	if out, err = toPlaybook(rawPlaybook); err != nil {
		return out, err
	}

	var memberIDs playbookMembers
	err = p.store.selectBuilder(tx, &memberIDs, p.memberIDsSelect.Where(sq.Eq{"PlaybookID": id}))
	if err != nil && err != sql.ErrNoRows {
		return out, errors.Wrapf(err, "failed to get memberIDs for playbook with id '%s'", id)
	}

	if err = tx.Commit(); err != nil {
		return out, errors.Wrap(err, "could not commit transaction")
	}

	for _, m := range memberIDs {
		out.MemberIDs = append(out.MemberIDs, m.MemberID)
	}

	return out, nil
}

// GetPlaybooks retrieves all playbooks that are not deleted.
func (p *playbookStore) GetPlaybooks() ([]playbook.Playbook, error) {
	tx, err := p.store.db.Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	var out []playbook.Playbook
	err = p.store.selectBuilder(tx, &out, p.store.builder.
		Select("ID", "Title", "Description", "TeamID", "CreatePublicIncident", "CreateAt",
			"DeleteAt", "NumStages", "NumSteps").
		From("IR_Playbook AS p").
		Where(sq.Eq{"DeleteAt": 0}))

	if err == sql.ErrNoRows {
		return nil, errors.Wrap(playbook.ErrNotFound, "no playbooks found")
	} else if err != nil {
		return nil, errors.Wrap(err, "failed to get playbooks")
	}

	var memberIDs playbookMembers
	err = p.store.selectBuilder(tx, &memberIDs, p.memberIDsSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrapf(err, "failed to get memberIDs")
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "could not commit transaction")
	}

	addMembersToPlaybooks(memberIDs, out)

	return out, nil
}

// GetPlaybooksForTeam retrieves all playbooks on the specified team given the provided options.
func (p *playbookStore) GetPlaybooksForTeam(requesterInfo playbook.RequesterInfo, teamID string, opts playbook.Options) (playbook.GetPlaybooksResults, error) {
	correctPaginationOpts(&opts)

	var permissionsAndFilter sq.Sqlizer
	isAdmin := requesterInfo.UserIDtoIsAdmin[requesterInfo.UserID]

	if isAdmin && requesterInfo.MemberOnly || !isAdmin {
		permissionsAndFilter = p.store.builder.
			Select("1").
			Prefix("EXISTS(").
			From("IR_PlaybookMember as pm").
			Where("pm.PlaybookID = p.ID").
			Where(sq.Eq{"pm.MemberID": requesterInfo.UserID}).
			Suffix(")")
	}

	queryForResults := p.store.builder.
		Select("ID", "Title", "Description", "TeamID", "CreatePublicIncident", "CreateAt",
			"DeleteAt", "NumStages", "NumSteps").
		From("IR_Playbook AS p").
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"TeamID": teamID}).
		Where(permissionsAndFilter).
		Offset(uint64(opts.Page * opts.PerPage)).
		Limit(uint64(opts.PerPage))

	if playbook.IsValidSort(opts.Sort) && playbook.IsValidDirection(opts.Direction) {
		queryForResults = queryForResults.OrderBy(fmt.Sprintf("%s %s", sortOptionToSQL(opts.Sort), directionOptionToSQL(opts.Direction)))
	} else if playbook.IsValidSort(opts.Sort) {
		queryForResults = queryForResults.OrderBy(sortOptionToSQL(opts.Sort))
	}

	var playbooks []playbook.Playbook
	err := p.store.selectBuilder(p.store.db, &playbooks, queryForResults)
	if err == sql.ErrNoRows {
		return playbook.GetPlaybooksResults{}, errors.Wrap(playbook.ErrNotFound, "no playbooks found")
	} else if err != nil {
		return playbook.GetPlaybooksResults{}, errors.Wrap(err, "failed to get playbooks")
	}

	queryForTotal := p.store.builder.
		Select("COUNT(*)").
		From("IR_Playbook AS p").
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"TeamID": teamID}).
		Where(permissionsAndFilter)

	var total int
	if err = p.store.getBuilder(p.store.db, &total, queryForTotal); err != nil {
		return playbook.GetPlaybooksResults{}, errors.Wrap(err, "failed to get total count")
	}
	pageCount := int(math.Ceil(float64(total) / float64(opts.PerPage)))
	hasMore := opts.Page+1 < pageCount

	return playbook.GetPlaybooksResults{
		TotalCount: total,
		PageCount:  pageCount,
		HasMore:    hasMore,
		Items:      playbooks,
	}, nil
}

func (p *playbookStore) GetNumPlaybooksForTeam(teamID string) (int, error) {
	query := p.store.builder.
		Select("COUNT(*)").
		From("IR_Playbook").
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"TeamID": teamID})

	var total int
	if err := p.store.getBuilder(p.store.db, &total, query); err != nil {
		return 0, errors.Wrap(err, "failed to get number of playbooks")
	}

	return total, nil
}

// Update updates a playbook
func (p *playbookStore) Update(updated playbook.Playbook) (err error) {
	if updated.ID == "" {
		return errors.New("id should not be empty")
	}

	rawPlaybook, err := toSQLPlaybook(updated)
	if err != nil {
		return err
	}

	tx, err := p.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	_, err = p.store.execBuilder(tx, sq.
		Update("IR_Playbook").
		SetMap(map[string]interface{}{
			"Title":                       rawPlaybook.Title,
			"Description":                 rawPlaybook.Description,
			"TeamID":                      rawPlaybook.TeamID,
			"CreatePublicIncident":        rawPlaybook.CreatePublicIncident,
			"DeleteAt":                    rawPlaybook.DeleteAt,
			"ChecklistsJSON":              rawPlaybook.ChecklistsJSON,
			"NumStages":                   len(rawPlaybook.Checklists),
			"NumSteps":                    getSteps(rawPlaybook.Playbook),
			"BroadcastChannelID":          rawPlaybook.BroadcastChannelID,
			"ReminderMessageTemplate":     rawPlaybook.ReminderMessageTemplate,
			"ReminderTimerDefaultSeconds": rawPlaybook.ReminderTimerDefaultSeconds,
			"ConcatenatedInvitedUserIDs":  rawPlaybook.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs": rawPlaybook.ConcatenatedInvitedGroupIDs,
			"InviteUsersEnabled":          rawPlaybook.InviteUsersEnabled,
			"DefaultCommanderID":          rawPlaybook.DefaultCommanderID,
			"DefaultCommanderEnabled":     rawPlaybook.DefaultCommanderEnabled,
			"AnnouncementChannelID":       rawPlaybook.AnnouncementChannelID,
			"AnnouncementChannelEnabled":  rawPlaybook.AnnouncementChannelEnabled,
			"WebhookOnCreationURL":        rawPlaybook.WebhookOnCreationURL,
			"WebhookOnCreationEnabled":    rawPlaybook.WebhookOnCreationEnabled,
		}).
		Where(sq.Eq{"ID": rawPlaybook.ID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update playbook with id '%s'", rawPlaybook.ID)
	}

	if err = p.replacePlaybookMembers(tx, rawPlaybook.Playbook); err != nil {
		return errors.Wrapf(err, "failed to replace playbook members for playbook with id '%s'", rawPlaybook.ID)
	}

	if err = tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit transaction")
	}

	return nil
}

// Delete deletes a playbook.
func (p *playbookStore) Delete(id string) error {
	if id == "" {
		return errors.New("ID cannot be empty")
	}

	_, err := p.store.execBuilder(p.store.db, sq.
		Update("IR_Playbook").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"ID": id}))

	if err != nil {
		return errors.Wrapf(err, "failed to delete playbook with id '%s'", id)
	}

	return nil
}

// replacePlaybookMembers replaces the members of a playbook
func (p *playbookStore) replacePlaybookMembers(q queryExecer, pbook playbook.Playbook) error {
	// Delete existing members who are not in the new pbook.MemberIDs list
	delBuilder := sq.Delete("IR_PlaybookMember").
		Where(sq.Eq{"PlaybookID": pbook.ID}).
		Where(sq.NotEq{"MemberID": pbook.MemberIDs})
	if _, err := p.store.execBuilder(q, delBuilder); err != nil {
		return err
	}

	if len(pbook.MemberIDs) == 0 {
		return nil
	}

	insertExpr := `
INSERT INTO IR_PlaybookMember(PlaybookID, MemberID)
    SELECT ?, ?
    WHERE NOT EXISTS (
        SELECT 1 FROM IR_PlaybookMember
            WHERE PlaybookID = ? AND MemberID = ?
    );`
	if p.store.db.DriverName() == model.DATABASE_DRIVER_MYSQL {
		insertExpr = `
INSERT INTO IR_PlaybookMember(PlaybookID, MemberID)
    SELECT ?, ? FROM DUAL
    WHERE NOT EXISTS (
        SELECT 1 FROM IR_PlaybookMember
            WHERE PlaybookID = ? AND MemberID = ?
    );`
	}

	for _, m := range pbook.MemberIDs {
		rawInsert := sq.Expr(insertExpr,
			pbook.ID, m, pbook.ID, m)

		if _, err := p.store.execBuilder(q, rawInsert); err != nil {
			return err
		}
	}

	return nil
}

func addMembersToPlaybooks(memberIDs playbookMembers, out []playbook.Playbook) {
	pToM := make(map[string][]string)
	for _, m := range memberIDs {
		pToM[m.PlaybookID] = append(pToM[m.PlaybookID], m.MemberID)
	}
	for i, p := range out {
		out[i].MemberIDs = pToM[p.ID]
	}
}

func getSteps(pbook playbook.Playbook) int {
	steps := 0
	for _, p := range pbook.Checklists {
		steps += len(p.Items)
	}

	return steps
}

func toSQLPlaybook(origPlaybook playbook.Playbook) (*sqlPlaybook, error) {
	checklistsJSON, err := json.Marshal(origPlaybook.Checklists)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal checklist json for incident id: '%s'", origPlaybook.ID)
	}

	return &sqlPlaybook{
		Playbook:                    origPlaybook,
		ChecklistsJSON:              checklistsJSON,
		ConcatenatedInvitedUserIDs:  strings.Join(origPlaybook.InvitedUserIDs, ","),
		ConcatenatedInvitedGroupIDs: strings.Join(origPlaybook.InvitedGroupIDs, ","),
	}, nil
}

func toPlaybook(rawPlaybook sqlPlaybook) (playbook.Playbook, error) {
	p := rawPlaybook.Playbook
	if err := json.Unmarshal(rawPlaybook.ChecklistsJSON, &p.Checklists); err != nil {
		return playbook.Playbook{}, errors.Wrapf(err, "failed to unmarshal checklists json for playbook id: '%s'", p.ID)
	}

	p.InvitedUserIDs = []string(nil)
	if rawPlaybook.ConcatenatedInvitedUserIDs != "" {
		p.InvitedUserIDs = strings.Split(rawPlaybook.ConcatenatedInvitedUserIDs, ",")
	}

	p.InvitedGroupIDs = []string(nil)
	if rawPlaybook.ConcatenatedInvitedGroupIDs != "" {
		p.InvitedGroupIDs = strings.Split(rawPlaybook.ConcatenatedInvitedGroupIDs, ",")
	}

	return p, nil
}

func sortOptionToSQL(sort playbook.SortField) string {
	switch sort {
	case playbook.SortByTitle, "":
		return "Title"
	case playbook.SortByStages:
		return "NumStages"
	case playbook.SortBySteps:
		return "NumSteps"
	default:
		return ""
	}
}

func directionOptionToSQL(direction playbook.SortDirection) string {
	switch direction {
	case playbook.DirectionAsc, "":
		return "ASC"
	case playbook.DirectionDesc:
		return "DESC"
	default:
		return ""
	}
}

func correctPaginationOpts(opts *playbook.Options) {
	if opts.PerPage <= 0 {
		opts.PerPage = 1000
	}
	if opts.Page < 0 {
		opts.Page = 0
	}
}
