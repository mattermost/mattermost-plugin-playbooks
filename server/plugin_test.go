// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type recordingRunFollowerCleaner struct {
	userIDs []string
	err     error
}

func (r *recordingRunFollowerCleaner) UnfollowAllRuns(userID string) error {
	r.userIDs = append(r.userIDs, userID)
	return r.err
}

func TestUnfollowAllRunsForDeactivatedUser(t *testing.T) {
	t.Run("nil user does nothing", func(t *testing.T) {
		cleaner := &recordingRunFollowerCleaner{}

		err := unfollowAllRunsForDeactivatedUser(cleaner, nil)
		require.NoError(t, err)
		require.Empty(t, cleaner.userIDs)
	})

	t.Run("unfollows deactivated user", func(t *testing.T) {
		cleaner := &recordingRunFollowerCleaner{}
		user := &model.User{Id: "user-id"}

		err := unfollowAllRunsForDeactivatedUser(cleaner, user)
		require.NoError(t, err)
		require.Equal(t, []string{"user-id"}, cleaner.userIDs)
	})

	t.Run("returns cleaner error", func(t *testing.T) {
		cleaner := &recordingRunFollowerCleaner{err: errors.New("store unavailable")}
		user := &model.User{Id: "user-id"}

		err := unfollowAllRunsForDeactivatedUser(cleaner, user)
		require.Error(t, err)
		require.ErrorContains(t, err, "store unavailable")
		require.Equal(t, []string{"user-id"}, cleaner.userIDs)
	})
}
