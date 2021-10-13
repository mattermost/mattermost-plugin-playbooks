// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

// DigestNotificationSettings is a separate type to make it easy to marshal/unmarshal it into JSON
// in the sqlstore. It is set by the user with the `/playbook settings digest [on/off]` slash command.
type DigestNotificationSettings struct {
	DailyDigestOff bool `json:"daily_digest_off"`
}

type UserInfo struct {
	ID                string
	LastDailyTodoDMAt int64
	DigestNotificationSettings
}

type UserInfoStore interface {
	// Get retrieves a UserInfo struct by the user's userID.
	Get(userID string) (UserInfo, error)

	// Upsert inserts (creates) or updates the UserInfo in info.
	Upsert(info UserInfo) error
}
