package sqlstore

import (
	sq "github.com/Masterminds/squirrel"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

type checklistStore struct {
	pluginAPI       PluginAPIClient
	store           *SQLStore
	queryBuilder    sq.StatementBuilderType
	itemSelect      sq.SelectBuilder
	checklistSelect sq.SelectBuilder
}

type checklistWithPosition struct {
	Position      int
	PlaybookRunID string
	app.Checklist
}

type itemWithPosition struct {
	Position    int
	ChecklistID string
	app.ChecklistItem
}

// Ensure checklistStore implements the app.ChecklistStore interface.
var _ app.ChecklistStore = (*checklistStore)(nil)

// NewChecklistStore creates a new store for Checklist ServiceImpl.
func NewChecklistStore(pluginAPI PluginAPIClient, sqlStore *SQLStore) *checklistStore {
	checklistSelect := sqlStore.builder.
		Select("ch.ID", "ch.Title", "ch.Position", "ch.PlaybookRunID").
		From("IR_Checklist AS ch")
	itemSelect := sqlStore.builder.
		Select("it.ID", "it.Title", "it.State", "it.StateModified", "it.AssigneeID", "it.AssigneeModified",
			"it.Command", "it.CommandLastRun", "it.Description", "it.LastSkipped", "it.DueDate", "it.checklistID",
			"it.Position", "it.PlaybookRunID").
		From("IR_Checklist_Item AS it")
	return &checklistStore{
		pluginAPI:       pluginAPI,
		store:           sqlStore,
		queryBuilder:    sqlStore.builder,
		itemSelect:      itemSelect,
		checklistSelect: checklistSelect,
	}
}

func (c *checklistStore) GetChecklistID(playbookRunID string, checklistNumber int) (string, error) {
	query := c.queryBuilder.
		Select("ch.ID").
		From("IR_Checklist ch").
		Where(sq.And{
			sq.Eq{"ch.playbookRunID": playbookRunID},
			sq.Eq{"ch.Position": checklistNumber}})

	var checklistID string
	if err := c.store.getBuilder(c.store.db, &checklistID, query); err != nil {
		return "", errors.Wrapf(err, "can't get checklistID for playbook %s and checklistNumber %d", playbookRunID, checklistNumber)
	}

	return checklistID, nil
}
func (c *checklistStore) GetChecklistItem(playbookRunID string, checklistNumber, itemNumber int) (*app.ChecklistItem, error) {
	checklistID, err := c.GetChecklistID(playbookRunID, checklistNumber)
	if err != nil {
		return nil, errors.New("can't get checklist item id")
	}
	query := c.itemSelect.Where(sq.And{
		sq.Eq{"it.checklistID": checklistID},
		sq.Eq{"it.Position": itemNumber}})

	var checklistItem *app.ChecklistItem
	if err := c.store.getBuilder(c.store.db, &checklistItem, query); err != nil {
		return nil, errors.Wrapf(err, "can't get checklistItem for playbook run %s, checklistNumber %d and itemNumber %d", playbookRunID, checklistNumber, itemNumber)
	}

	return checklistItem, nil
}

func (c *checklistStore) getChecklistsWithoutItemsForPlaybookRunIDs(q sqlx.Queryer, playbookRunIDs []string) (map[string][]app.Checklist, int, error) {
	checklistsQuery := c.checklistSelect.Where(sq.Eq{"ch.playbookRunID": playbookRunIDs})
	var checklistsWithPosition []checklistWithPosition

	if err := c.store.selectBuilder(q, &checklistsWithPosition, checklistsQuery); err != nil {
		return nil, 0, errors.Wrap(err, "can't get checklists for playbook runs")
	}

	checklistsWithPositionPerRun := map[string][]checklistWithPosition{}
	for _, checklistWithPos := range checklistsWithPosition {
		checklistsWithPositionPerRun[checklistWithPos.PlaybookRunID] = append(checklistsWithPositionPerRun[checklistWithPos.PlaybookRunID], checklistWithPos)
	}
	checklistsPerRun := map[string][]app.Checklist{}
	checklistsNum := 0
	for runID, checklistsWithPosition := range checklistsWithPositionPerRun {
		checklists := make([]app.Checklist, len(checklistsWithPosition))
		for _, checklistWithPosition := range checklistsWithPosition {
			checklists[checklistWithPosition.Position] = checklistWithPosition.Checklist
		}
		checklistsPerRun[runID] = checklists
		checklistsNum += len(checklists)
	}

	return checklistsPerRun, checklistsNum, nil
}

func (c *checklistStore) getChecklistsForPlaybookRunIDs(q sqlx.Queryer, playbookRunIDs []string) (map[string][]app.Checklist, error) {
	checklistsPerRun, checklistsNum, err := c.getChecklistsWithoutItemsForPlaybookRunIDs(q, playbookRunIDs)
	if err != nil {
		return nil, err
	}

	checklistIDs := make([]string, 0, checklistsNum)
	for _, checklists := range checklistsPerRun {
		for _, checklist := range checklists {
			checklistIDs = append(checklistIDs, checklist.ID)
		}
	}

	itemsQuery := c.itemSelect.Where(sq.Eq{"it.checklistID": checklistIDs})
	var itemsWithPosition []itemWithPosition
	if err := c.store.selectBuilder(q, &itemsWithPosition, itemsQuery); err != nil {
		return nil, errors.Wrap(err, "can't get items for playbook runs")
	}

	checklistByItemsMap := map[string][]itemWithPosition{}
	for _, item := range itemsWithPosition {
		checklistByItemsMap[item.ChecklistID] = append(checklistByItemsMap[item.ChecklistID], item)
	}

	for _, checklists := range checklistsPerRun {
		for i, checklist := range checklists {
			items := checklistByItemsMap[checklist.ID]
			checklists[i].Items = make([]app.ChecklistItem, len(items))
			for _, item := range items {
				checklists[i].Items[item.Position] = item.ChecklistItem
			}
		}
	}

	return checklistsPerRun, nil
}

func (c *checklistStore) GetChecklistsForPlaybookRun(playbookRunID string) ([]*app.Checklist, error) {
	checklistsQuery := c.checklistSelect.Where(sq.Eq{"ch.playbookRunID": playbookRunID})
	var checklistsWithPosition []*checklistWithPosition

	if err := c.store.selectBuilder(c.store.db, &checklistsWithPosition, checklistsQuery); err != nil {
		return nil, errors.Wrapf(err, "can't get checklists for playbook run %s", playbookRunID)
	}

	checklists := make([]*app.Checklist, len(checklistsWithPosition))
	for _, checklistWithPos := range checklistsWithPosition {
		checklists[checklistWithPos.Position] = &app.Checklist{
			ID:    checklistWithPos.ID,
			Title: checklistWithPos.Title,
		}
	}
	checklistIDs := make([]string, len(checklists))
	for i := 0; i < len(checklistIDs); i++ {
		checklistIDs[i] = checklists[i].ID
	}

	itemsQuery := c.itemSelect.Where(sq.Eq{"it.checklistID": checklistIDs})
	var itemsWithPosition []*itemWithPosition
	if err := c.store.selectBuilder(c.store.db, &itemsWithPosition, itemsQuery); err != nil {
		return nil, errors.Wrapf(err, "can't get items for playbook run %s", playbookRunID)
	}

	checklistByItemsMap := map[string][]*itemWithPosition{}
	for _, item := range itemsWithPosition {
		checklistByItemsMap[item.ChecklistID] = append(checklistByItemsMap[item.ChecklistID], item)
	}
	for _, checklist := range checklists {
		items := checklistByItemsMap[checklist.ID]
		checklist.Items = make([]app.ChecklistItem, len(items))
		for _, item := range items {
			checklist.Items[item.Position] = item.ChecklistItem
		}
	}
	return checklists, nil
}

func (c *checklistStore) ModifyCheckedState(checklistItem *app.ChecklistItem, newState string) (*app.ChecklistItem, error) {
	stateModified := model.GetMillis()
	if _, err := c.store.execBuilder(c.store.db, sq.
		Update("IR_Checklist_Item AS it").
		Set("it.State", newState).
		Set("it.StateModified", stateModified).
		Where(sq.Eq{"it.ID": checklistItem.ID})); err != nil {
		return nil, errors.Errorf("can't update state of checklist item %s", checklistItem.ID)
	}
	checklistItem.State = newState
	checklistItem.StateModified = stateModified
	return checklistItem, nil
}

func (c *checklistStore) SetAssignee(checklistItem *app.ChecklistItem, assigneeID string) (*app.ChecklistItem, error) {
	assigneeModified := model.GetMillis()
	if _, err := c.store.execBuilder(c.store.db, sq.
		Update("IR_Checklist_Item AS it").
		Set("it.AssigneeID", assigneeID).
		Set("it.AssigneeModified", assigneeModified).
		Where(sq.Eq{"it.ID": checklistItem.ID})); err != nil {
		return nil, errors.Errorf("can't update assignee of checklist item %s", checklistItem.ID)
	}
	checklistItem.AssigneeID = assigneeID
	checklistItem.AssigneeModified = assigneeModified
	return checklistItem, nil
}
