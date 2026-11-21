// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func phaseItem(id, state string, stateModified int64) ChecklistItem {
	return ChecklistItem{ID: id, Title: id, State: state, StateModified: stateModified}
}

func phaseChecklist(items ...ChecklistItem) []Checklist {
	return []Checklist{{ID: "c1", Title: "Phase", Items: items}}
}

func phaseChange(itemID, to string, at int64) ChecklistItemStateChange {
	return ChecklistItemStateChange{ItemID: itemID, ToState: to, ChangedAt: at}
}

func TestComputePhases(t *testing.T) {
	t.Run("not started when every task is open", func(t *testing.T) {
		phases := ComputePhases(phaseChecklist(phaseItem("a", ChecklistItemStateOpen, 0), phaseItem("b", ChecklistItemStateOpen, 0)), nil)
		require.Len(t, phases, 1)
		assert.Equal(t, RunPhase{ChecklistID: "c1", Title: "Phase", Status: PhaseStatusNotStarted}, phases[0])
	})

	t.Run("an empty checklist is not started", func(t *testing.T) {
		assert.Equal(t, PhaseStatusNotStarted, ComputePhases(phaseChecklist(), nil)[0].Status)
	})

	t.Run("started when a task is in progress, stamped with its first activity", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateInProgress, 90), phaseItem("b", ChecklistItemStateOpen, 0)),
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateInProgress, 20)},
		)
		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(20), phases[0].Timestamp)
	})

	t.Run("started when one task is closed and the rest are open", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateClosed, 50), phaseItem("b", ChecklistItemStateOpen, 0)),
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 50)},
		)
		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(50), phases[0].Timestamp)
	})

	t.Run("a lone skipped task does not start a phase", func(t *testing.T) {
		phases := ComputePhases(phaseChecklist(phaseItem("a", ChecklistItemStateSkipped, 5), phaseItem("b", ChecklistItemStateOpen, 0)), nil)
		assert.Equal(t, PhaseStatusNotStarted, phases[0].Status)
	})

	t.Run("done when every task is closed or skipped, stamped with the last finish", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateClosed, 10), phaseItem("b", ChecklistItemStateSkipped, 30)),
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 10), phaseChange("b", ChecklistItemStateSkipped, 30)},
		)
		assert.Equal(t, PhaseStatusDone, phases[0].Status)
		assert.Equal(t, int64(30), phases[0].Timestamp)
	})

	t.Run("done timestamp ignores a reopen that was closed again later", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateClosed, 40)),
			[]ChecklistItemStateChange{
				phaseChange("a", ChecklistItemStateClosed, 10),
				phaseChange("a", ChecklistItemStateOpen, 20),
				phaseChange("a", ChecklistItemStateClosed, 40),
			},
		)
		assert.Equal(t, PhaseStatusDone, phases[0].Status)
		assert.Equal(t, int64(40), phases[0].Timestamp)
	})

	t.Run("blocked when any task is blocked, even if others are done", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateClosed, 10), phaseItem("b", ChecklistItemStateBlocked, 40)),
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 10), phaseChange("b", ChecklistItemStateBlocked, 40)},
		)
		assert.Equal(t, PhaseStatusBlocked, phases[0].Status)
		assert.Equal(t, int64(40), phases[0].Timestamp)
	})

	t.Run("blocked timestamp is the earliest current block", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateBlocked, 80), phaseItem("b", ChecklistItemStateBlocked, 60)),
			[]ChecklistItemStateChange{
				phaseChange("a", ChecklistItemStateBlocked, 30),
				phaseChange("a", ChecklistItemStateInProgress, 50),
				phaseChange("a", ChecklistItemStateBlocked, 80),
				phaseChange("b", ChecklistItemStateBlocked, 60),
			},
		)
		assert.Equal(t, int64(60), phases[0].Timestamp)
	})

	t.Run("falls back to the task's state_modified without recorded changes", func(t *testing.T) {
		phases := ComputePhases(phaseChecklist(phaseItem("a", ChecklistItemStateInProgress, 77)), nil)
		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(77), phases[0].Timestamp)
	})

	t.Run("hidden tasks are ignored", func(t *testing.T) {
		hidden := phaseItem("h", ChecklistItemStateOpen, 0)
		hidden.ConditionAction = ConditionActionHidden
		phases := ComputePhases(phaseChecklist(phaseItem("a", ChecklistItemStateClosed, 10), hidden), nil)
		assert.Equal(t, PhaseStatusDone, phases[0].Status)
	})

	t.Run("keeps checklist order and identity", func(t *testing.T) {
		phases := ComputePhases([]Checklist{{ID: "x", Title: "A"}, {ID: "y", Title: "B"}}, nil)
		require.Len(t, phases, 2)
		assert.Equal(t, "x", phases[0].ChecklistID)
		assert.Equal(t, "B", phases[1].Title)
	})
}

func TestDetectChangedFieldsPhases(t *testing.T) {
	previous := &PlaybookRun{Checklists: []Checklist{{ID: "c1", Items: []ChecklistItem{{ID: "a"}}}}}
	phases := []RunPhase{{ChecklistID: "c1", Status: PhaseStatusStarted}}

	t.Run("resent when checklists changed", func(t *testing.T) {
		current := &PlaybookRun{
			Checklists: []Checklist{{ID: "c1", Items: []ChecklistItem{{ID: "a", State: ChecklistItemStateInProgress}}}},
			Phases:     phases,
		}
		assert.Equal(t, phases, DetectChangedFields(previous, current)["phases"])
	})

	t.Run("not sent when checklists are unchanged", func(t *testing.T) {
		current := &PlaybookRun{Checklists: previous.Checklists, Phases: phases}
		assert.NotContains(t, DetectChangedFields(previous, current), "phases")
	})

	t.Run("not sent for runs without phases", func(t *testing.T) {
		current := &PlaybookRun{Checklists: []Checklist{{ID: "c1", Items: []ChecklistItem{{ID: "a", State: ChecklistItemStateInProgress}}}}}
		assert.NotContains(t, DetectChangedFields(previous, current), "phases")
	})
}
