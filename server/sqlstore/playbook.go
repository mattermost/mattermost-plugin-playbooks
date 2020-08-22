package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

// playbookStore is a sql store for playbooks. DO NO USE DIRECTLY Use NewPlaybookStore
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
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if pluginAPI.Store.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	playbookSelect := builder.
		Select("ID", "Title", "TeamID", "CreatePublicIncident", "CreateAt",
			"DeleteAt", "ChecklistJSON", "Stages", "Steps").
		From("IR_Playbook")

	memberIDsSelect := builder.
		Select("PlaybookID", "MemberID").
		From("IR_PlaybookMember")

	newStore := &playbookStore{
		pluginAPI:       pluginAPI,
		log:             log,
		store:           sqlStore,
		queryBuilder:    builder,
		playbookSelect:  playbookSelect,
		memberIDsSelect: memberIDsSelect,
	}
	return newStore
}

// Create creates a new playbook
func (p *playbookStore) Create(pbook playbook.Playbook) (id string, err error) {
	pbook.ID = model.NewId()

	checklistsJSON, err := checklistsToJSON(pbook)
	if err != nil {
		return "", err
	}

	// Beginning a transaction because we're doing multiple statements and need a consistent view of the db.
	tx, err := p.store.db.Beginx()
	if err != nil {
		return "", errors.Wrap(err, "could not begin transaction")
	}
	defer func() {
		cerr := tx.Rollback()
		if err == nil && cerr != sql.ErrTxDone {
			err = cerr
		}
	}()

	err = p.store.execBuilder(tx, sq.
		Insert("IR_Playbook").
		SetMap(map[string]interface{}{
			"ID":                   pbook.ID,
			"Title":                pbook.Title,
			"TeamID":               pbook.TeamID,
			"CreatePublicIncident": pbook.CreatePublicIncident,
			"CreateAt":             model.GetMillis(),
			"DeleteAt":             0,
			"ChecklistsJSON":       checklistsJSON,
			"Stages":               len(pbook.Checklists),
			"Steps":                getSteps(pbook),
		}))
	if err != nil {
		return "", errors.Wrap(err, "failed to store new playbook")
	}

	if err = p.replacePlaybookMembers(tx, pbook); err != nil {
		return "", errors.Wrap(err, "failed to replace playbook members")
	}

	if err = tx.Commit(); err != nil {
		return "", errors.Wrap(err, "could not commit transaction")
	}

	return pbook.ID, nil
}

// Get retrieves a playbook
func (p *playbookStore) Get(id string) (out playbook.Playbook, err error) {
	if id == "" {
		return out, errors.New("ID cannot be empty")
	}

	// Beginning a transaction because we're doing multiple selects and need a consistent view of the db.
	tx, err := p.store.db.Beginx()
	if err != nil {
		return out, errors.Wrap(err, "could not begin transaction")
	}
	defer func() {
		cerr := tx.Rollback()
		if err == nil && cerr != sql.ErrTxDone {
			err = cerr
		}
	}()

	err = p.store.getBuilder(tx, &out, p.playbookSelect.Where(sq.Eq{"ID": id}))
	if err == sql.ErrNoRows {
		return out, errors.Wrapf(playbook.ErrNotFound, "playbook with does not exist for id '%s'", id)
	} else if err != nil {
		return out, errors.Wrapf(err, "failed to get playbook by id '%s'", id)
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
func (p *playbookStore) GetPlaybooks() (out []playbook.Playbook, err error) {
	// Beginning a transaction because we're doing multiple selects and need a consistent view of the db.
	tx, err := p.store.db.Beginx()
	if err != nil {
		return out, errors.Wrap(err, "could not begin transaction")
	}
	defer func() {
		cerr := tx.Rollback()
		if err == nil && cerr != sql.ErrTxDone {
			err = cerr
		}
	}()

	err = p.store.selectBuilder(tx, &out, p.playbookSelect.Where(sq.Eq{"DeleteAt": 0}))
	if err == sql.ErrNoRows {
		return out, errors.Wrap(playbook.ErrNotFound, "no playbooks found")
	} else if err != nil {
		return out, errors.Wrap(err, "failed to get playbooks")
	}

	var memberIDs playbookMembers
	err = p.store.selectBuilder(tx, &memberIDs, p.memberIDsSelect)
	if err != nil && err != sql.ErrNoRows {
		return out, errors.Wrapf(err, "failed to get memberIDs")
	}

	if err = tx.Commit(); err != nil {
		return out, errors.Wrap(err, "could not commit transaction")
	}

	addMembersToPlaybooks(memberIDs, out)

	return out, nil
}

// GetPlaybooksForTeam retrieves all playbooks on the specified team given the provided options
func (p *playbookStore) GetPlaybooksForTeam(teamID string, opts playbook.Options) (out []playbook.Playbook, err error) {
	// Beginning a transaction because we're doing multiple selects and need a consistent view of the db.
	tx, err := p.store.db.Beginx()
	if err != nil {
		return out, errors.Wrap(err, "could not begin transaction")
	}
	defer func() {
		cerr := tx.Rollback()
		if err == nil && cerr != sql.ErrTxDone {
			err = cerr
		}
	}()

	query := p.playbookSelect.
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"TeamID": teamID}).
		OrderBy(fmt.Sprintf("%s %s", opts.Sort, opts.Direction))

	err = p.store.selectBuilder(tx, &out, query)
	if err == sql.ErrNoRows {
		return out, errors.Wrap(playbook.ErrNotFound, "no playbooks found")
	} else if err != nil {
		return out, errors.Wrap(err, "failed to get playbooks")
	}

	nestedQuery := p.queryBuilder.
		Select("ID").
		From("IR_Playbook").
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"TeamID": teamID})

	// TODO: Alejandro, this should work, but I'm eyeballing it:
	// And this is why SQL is awesome
	query = p.memberIDsSelect.Where(nestedQuery.Prefix("PlaybookID IN (").Suffix(")"))

	var memberIDs playbookMembers
	err = p.store.selectBuilder(tx, &memberIDs, query)
	if err != nil && err != sql.ErrNoRows {
		return out, errors.Wrapf(err, "failed to get memberIDs")
	}

	if err = tx.Commit(); err != nil {
		return out, errors.Wrap(err, "could not commit transaction")
	}

	addMembersToPlaybooks(memberIDs, out)

	return out, nil
}

