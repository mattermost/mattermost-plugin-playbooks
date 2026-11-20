// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func timingRun(itemIDs ...string) *PlaybookRun {
	items := make([]ChecklistItem, len(itemIDs))
	for i, id := range itemIDs {
		items[i] = ChecklistItem{ID: id}
	}
	return &PlaybookRun{
		CreateAt:   1000,
		Checklists: []Checklist{{ID: "checklist1", Items: items}},
	}
}

func change(itemID, from, to string, at int64) ChecklistItemStateChange {
	return ChecklistItemStateChange{ChecklistID: "checklist1", ItemID: itemID, FromState: from, ToState: to, ChangedAt: at}
}

func itemTiming(t *testing.T, timing RunTiming, itemID string) ChecklistItemTiming {
	t.Helper()
	for _, item := range timing.Items {
		if item.ItemID == itemID {
			return item
		}
	}
	require.Failf(t, "missing item timing", "no timing for %s", itemID)
	return ChecklistItemTiming{}
}

func TestComputeRunTiming(t *testing.T) {
	const (
		open    = ChecklistItemStateOpen
		started = ChecklistItemStateInProgress
		blocked = ChecklistItemStateBlocked
		closed  = ChecklistItemStateClosed
	)

	t.Run("start and finish are the first time each happened", func(t *testing.T) {
		timing := ComputeRunTiming(timingRun("a"), []ChecklistItemStateChange{
			change("a", open, started, 2000),
			change("a", started, closed, 5000),
			change("a", closed, open, 6000),
			change("a", open, started, 7000),
			change("a", started, closed, 9000),
		}, 10000)

		a := itemTiming(t, timing, "a")
		assert.Equal(t, int64(2000), a.StartedAt)
		assert.Equal(t, int64(5000), a.FinishedAt)
		assert.True(t, a.Reopened)
		assert.Equal(t, "checklist1", a.ChecklistID)
	})

	t.Run("a task checked off without starting has no start time", func(t *testing.T) {
		timing := ComputeRunTiming(timingRun("a"), []ChecklistItemStateChange{
			change("a", open, closed, 3000),
		}, 10000)

		a := itemTiming(t, timing, "a")
		assert.Zero(t, a.StartedAt)
		assert.Equal(t, int64(3000), a.FinishedAt)
		assert.False(t, a.Reopened)
	})

	t.Run("blocked time adds up across blocks and counts the open block to now", func(t *testing.T) {
		timing := ComputeRunTiming(timingRun("a"), []ChecklistItemStateChange{
			change("a", open, started, 2000),
			change("a", started, blocked, 3000),
			change("a", blocked, started, 4000),
			change("a", started, blocked, 8000),
		}, 10000)

		a := itemTiming(t, timing, "a")
		assert.Equal(t, int64(1000+2000), a.BlockedMillis)
		assert.Equal(t, int64(8000), a.BlockedSince)
		assert.Equal(t, 1, timing.BlockedItems)
		assert.Equal(t, int64(3000), timing.WaitingMillis)
		assert.Equal(t, int64(9000), timing.DurationMillis)
	})

	t.Run("finishing a blocked task ends the block", func(t *testing.T) {
		timing := ComputeRunTiming(timingRun("a"), []ChecklistItemStateChange{
			change("a", open, blocked, 2000),
			change("a", blocked, closed, 5000),
		}, 10000)

		a := itemTiming(t, timing, "a")
		assert.Equal(t, int64(3000), a.BlockedMillis)
		assert.Zero(t, a.BlockedSince)
		assert.Zero(t, timing.BlockedItems)
	})

	t.Run("overlapping blocks count once toward waiting time", func(t *testing.T) {
		timing := ComputeRunTiming(timingRun("a", "b", "c"), []ChecklistItemStateChange{
			change("a", open, blocked, 2000),
			change("b", open, blocked, 3000),
			change("a", blocked, started, 5000),
			change("b", blocked, started, 6000),
			change("c", open, blocked, 8000),
			change("c", blocked, started, 9000),
		}, 10000)

		assert.Equal(t, int64(3000), itemTiming(t, timing, "a").BlockedMillis)
		assert.Equal(t, int64(3000), itemTiming(t, timing, "b").BlockedMillis)
		assert.Equal(t, int64(4000+1000), timing.WaitingMillis, "2000-6000 and 8000-9000 of wall-clock time")
	})

	t.Run("a finished run stops the clock", func(t *testing.T) {
		run := timingRun("a")
		run.EndAt = 6000

		timing := ComputeRunTiming(run, []ChecklistItemStateChange{
			change("a", open, blocked, 4000),
		}, 10000)

		assert.Equal(t, int64(5000), timing.DurationMillis)
		assert.Equal(t, int64(2000), itemTiming(t, timing, "a").BlockedMillis)
		assert.Equal(t, int64(2000), timing.WaitingMillis)
	})

	t.Run("unblocking after the run ended leaves the run as it was when it ended", func(t *testing.T) {
		run := timingRun("a")
		run.EndAt = 5000

		timing := ComputeRunTiming(run, []ChecklistItemStateChange{
			change("a", open, blocked, 2000),
			change("a", blocked, started, 8000),
		}, 10000)

		item := itemTiming(t, timing, "a")
		assert.Equal(t, int64(2000), item.BlockedSince)
		assert.Equal(t, int64(3000), item.BlockedMillis)
		assert.Zero(t, item.StartedAt)
		assert.Equal(t, 1, timing.BlockedItems)
	})

	t.Run("items removed from the run and items with no changes are left out", func(t *testing.T) {
		timing := ComputeRunTiming(timingRun("a", "b"), []ChecklistItemStateChange{
			change("a", open, started, 2000),
			change("gone", open, blocked, 2000),
		}, 10000)

		require.Len(t, timing.Items, 1)
		assert.Equal(t, "a", timing.Items[0].ItemID)
		assert.Zero(t, timing.WaitingMillis)
	})

	t.Run("a run with no changes still reports its duration", func(t *testing.T) {
		timing := ComputeRunTiming(timingRun("a"), nil, 4000)

		assert.Empty(t, timing.Items)
		assert.NotNil(t, timing.Items, "clients iterate items without a nil check")
		assert.Equal(t, int64(3000), timing.DurationMillis)
		assert.Equal(t, int64(4000), timing.ComputedAt)
	})
}
