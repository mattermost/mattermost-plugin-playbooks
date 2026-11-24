// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func requireStateChange(t *testing.T, change ChecklistItemStateChange, itemID, fromState, toState string, changedAt int64) {
	t.Helper()

	assert.Equal(t, "run1", change.RunID)
	assert.Equal(t, "checklist1", change.ChecklistID)
	assert.Equal(t, itemID, change.ItemID)
	assert.Equal(t, fromState, change.FromState)
	assert.Equal(t, toState, change.ToState)
	assert.Equal(t, "user1", change.UserID)
	assert.Equal(t, changedAt, change.ChangedAt)
}

func newTaskStateServiceWithItems(t *testing.T, items ...ChecklistItem) taskStateService {
	t.Helper()

	h := newTaskStateService(t, items[0])
	h.store.run.Checklists[0].Items = items
	return h
}

func itemWithState(id, state string) ChecklistItem {
	item := openItem()
	item.ID = id
	item.State = state
	return item
}

func TestModifyCheckedStateRecordsStateChanges(t *testing.T) {
	t.Run("each transition is kept with the state it left", func(t *testing.T) {
		h := newTaskStateService(t, openItem())

		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateInProgress, 0, 0))
		started := h.store.item().StateModified
		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateClosed, 0, 0))
		closed := h.store.item().StateModified
		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateOpen, 0, 0))
		reopened := h.store.item().StateModified

		require.Len(t, h.store.stateChanges, 3, "StateModified only keeps the last change; the log must keep all of them")
		requireStateChange(t, h.store.stateChanges[0], "item1", ChecklistItemStateOpen, ChecklistItemStateInProgress, started)
		requireStateChange(t, h.store.stateChanges[1], "item1", ChecklistItemStateInProgress, ChecklistItemStateClosed, closed)
		requireStateChange(t, h.store.stateChanges[2], "item1", ChecklistItemStateClosed, ChecklistItemStateOpen, reopened)
	})

	t.Run("setting the current state records nothing", func(t *testing.T) {
		h := newTaskStateService(t, openItem())

		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateOpen, 0, 0))

		assert.Empty(t, h.store.stateChanges)
	})
}

func TestSkipAndRestoreChecklistItemRecordStateChanges(t *testing.T) {
	h := newTaskStateService(t, itemWithState("item1", ChecklistItemStateClosed))

	require.NoError(t, h.svc.SkipChecklistItem("run1", "user1", 0, 0))
	skipped := h.store.item().StateModified
	require.NoError(t, h.svc.RestoreChecklistItem("run1", "user1", 0, 0))
	restored := h.store.item().StateModified

	require.Len(t, h.store.stateChanges, 2)
	requireStateChange(t, h.store.stateChanges[0], "item1", ChecklistItemStateClosed, ChecklistItemStateSkipped, skipped)
	requireStateChange(t, h.store.stateChanges[1], "item1", ChecklistItemStateSkipped, ChecklistItemStateOpen, restored)
}

func TestSkipChecklistRecordsStateChanges(t *testing.T) {
	h := newTaskStateServiceWithItems(t,
		itemWithState("open", ChecklistItemStateOpen),
		itemWithState("closed", ChecklistItemStateClosed),
		itemWithState("skipped", ChecklistItemStateSkipped),
	)

	require.NoError(t, h.svc.SkipChecklist("run1", "user1", 0))

	items := h.store.run.Checklists[0].Items
	for _, item := range items {
		assert.Equal(t, ChecklistItemStateSkipped, item.State)
	}
	skippedAt := items[0].StateModified
	assert.NotEqual(t, int64(1000), skippedAt)
	assert.Equal(t, skippedAt, items[1].StateModified)
	assert.Equal(t, int64(1000), items[2].StateModified, "an item that was already skipped did not change state")

	require.Len(t, h.store.stateChanges, 2)
	requireStateChange(t, h.store.stateChanges[0], "open", ChecklistItemStateOpen, ChecklistItemStateSkipped, skippedAt)
	requireStateChange(t, h.store.stateChanges[1], "closed", ChecklistItemStateClosed, ChecklistItemStateSkipped, skippedAt)
}

