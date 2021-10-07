// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

type UserInfo struct {
	ID                string
	LastDailyTodoDMAt int64
}

type UserInfoStore interface {
	// Get retrieves a UserInfo struct by the user's userID.
	Get(userID string) (UserInfo, error)

	// Upsert inserts (creates) or updates the UserInfo in info.
	Upsert(info UserInfo) error
}
