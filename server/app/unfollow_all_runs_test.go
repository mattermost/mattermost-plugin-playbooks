// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestPlaybookRunServiceUnfollowAllRuns(t *testing.T) {
	t.Run("delegates to store", func(t *testing.T) {
		store := &stubRunStoreGetOnly{}
		service := &PlaybookRunServiceImpl{store: store}

		err := service.UnfollowAllRuns("user-id")
		require.NoError(t, err)
		require.Equal(t, "user-id", store.unfollowAllRunsUserID)
		require.Equal(t, 1, store.unfollowAllRunsCallNum)
	})

	t.Run("wraps store errors", func(t *testing.T) {
		store := &stubRunStoreGetOnly{unfollowAllRunsErr: errors.New("store unavailable")}
		service := &PlaybookRunServiceImpl{store: store}

		err := service.UnfollowAllRuns("user-id")
		require.Error(t, err)
		require.ErrorContains(t, err, "user `user-id` failed to unfollow all runs")
		require.ErrorContains(t, err, "store unavailable")
		require.Equal(t, "user-id", store.unfollowAllRunsUserID)
		require.Equal(t, 1, store.unfollowAllRunsCallNum)
	})
}
