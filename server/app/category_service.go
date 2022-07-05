package app

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

type categoryService struct {
	store CategoryStore
	api   *pluginapi.Client
}

// NewPlaybookService returns a new playbook service
func NewCategoryService(store CategoryStore, api *pluginapi.Client) CategoryService {
	return &categoryService{
		store: store,
		api:   api,
	}
}

// Create creates a new Category
func (c *categoryService) Create(category Category) (string, error) {
	if category.ID != "" {
		return "", errors.New("ID should be empty")
	}
	category.ID = model.NewId()
	category.CreateAt = model.GetMillis()
	category.UpdateAt = category.CreateAt
	if err := category.IsValid(); err != nil {
		return "", errors.Wrap(err, "invalid category")

	}

	if err := c.store.Create(category); err != nil {
		return "", errors.Wrap(err, "Can't create category")
	}
	return category.ID, nil
}

func (c *categoryService) Get(categoryID string) (Category, error) {
	category, err := c.store.Get(categoryID)
	if err != nil {
		return Category{}, errors.Wrap(err, "Can't get category")
	}
	return category, nil
}

// GetCategories retrieves all categories for user for team
func (c *categoryService) GetCategories(teamID, userID string) ([]Category, error) {
	if !model.IsValidId(teamID) {
		return nil, errors.New("teamID is not valid")
	}
	if !model.IsValidId(userID) {
		return nil, errors.New("userID is not valid")
	}
	return c.store.GetCategories(teamID, userID)
}

// Update updates a category
func (c *categoryService) Update(category Category) error {
	if category.ID == "" {
		return errors.New("id should not be empty")
	}
	if category.Name == "" {
		return errors.New("name should not be empty")
	}

	category.UpdateAt = model.GetMillis()
	if err := category.IsValid(); err != nil {
		return errors.Wrap(err, "invalid category")
	}
	if err := c.store.Update(category); err != nil {
		return errors.Wrap(err, "can't update category")
	}
	return nil
}

// Delete deletes a category
func (c *categoryService) Delete(categoryID string) error {
	if err := c.store.Delete(categoryID); err != nil {
		return errors.Wrap(err, "can't delete category")
	}

	return nil
}
