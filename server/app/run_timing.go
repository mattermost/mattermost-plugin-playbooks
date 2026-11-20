// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sort"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

// GetRunTiming computes item and run timing from the run's checklist item state changes.
func (s *PlaybookRunServiceImpl) GetRunTiming(playbookRunID string) (*RunTiming, error) {
	run, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get playbook run")
	}

	changes, err := s.store.GetChecklistItemStateChanges(playbookRunID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get checklist item state changes")
	}

	timing := ComputeRunTiming(run, changes, model.GetMillis())
	return &timing, nil
}

// ChecklistItemTiming is how long one checklist item took, derived from its state changes.
type ChecklistItemTiming struct {
	ChecklistID string `json:"checklist_id"`
	ItemID      string `json:"item_id"`

	// StartedAt is when the item first moved to in progress, 0 if it never did.
	StartedAt int64 `json:"started_at"`

	// FinishedAt is when the item was first closed, 0 if it never was. Reopening the item does
	// not move it, so a "time to X" figure stays stable once X has happened.
	FinishedAt int64 `json:"finished_at"`

	// Reopened is true when the item was closed and later moved out of closed.
	Reopened bool `json:"reopened"`

	// BlockedMillis is the total time the item spent blocked, up to the end of the run.
	BlockedMillis int64 `json:"blocked_millis"`

	// BlockCount is how many times the item was blocked.
	BlockCount int `json:"block_count"`

	// BlockedSince is when the current block began, 0 if the item is not blocked.
	BlockedSince int64 `json:"blocked_since"`
}

// RunTiming summarizes how long a run and its checklist items took, as of ComputedAt.
type RunTiming struct {
	Items []ChecklistItemTiming `json:"items"`

	// DurationMillis runs from the run's creation to its end, or to ComputedAt while it is active.
	DurationMillis int64 `json:"duration_millis"`

	// WaitingMillis is the wall-clock time during which at least one item was blocked. Blocks that
	// overlap are counted once, so it can never exceed DurationMillis.
	WaitingMillis int64 `json:"waiting_millis"`

	// BlockedItems is how many items are blocked as of ComputedAt.
	BlockedItems int `json:"blocked_items"`

	Metrics []TimingMetricResult `json:"metrics"`

	ComputedAt int64 `json:"computed_at"`
}

type interval struct {
	start, end int64
}

// ComputeRunTiming derives item and run timing from the run's state changes, which must be ordered
// oldest first. Items no longer in the run are ignored.
func ComputeRunTiming(run *PlaybookRun, changes []ChecklistItemStateChange, now int64) RunTiming {
	runEnd := now
	if run.EndAt > 0 {
		runEnd = run.EndAt
	}

	changesByItem := make(map[string][]ChecklistItemStateChange)
	for _, change := range changes {
		changesByItem[change.ItemID] = append(changesByItem[change.ItemID], change)
	}

	timing := RunTiming{
		Items:          []ChecklistItemTiming{},
		DurationMillis: max(runEnd-run.CreateAt, 0),
		ComputedAt:     now,
	}

	var blocked []interval
	itemsByID := make(map[string]ChecklistItemTiming)
	itemStates := make(map[string]string)
	for _, checklist := range run.Checklists {
		for _, item := range checklist.Items {
			itemStates[item.ID] = item.State
			itemChanges, ok := changesByItem[item.ID]
			if !ok {
				continue
			}

			itemTiming, itemBlocked := computeItemTiming(checklist.ID, item.ID, itemChanges, runEnd)
			for _, b := range itemBlocked {
				itemTiming.BlockedMillis += b.end - b.start
			}
			if itemTiming.BlockedSince > 0 {
				timing.BlockedItems++
			}
			blocked = append(blocked, itemBlocked...)
			timing.Items = append(timing.Items, itemTiming)
			itemsByID[item.ID] = itemTiming
		}
	}

	timing.WaitingMillis = unionLength(blocked)
	timing.Metrics = computeTimingMetrics(run, itemsByID, itemStates, runEnd)

	return timing
}

func computeItemTiming(checklistID, itemID string, changes []ChecklistItemStateChange, runEnd int64) (ChecklistItemTiming, []interval) {
	timing := ChecklistItemTiming{ChecklistID: checklistID, ItemID: itemID}

	var blocked []interval
	var blockedStart int64
	for _, change := range changes {
		// Tasks can still be changed once the run ends, but the run's clock has stopped.
		if change.ChangedAt > runEnd {
			continue
		}
		if change.FromState == ChecklistItemStateBlocked && blockedStart > 0 {
			blocked = appendClipped(blocked, blockedStart, change.ChangedAt, runEnd)
			blockedStart = 0
		}
		if change.FromState == ChecklistItemStateClosed && timing.FinishedAt > 0 {
			timing.Reopened = true
		}

		switch change.ToState {
		case ChecklistItemStateBlocked:
			blockedStart = change.ChangedAt
			timing.BlockCount++
		case ChecklistItemStateInProgress:
			if timing.StartedAt == 0 {
				timing.StartedAt = change.ChangedAt
			}
		case ChecklistItemStateClosed:
			if timing.FinishedAt == 0 {
				timing.FinishedAt = change.ChangedAt
			}
		}
	}

	if blockedStart > 0 {
		timing.BlockedSince = blockedStart
		blocked = appendClipped(blocked, blockedStart, runEnd, runEnd)
	}

	return timing, blocked
}

func appendClipped(intervals []interval, start, end, limit int64) []interval {
	if end > limit {
		end = limit
	}
	if end <= start {
		return intervals
	}
	return append(intervals, interval{start: start, end: end})
}

func unionLength(intervals []interval) int64 {
	if len(intervals) == 0 {
		return 0
	}

	sort.Slice(intervals, func(i, j int) bool { return intervals[i].start < intervals[j].start })

	var total int64
	current := intervals[0]
	for _, next := range intervals[1:] {
		if next.start > current.end {
			total += current.end - current.start
			current = next
			continue
		}
		current.end = max(current.end, next.end)
	}

	return total + current.end - current.start
}
