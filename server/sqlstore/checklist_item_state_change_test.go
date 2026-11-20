// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestChecklistItemStateChanges(t *testing.T) {
	db := setupTestDB(t)
	store := setupPlaybookRunStore(t, db)

	createRun := func(t *testing.T) *app.PlaybookRun {
		t.Helper()
		run, err := store.CreatePlaybookRun(NewBuilder(t).WithChecklists([]int{2}).ToPlaybookRun())
		require.NoError(t, err)
		return run
	}

	changeFor := func(run *app.PlaybookRun, itemIndex int, from, to string, at int64) app.ChecklistItemStateChange {
		return app.ChecklistItemStateChange{
			RunID:       run.ID,
			ChecklistID: run.Checklists[0].ID,
			ItemID:      run.Checklists[0].Items[itemIndex].ID,
			FromState:   from,
			ToState:     to,
			UserID:      "user1",
			ChangedAt:   at,
		}
	}

	t.Run("run update and state changes are written together and read back oldest first", func(t *testing.T) {
		run := createRun(t)
		run.Checklists[0].Items[0].State = app.ChecklistItemStateClosed

		_, err := store.UpdatePlaybookRunWithStateChanges(run, []app.ChecklistItemStateChange{
			changeFor(run, 0, app.ChecklistItemStateInProgress, app.ChecklistItemStateClosed, 2000),
			changeFor(run, 0, app.ChecklistItemStateOpen, app.ChecklistItemStateInProgress, 1000),
		})
		require.NoError(t, err)

		updated, err := store.GetPlaybookRun(run.ID)
		require.NoError(t, err)
		assert.Equal(t, app.ChecklistItemStateClosed, updated.Checklists[0].Items[0].State)

		changes, err := store.GetChecklistItemStateChanges(run.ID)
		require.NoError(t, err)
		require.Len(t, changes, 2)
		assert.Equal(t, int64(1000), changes[0].ChangedAt)
		assert.Equal(t, int64(2000), changes[1].ChangedAt)

		expected := changeFor(run, 0, app.ChecklistItemStateOpen, app.ChecklistItemStateInProgress, 1000)
		assert.NotEmpty(t, changes[0].ID)
		expected.ID = changes[0].ID
		assert.Equal(t, expected, changes[0])
	})

	t.Run("a rejected state change rolls back the run update", func(t *testing.T) {
		run := createRun(t)
		other := createRun(t)
		run.Checklists[0].Items[0].State = app.ChecklistItemStateClosed

		_, err := store.UpdatePlaybookRunWithStateChanges(run, []app.ChecklistItemStateChange{
			changeFor(run, 0, app.ChecklistItemStateOpen, app.ChecklistItemStateClosed, 1000),
			changeFor(other, 0, app.ChecklistItemStateOpen, app.ChecklistItemStateClosed, 1000),
		})
		require.Error(t, err)

		unchanged, err := store.GetPlaybookRun(run.ID)
		require.NoError(t, err)
		assert.Equal(t, app.ChecklistItemStateOpen, unchanged.Checklists[0].Items[0].State)

		changes, err := store.GetChecklistItemStateChanges(run.ID)
		require.NoError(t, err)
		assert.Empty(t, changes)
	})

	t.Run("changes are scoped to their run", func(t *testing.T) {
		run := createRun(t)
		other := createRun(t)

		_, err := store.UpdatePlaybookRunWithStateChanges(run, []app.ChecklistItemStateChange{
			changeFor(run, 1, app.ChecklistItemStateOpen, app.ChecklistItemStateSkipped, 1000),
		})
		require.NoError(t, err)
		_, err = store.UpdatePlaybookRun(other)
		require.NoError(t, err)

		changes, err := store.GetChecklistItemStateChanges(run.ID)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		assert.Equal(t, run.Checklists[0].Items[1].ID, changes[0].ItemID)

		changes, err = store.GetChecklistItemStateChanges(other.ID)
		require.NoError(t, err)
		assert.Empty(t, changes)
	})

	t.Run("who a task is blocked by is kept and changes can be read for many runs", func(t *testing.T) {
		run := createRun(t)
		other := createRun(t)
		blocked := changeFor(run, 0, app.ChecklistItemStateInProgress, app.ChecklistItemStateBlocked, 1000)
		blocked.BlockedReason = "Waiting on legal"
		blocked.BlockedByUserIDs = []string{"user2", "user3"}

		_, err := store.UpdatePlaybookRunWithStateChanges(run, []app.ChecklistItemStateChange{blocked})
		require.NoError(t, err)
		_, err = store.UpdatePlaybookRunWithStateChanges(other, []app.ChecklistItemStateChange{
			changeFor(other, 0, app.ChecklistItemStateOpen, app.ChecklistItemStateClosed, 2000),
		})
		require.NoError(t, err)

		byRun, err := store.GetChecklistItemStateChangesForRuns([]string{run.ID, other.ID})
		require.NoError(t, err)
		require.Len(t, byRun[run.ID], 1)
		require.Len(t, byRun[other.ID], 1)
		assert.Equal(t, []string{"user2", "user3"}, byRun[run.ID][0].BlockedByUserIDs)
		assert.Empty(t, byRun[other.ID][0].BlockedByUserIDs)

		empty, err := store.GetChecklistItemStateChangesForRuns(nil)
		require.NoError(t, err)
		assert.Empty(t, empty)
	})
}
