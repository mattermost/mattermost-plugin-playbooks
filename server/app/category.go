package app

import (
	"errors"
	"strings"
)

type CategoryItemType string

const (
	PlaybookItemType CategoryItemType = "p"
	RunItemType      CategoryItemType = "r"
)

type CategoryItem struct {
	ItemID string           `json:"item_id"`
	Type   CategoryItemType `json:"type"`
}

// Category represents sidebar category with items
type Category struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	TeamID    string         `json:"team_id"`
	UserID    string         `json:"user_id"`
	Collapsed bool           `json:"collapsed"`
	CreateAt  int64          `json:"create_at"`
	UpdateAt  int64          `json:"update_at"`
	DeleteAt  int64          `json:"delete_at"`
	Items     []CategoryItem `json:"items"`
}

func (c *Category) IsValid() error {
	if strings.TrimSpace(c.ID) == "" {
		return errors.New("category ID cannot be empty")
	}

	if strings.TrimSpace(c.Name) == "" {
		return errors.New("category name cannot be empty")
	}

	if strings.TrimSpace(c.UserID) == "" {
		return errors.New("category user ID cannot be empty")
	}

	if strings.TrimSpace(c.TeamID) == "" {
		return errors.New("category team id ID cannot be empty")
	}

	for _, item := range c.Items {
		if item.ItemID == "" {
			return errors.New("item ID cannot be empty")
		}
		if item.Type != PlaybookItemType && item.Type != RunItemType {
			return errors.New("item type is incorrect")
		}
	}

	return nil
}

// CategoryService is the category service for managing categories
type CategoryService interface {
	// Create creates a new Category
	Create(category Category) (string, error)

	// Get retrieves category with categoryID for user for team
	Get(categoryID string) (Category, error)

	// GetCategories retrieves all categories for user for team
	GetCategories(teamID, userID string) ([]Category, error)

	// Update updates a category
	Update(category Category) error

	// Delete deletes a category
	Delete(categoryID string) error
}

type CategoryStore interface {
	// Get retrieves a Category. Returns ErrNotFound if not found.
	Get(id string) (Category, error)

	// Create creates a new Category
	Create(category Category) error

	// GetCategories retrieves all categories for user for team
	GetCategories(teamID, userID string) ([]Category, error)

	// Update updates a category
	Update(category Category) error

	// Delete deletes a category
	Delete(categoryID string) error
}
