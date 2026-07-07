// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "testing"

func TestCountOutstandingChecklistItemsForFinishRun(t *testing.T) {
	t.Parallel()

	t.Run("empty", func(t *testing.T) {
		t.Parallel()
		if got := CountOutstandingChecklistItemsForFinishRun(nil); got != 0 {
			t.Fatalf("nil checklists: got %d want 0", got)
		}
		if got := CountOutstandingChecklistItemsForFinishRun([]Checklist{}); got != 0 {
			t.Fatalf("empty slice: got %d want 0", got)
		}
	})

	t.Run("open visible counts", func(t *testing.T) {
		t.Parallel()
		checklists := []Checklist{{
			Items: []ChecklistItem{{State: ChecklistItemStateOpen}},
		}}
		if got := CountOutstandingChecklistItemsForFinishRun(checklists); got != 1 {
			t.Fatalf("got %d want 1", got)
		}
	})

	t.Run("in progress visible counts", func(t *testing.T) {
		t.Parallel()
		checklists := []Checklist{{
			Items: []ChecklistItem{{State: ChecklistItemStateInProgress}},
		}}
		if got := CountOutstandingChecklistItemsForFinishRun(checklists); got != 1 {
			t.Fatalf("got %d want 1", got)
		}
	})

	t.Run("open hidden does not count", func(t *testing.T) {
		t.Parallel()
		checklists := []Checklist{{
			Items: []ChecklistItem{{
				State:           ChecklistItemStateOpen,
				ConditionAction: ConditionActionHidden,
			}},
		}}
		if got := CountOutstandingChecklistItemsForFinishRun(checklists); got != 0 {
			t.Fatalf("got %d want 0", got)
		}
	})

	t.Run("in progress hidden does not count", func(t *testing.T) {
		t.Parallel()
		checklists := []Checklist{{
			Items: []ChecklistItem{{
				State:           ChecklistItemStateInProgress,
				ConditionAction: ConditionActionHidden,
			}},
		}}
		if got := CountOutstandingChecklistItemsForFinishRun(checklists); got != 0 {
			t.Fatalf("got %d want 0", got)
		}
	})

	t.Run("many hidden open plus one open visible", func(t *testing.T) {
		t.Parallel()
		checklists := []Checklist{{
			Items: []ChecklistItem{
				{State: ChecklistItemStateOpen},
				{State: ChecklistItemStateOpen, ConditionAction: ConditionActionHidden},
				{State: ChecklistItemStateOpen, ConditionAction: ConditionActionHidden},
				{State: ChecklistItemStateOpen, ConditionAction: ConditionActionHidden},
				{State: ChecklistItemStateOpen, ConditionAction: ConditionActionHidden},
				{State: ChecklistItemStateOpen, ConditionAction: ConditionActionHidden},
			},
		}}
		if got := CountOutstandingChecklistItemsForFinishRun(checklists); got != 1 {
			t.Fatalf("got %d want 1", got)
		}
	})

	t.Run("closed and skipped visible do not count", func(t *testing.T) {
		t.Parallel()
		checklists := []Checklist{{
			Items: []ChecklistItem{
				{State: ChecklistItemStateClosed},
				{State: ChecklistItemStateSkipped},
			},
		}}
		if got := CountOutstandingChecklistItemsForFinishRun(checklists); got != 0 {
			t.Fatalf("got %d want 0", got)
		}
	})

	t.Run("shown because modified still open counts", func(t *testing.T) {
		t.Parallel()
		checklists := []Checklist{{
			Items: []ChecklistItem{{
				State:           ChecklistItemStateOpen,
				ConditionAction: ConditionActionShownBecauseModified,
			}},
		}}
		if got := CountOutstandingChecklistItemsForFinishRun(checklists); got != 1 {
			t.Fatalf("got %d want 1", got)
		}
	})

	t.Run("aggregates multiple checklists", func(t *testing.T) {
		t.Parallel()
		checklists := []Checklist{
			{Items: []ChecklistItem{{State: ChecklistItemStateOpen}}},
			{Items: []ChecklistItem{{State: ChecklistItemStateInProgress}}},
		}
		if got := CountOutstandingChecklistItemsForFinishRun(checklists); got != 2 {
			t.Fatalf("got %d want 2", got)
		}
	})
}
