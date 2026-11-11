// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore/mocks"
)

func setupCategoryStore(t *testing.T, db *sqlx.DB) app.CategoryStore {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	sqlStore := setupSQLStore(t, db)

	return NewCategoryStore(pluginAPIClient, sqlStore)
}

func TestCategories(t *testing.T) {
	db := setupTestDB(t)
	_ = setupSQLStore(t, db)
	categoryStore := setupCategoryStore(t, db)

	t.Run("create category, add items, get category", func(t *testing.T) {
		userID1 := model.NewId()
		teamID1 := model.NewId()
		categoryID1 := model.NewId()

		itemID1 := model.NewId()
		itemID2 := model.NewId()

		err := categoryStore.Create(app.Category{
			ID:        categoryID1,
			Name:      "cat1",
			TeamID:    teamID1,
			UserID:    userID1,
			Collapsed: false,
			CreateAt:  100,
			UpdateAt:  100,
		})
		require.NoError(t, err)

		err = categoryStore.AddItemToCategory(app.CategoryItem{ItemID: itemID1, Type: "p"}, categoryID1)
		require.NoError(t, err)

		cat, err := categoryStore.Get(categoryID1)
		require.NoError(t, err)

		require.Len(t, cat.Items, 1)

		err = categoryStore.AddItemToCategory(app.CategoryItem{ItemID: itemID2, Type: "r"}, categoryID1)
		require.NoError(t, err)

		cat, err = categoryStore.Get(categoryID1)
		require.NoError(t, err)

		require.Len(t, cat.Items, 2)
	})

	t.Run("create category, delete category, get category", func(t *testing.T) {
		userID1 := model.NewId()
		teamID1 := model.NewId()
		categoryID1 := model.NewId()

		err := categoryStore.Create(app.Category{
			ID:        categoryID1,
			Name:      "cat1",
			TeamID:    teamID1,
			UserID:    userID1,
			Collapsed: false,
			CreateAt:  100,
			UpdateAt:  100,
		})
		require.NoError(t, err)

		err = categoryStore.Delete(categoryID1)
		require.NoError(t, err)

		cat, err := categoryStore.Get(categoryID1)
		require.NoError(t, err)
		require.NotEqual(t, cat.DeleteAt, 0)
	})

	t.Run("create category, update category, get category", func(t *testing.T) {
		userID1 := model.NewId()
		teamID1 := model.NewId()
		categoryID1 := model.NewId()

		myCategory := app.Category{
			ID:        categoryID1,
			Name:      "cat1",
			TeamID:    teamID1,
			UserID:    userID1,
			Collapsed: false,
			CreateAt:  100,
			UpdateAt:  100,
		}
		err := categoryStore.Create(myCategory)
		require.NoError(t, err)

		myCategory.Name = "cat2"
		err = categoryStore.Update(myCategory)
		require.NoError(t, err)

		cat, err := categoryStore.Get(categoryID1)
		require.NoError(t, err)
		require.Equal(t, cat.Name, "cat2")
	})
}

func TestGetFavoriteCategoryReturnsLookupError(t *testing.T) {
	db := setupTestDB(t)
	categoryStore := setupCategoryStore(t, db)
	service := app.NewCategoryService(categoryStore, nil)

	teamID := model.NewId()
	userID := model.NewId()
	item := app.CategoryItem{ItemID: model.NewId(), Type: app.PlaybookItemType}

	t.Run("missing favorite category is not favorited", func(t *testing.T) {
		_, err := categoryStore.GetFavoriteCategory(teamID, userID)
		require.ErrorIs(t, err, sql.ErrNoRows)

		isFav, err := service.IsItemFavorite(item, teamID, userID)
		require.NoError(t, err)
		require.False(t, isFav)
	})

	t.Run("database error is not treated as not favorited", func(t *testing.T) {
		_, err := db.Exec(`ALTER TABLE IR_Category RENAME TO IR_Category_lookup_broken`)
		require.NoError(t, err)

		_, err = categoryStore.GetFavoriteCategory(teamID, userID)
		require.Error(t, err)
		require.NotErrorIs(t, err, sql.ErrNoRows)

		isFav, err := service.IsItemFavorite(item, teamID, userID)
		require.Error(t, err)
		require.False(t, isFav)
	})
}
