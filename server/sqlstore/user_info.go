// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost-server/v6/model"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/pkg/errors"
)

type userInfoStore struct {
	store          *SQLStore
	queryBuilder   sq.StatementBuilderType
	userInfoSelect sq.SelectBuilder
}

// Ensure userInfoStore implements the userInfo.Store interface
var _ app.UserInfoStore = (*userInfoStore)(nil)

func NewUserInfoStore(sqlStore *SQLStore) app.UserInfoStore {
	userInfoSelect := sqlStore.builder.
		Select("ID", "LastDailyTodoDMAt").
		From("IR_UserInfo")

	newStore := &userInfoStore{
		store:          sqlStore,
		queryBuilder:   sqlStore.builder,
		userInfoSelect: userInfoSelect,
	}
	return newStore
}

// Get retrieves a UserInfo struct by the user's userID.
func (s *userInfoStore) Get(userID string) (app.UserInfo, error) {
	var info app.UserInfo
	err := s.store.getBuilder(s.store.db, &info, s.userInfoSelect.Where(sq.Eq{"ID": userID}))
	if err == sql.ErrNoRows {
		return app.UserInfo{}, errors.Wrapf(app.ErrNotFound, "userInfo does not exist for userId '%s'", userID)
	} else if err != nil {
		return app.UserInfo{}, errors.Wrapf(err, "failed to get userInfo by userId '%s'", userID)
	}

	return info, nil
}

// Upsert inserts (creates) or updates the UserInfo in info.
func (s *userInfoStore) Upsert(info app.UserInfo) error {
	if info.ID == "" {
		return errors.New("ID should not be empty")
	}

	var err error
	if s.store.db.DriverName() == model.DatabaseDriverMysql {
		_, err = s.store.execBuilder(s.store.db,
			sq.Insert("IR_UserInfo").
				Columns("ID", "LastDailyTodoDMAt").
				Values(info.ID, info.LastDailyTodoDMAt).
				Suffix("ON DUPLICATE KEY UPDATE LastDailyTodoDMAt = ?", info.LastDailyTodoDMAt))

	} else {
		_, err = s.store.execBuilder(s.store.db,
			sq.Insert("IR_UserInfo").
				Columns("ID", "LastDailyTodoDMAt").
				Values(info.ID, info.LastDailyTodoDMAt).
				Suffix("ON CONFLICT (ID) DO UPDATE SET LastDailyTodoDMAt = ?", info.LastDailyTodoDMAt))
	}

	if err != nil {
		return errors.Wrapf(err, "failed to upsert userInfo with id '%s'", info.ID)
	}

	return nil
}
