// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

type ReminderResetPayload struct {
	NewReminderSeconds int `json:"new_reminder_seconds"`
}