func TestRestoreChecklistRecordsStateChanges(t *testing.T) {
	h := newTaskStateServiceWithItems(t,
		itemWithState("skipped", ChecklistItemStateSkipped),
		itemWithState("closed", ChecklistItemStateClosed),
		itemWithState("open", ChecklistItemStateOpen),
	)

	require.NoError(t, h.svc.RestoreChecklist("run1", "user1", 0))

	items := h.store.run.Checklists[0].Items
	for _, item := range items {
		assert.Equal(t, ChecklistItemStateOpen, item.State)
	}
	restoredAt := items[0].StateModified
	assert.NotEqual(t, int64(1000), restoredAt)
	assert.Equal(t, int64(1000), items[2].StateModified, "an item that was already open did not change state")

	require.Len(t, h.store.stateChanges, 2)
	requireStateChange(t, h.store.stateChanges[0], "skipped", ChecklistItemStateSkipped, ChecklistItemStateOpen, restoredAt)
	requireStateChange(t, h.store.stateChanges[1], "closed", ChecklistItemStateClosed, ChecklistItemStateOpen, restoredAt)
}

func TestTaskStateChangesRacingOtherWrites(t *testing.T) {
	t.Run("a change that loses a race is applied again on top of the other write", func(t *testing.T) {
		h := newTaskStateServiceWithItems(t, itemWithState("item1", ChecklistItemStateOpen), itemWithState("item2", ChecklistItemStateOpen))
		h.store.races = 1
		h.store.raceWrite = func(run *PlaybookRun) {
			run.Checklists[0].Items[1].State = ChecklistItemStateClosed
		}

		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateClosed, 0, 0))

		assert.Equal(t, ChecklistItemStateClosed, h.store.run.Checklists[0].Items[0].State)
		assert.Equal(t, ChecklistItemStateClosed, h.store.run.Checklists[0].Items[1].State, "the other write must not be lost")
		require.Len(t, h.store.stateChanges, 1)
	})

	t.Run("a retry after the tasks were reordered changes the task the user picked", func(t *testing.T) {
		h := newTaskStateServiceWithItems(t, itemWithState("item1", ChecklistItemStateInProgress), itemWithState("item2", ChecklistItemStateInProgress))
		h.store.races = 1
		h.store.raceWrite = func(run *PlaybookRun) {
			items := run.Checklists[0].Items
			items[0], items[1] = items[1], items[0]
		}

		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateBlocked, 0, 0, ModifyCheckedStateOptions{BlockedReason: "Waiting on legal"}))

		items := h.store.run.Checklists[0].Items
		assert.Equal(t, "item2", items[0].ID)
		assert.Equal(t, ChecklistItemStateInProgress, items[0].State)
		assert.Empty(t, items[0].BlockedReason)
		assert.Equal(t, ChecklistItemStateBlocked, items[1].State)
		assert.Equal(t, "Waiting on legal", items[1].BlockedReason)
		require.Len(t, h.store.stateChanges, 1)
		assert.Equal(t, "item1", h.store.stateChanges[0].ItemID)
	})

	t.Run("a retry fails when the task the user picked was removed", func(t *testing.T) {
		h := newTaskStateServiceWithItems(t, itemWithState("item1", ChecklistItemStateOpen), itemWithState("item2", ChecklistItemStateOpen))
		h.store.races = 1
		h.store.raceWrite = func(run *PlaybookRun) {
			run.Checklists[0].Items = run.Checklists[0].Items[1:]
		}

		err := h.svc.SkipChecklistItem("run1", "user1", 0, 0)

		assert.ErrorIs(t, err, ErrNotFound)
		assert.Equal(t, ChecklistItemStateOpen, h.store.item().State, "the task now first in the list must be left alone")
		assert.Empty(t, h.store.stateChanges)
	})

	t.Run("gives up when the run keeps changing", func(t *testing.T) {
		h := newTaskStateService(t, itemWithState("item1", ChecklistItemStateOpen))
		h.store.races = maxRunChangedAttempts

		err := h.svc.SkipChecklistItem("run1", "user1", 0, 0)

		assert.ErrorIs(t, err, ErrPlaybookRunChanged)
		assert.Empty(t, h.store.stateChanges)
		assert.Equal(t, ChecklistItemStateOpen, h.store.item().State)
	})
}

func TestTaskStateChangesOnRunsWithoutItemIDs(t *testing.T) {
	h := newTaskStateService(t, itemWithState("", ChecklistItemStateOpen))
	h.store.run.Checklists[0].ID = ""

	require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateInProgress, 0, 0))

	require.Len(t, h.store.stateChanges, 1)
	assert.True(t, model.IsValidId(h.store.stateChanges[0].ItemID))
	assert.Equal(t, h.store.item().ID, h.store.stateChanges[0].ItemID, "the change must be recorded under the ID stored on the item")
	assert.Equal(t, h.store.run.Checklists[0].ID, h.store.stateChanges[0].ChecklistID)
}
