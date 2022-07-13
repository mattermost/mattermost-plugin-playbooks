package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

// playbookStore is a sql store for playbooks. Use NewPlaybookStore to create it.
type categoryStore struct {
	pluginAPI          PluginAPIClient
	log                bot.Logger
	store              *SQLStore
	queryBuilder       sq.StatementBuilderType
	categorySelect     sq.SelectBuilder
	categoryItemSelect sq.SelectBuilder
}

// Ensure playbookStore implements the playbook.Store interface.
var _ app.CategoryStore = (*categoryStore)(nil)

func NewCategoryStore(pluginAPI PluginAPIClient, log bot.Logger, sqlStore *SQLStore) app.CategoryStore {
	categorySelect := sqlStore.builder.
		Select(
			"c.ID",
			"c.Name",
			"c.TeamID",
			"c.UserID",
			"c.Collapsed",
			"c.CreateAt",
			"c.UpdateAt",
			"c.DeleteAt",
		).
		From("IR_Category c")

	categoryItemSelect := sqlStore.builder.
		Select(
			"ci.ItemID",
			"ci.Type",
		).
		From("IR_Category_Item ci")

	return &categoryStore{
		pluginAPI:          pluginAPI,
		log:                log,
		store:              sqlStore,
		queryBuilder:       sqlStore.builder,
		categorySelect:     categorySelect,
		categoryItemSelect: categoryItemSelect,
	}
}

// Get retrieves a Category. Returns ErrNotFound if not found.
func (c *categoryStore) Get(id string) (app.Category, error) {
	if !model.IsValidId(id) {
		return app.Category{}, errors.New("ID is not valid")
	}

	var category app.Category
	err := c.store.getBuilder(c.store.db, &category, c.categorySelect.Where(sq.Eq{"c.ID": id}))
	if err == sql.ErrNoRows {
		return app.Category{}, errors.Wrapf(app.ErrNotFound, "category does not exist for id %q", id)
	} else if err != nil {
		return app.Category{}, errors.Wrapf(err, "failed to get category by id %q", id)
	}

	items, err := c.getItems(id)
	if err != nil {
		return app.Category{}, errors.Wrapf(err, "failed to get category items by id %q", id)
	}
	category.Items = items
	return category, nil
}

func (c *categoryStore) getItems(id string) ([]app.CategoryItem, error) {
	var items []app.CategoryItem
	var playbookItems []app.CategoryItem
	queryPlaybooks := c.queryBuilder.
		Select(
			"ci.ItemID",
			"ci.Type",
			"p.title AS name",
			"p.public",
		).
		From("IR_Category_Item ci").
		LeftJoin("IR_Playbook as p on ci.ItemID=p.id").
		Where(sq.And{sq.Eq{"ci.categoryID": id}, sq.Eq{"ci.type": "p"}})
	err := c.store.selectBuilder(c.store.db, &playbookItems, queryPlaybooks)
	if err == sql.ErrNoRows {
		items = []app.CategoryItem{}
	} else if err != nil {
		return []app.CategoryItem{}, err
	} else {
		items = playbookItems
	}

	var runItems []app.CategoryItem
	queryRuns := c.queryBuilder.
		Select(
			"ci.ItemID",
			"ci.Type",
			"r.name",
		).
		From("IR_Category_Item ci").
		LeftJoin("IR_Incident as r on ci.ItemID=r.id").
		Where(sq.And{sq.Eq{"ci.categoryID": id}, sq.Eq{"ci.type": "r"}})
	err = c.store.selectBuilder(c.store.db, &runItems, queryRuns)
	if err == sql.ErrNoRows {
		return items, nil
	} else if err != nil {
		return []app.CategoryItem{}, err
	}
	items = append(items, runItems...)
	return items, nil
}

// Create creates a new Category
func (c *categoryStore) Create(category app.Category) error {
	if _, err := c.store.execBuilder(c.store.db, sq.
		Insert("IR_Category").
		SetMap(map[string]interface{}{
			"ID":        category.ID,
			"Name":      category.Name,
			"TeamID":    category.TeamID,
			"UserID":    category.UserID,
			"Collapsed": category.Collapsed,
			"CreateAt":  category.CreateAt,
			"UpdateAt":  category.UpdateAt,
		})); err != nil {
		return errors.Wrap(err, "failed to store new category")
	}

	return nil
}

// GetCategories retrieves all categories for user for team
func (c *categoryStore) GetCategories(teamID, userID string) ([]app.Category, error) {
	query := c.categorySelect.Where(sq.And{sq.Eq{"c.TeamID": teamID}, sq.Eq{"c.UserID": userID}})

	categories := []app.Category{}
	err := c.store.selectBuilder(c.store.db, &categories, query)
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(app.ErrNotFound, "no category for team id %q and user id %q", teamID, userID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get categories for team id %q and user id %q", teamID, userID)
	}
	for i, category := range categories {
		items, err := c.getItems(category.ID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get category items for category id %q", category.ID)
		}
		categories[i].Items = items
	}
	return categories, nil
}

// Update updates a category
func (c *categoryStore) Update(category app.Category) error {
	if _, err := c.store.execBuilder(c.store.db, sq.
		Update("IR_Category").
		Set("name", category.Name).
		Set("update_at", category.UpdateAt).
		Where(sq.Eq{"id": category.ID})); err != nil {
		return errors.Wrapf(err, "failed to update category with id '%s'", category.ID)
	}
	return nil
}

// Delete deletes a category
func (c *categoryStore) Delete(categoryID string) error {
	if _, err := c.store.execBuilder(c.store.db, sq.
		Update("IR_Category").
		Set("delete_at", model.GetMillis()).
		Where(sq.Eq{"id": categoryID})); err != nil {
		return errors.Wrapf(err, "failed to delete category with id '%s'", categoryID)
	}
	return nil
}
