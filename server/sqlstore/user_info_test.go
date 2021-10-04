// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"reflect"
	"testing"

	"github.com/pkg/errors"

	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"

	sq "github.com/Masterminds/squirrel"
	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func Test_userInfoStore_Get(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		userInfoStore := setupUserInfoStore(t, db)

		t.Run("gets existing userInfo correctly", func(t *testing.T) {
			expected := app.UserInfo{
				ID:                model.NewId(),
				LastDailyTodoDMAt: 12345678,
			}
			err := userInfoStore.Upsert(expected)
			require.NoError(t, err)

			actual, err := userInfoStore.Get(expected.ID)
			require.NoError(t, err)

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}
		})

		t.Run("gets non-existing userInfo correctly", func(t *testing.T) {
			expected := app.UserInfo{}
			actual, err := userInfoStore.Get(model.NewId())
			require.Error(t, err)
			require.True(t, errors.Is(err, app.ErrNotFound))
			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}
		})
	}
}

func Test_userInfoStore_Upsert(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		userInfoStore := setupUserInfoStore(t, db)

		t.Run("inserts userInfo correctly", func(t *testing.T) {
			userID := model.NewId()
			expected := app.UserInfo{}

			// assert doesn't exist yet:
			actual, err := userInfoStore.Get(expected.ID)
			require.Error(t, err)
			require.True(t, errors.Is(err, app.ErrNotFound))
			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}

			// insert:
			expected = app.UserInfo{
				ID:                userID,
				LastDailyTodoDMAt: 12345678,
			}

			err = userInfoStore.Upsert(expected)
			require.NoError(t, err)

			actual, err = userInfoStore.Get(expected.ID)
			require.NoError(t, err)

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}
		})

		t.Run("upserts userInfo correctly", func(t *testing.T) {
			expected := app.UserInfo{
				ID:                model.NewId(),
				LastDailyTodoDMAt: 12345678,
			}

			// insert:
			err := userInfoStore.Upsert(expected)
			require.NoError(t, err)

			actual, err := userInfoStore.Get(expected.ID)
			require.NoError(t, err)

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}

			// update:
			expected.LastDailyTodoDMAt = 48102939451
			err = userInfoStore.Upsert(expected)
			require.NoError(t, err)

			actual, err = userInfoStore.Get(expected.ID)
			require.NoError(t, err)

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}
		})
	}
}

func setupUserInfoStore(t *testing.T, db *sqlx.DB) app.UserInfoStore {
	sqlStore := setupSQLStoreForUserInfo(t, db)

	return NewUserInfoStore(sqlStore)
}

func setupSQLStoreForUserInfo(t *testing.T, db *sqlx.DB) *SQLStore {
	t.Helper()

	mockCtrl := gomock.NewController(t)
	logger := mock_bot.NewMockLogger(mockCtrl)

	driverName := db.DriverName()

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if driverName == model.DatabaseDriverPostgres {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	sqlStore := &SQLStore{
		logger,
		db,
		builder,
	}

	logger.EXPECT().Debugf(gomock.AssignableToTypeOf("string")).Times(2)

	currentSchemaVersion, err := sqlStore.GetCurrentVersion()
	require.NoError(t, err)

	setupChannelsTable(t, db)
	setupPostsTable(t, db)
	setupKVStoreTable(t, db)

	if currentSchemaVersion.LT(LatestVersion()) {
		err = sqlStore.Migrate(currentSchemaVersion)
		require.NoError(t, err)
	}

	return sqlStore
}