// Update updates a playbook
func (p *playbookStore) Update(updated playbook.Playbook) (err error) {
	if updated.ID == "" {
		return errors.New("updating playbook without ID")
	}

	checklistsJSON, err := checklistsToJSON(updated)
	if err != nil {
		return err
	}

	// Beginning a transaction because we're doing multiple statements and need a consistent view of the db.
	tx, err := p.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer func() {
		cerr := tx.Rollback()
		if err == nil && cerr != sql.ErrTxDone {
			err = cerr
		}
	}()

	err = p.store.execBuilder(tx, sq.
		Update("IR_Playbook").
		SetMap(map[string]interface{}{
			"Title":                updated.Title,
			"TeamID":               updated.TeamID,
			"CreatePublicIncident": updated.CreatePublicIncident,
			"DeleteAt":             updated.DeleteAt,
			"ChecklistsJSON":       checklistsJSON,
			"Stages":               len(updated.Checklists),
			"Steps":                getSteps(updated),
		}).
		Where(sq.Eq{"ID": updated.ID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update playbook with id '%s'", updated.ID)
	}

	if err = p.replacePlaybookMembers(tx, updated); err != nil {
		return errors.Wrapf(err, "failed to replace playbook members for playbook with id '%s'", updated.ID)
	}

	if err = tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit transaction")
	}

	return nil
}

// Delete deletes a playbook.
// TODO: is this what we want to do now? (Never delete, just set deleteAt?)
func (p *playbookStore) Delete(id string) error {
	pbook, err := p.Get(id)
	if err != nil {
		return err
	}

	pbook.DeleteAt = model.GetMillis()

	return p.Update(pbook)
}

func checklistsToJSON(pbook playbook.Playbook) (json.RawMessage, error) {
	for _, c := range pbook.Checklists {
		if c.ID == "" {
			c.ID = model.NewId()
		}
		for _, i := range c.Items {
			if i.ID == "" {
				i.ID = model.NewId()
			}
		}
	}

	checklistsJSON, err := json.Marshal(pbook.Checklists)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal checklist json for playbook id: '%s'", pbook.ID)
	}

	return checklistsJSON, nil
}

// replacePlaybookMembers replaces (updates or inserts) the members of a playbook
func (p *playbookStore) replacePlaybookMembers(e execer, pbook playbook.Playbook) error {
	builder := sq.Replace("IR_PlaybookMember").
		Columns("PlaybookID", "MemberID")

	for _, m := range pbook.MemberIDs {
		builder.Values(pbook.ID, m)
	}

	return p.store.execBuilder(e, builder)
}

func addMembersToPlaybooks(memberIDs playbookMembers, out []playbook.Playbook) {
	pToM := make(map[string][]string)
	for _, m := range memberIDs {
		pToM[m.PlaybookID] = append(pToM[m.PlaybookID], m.MemberID)
	}
	for _, p := range out {
		p.MemberIDs = pToM[p.ID]
	}
}

func getSteps(pbook playbook.Playbook) int {
	steps := 0
	for _, p := range pbook.Checklists {
		steps += len(p.Items)
	}
	return steps
}
