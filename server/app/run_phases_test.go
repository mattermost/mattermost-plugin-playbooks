// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
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
		assert.Equal(t, RunPhase{ChecklistID: "c1", Title: "Phase", Status: PhaseStatusNotStarted, Current: true, TasksOpen: 2, TasksTotal: 2}, phases[0])
	})

	t.Run("an empty checklist is not started", func(t *testing.T) {
		assert.Equal(t, PhaseStatusNotStarted, ComputePhases(phaseChecklist(), nil)[0].Status)
	})

	t.Run("started when a task is in progress, from its first activity", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateInProgress, 90), phaseItem("b", ChecklistItemStateOpen, 0)),
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateInProgress, 20)},
		)
		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(20), phases[0].StartedAt)
	})

	t.Run("started when one task is closed and the rest are open", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateClosed, 50), phaseItem("b", ChecklistItemStateOpen, 0)),
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 50)},
		)
		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(50), phases[0].StartedAt)
	})

	t.Run("a lone skipped task does not start a phase", func(t *testing.T) {
		phases := ComputePhases(phaseChecklist(phaseItem("a", ChecklistItemStateSkipped, 5), phaseItem("b", ChecklistItemStateOpen, 0)), nil)
		assert.Equal(t, PhaseStatusNotStarted, phases[0].Status)
	})

	t.Run("done when every task is closed or skipped, from first activity to the last finish", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateClosed, 10), phaseItem("b", ChecklistItemStateSkipped, 30)),
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 10), phaseChange("b", ChecklistItemStateSkipped, 30)},
		)
		assert.Equal(t, PhaseStatusDone, phases[0].Status)
		assert.Equal(t, int64(10), phases[0].StartedAt)
		assert.Equal(t, int64(30), phases[0].EndedAt)
	})

	t.Run("done phase ends at the last close after a reopen", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateClosed, 40)),
			[]ChecklistItemStateChange{
				phaseChange("a", ChecklistItemStateClosed, 10),
				phaseChange("a", ChecklistItemStateOpen, 20),
				phaseChange("a", ChecklistItemStateClosed, 40),
			},
		)
		assert.Equal(t, PhaseStatusDone, phases[0].Status)
		assert.Equal(t, int64(10), phases[0].StartedAt)
		assert.Equal(t, int64(40), phases[0].EndedAt)
	})

	t.Run("a phase of only skipped tasks is skipped, not done, and has no elapsed time", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateSkipped, 30), phaseItem("b", ChecklistItemStateSkipped, 31)),
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateSkipped, 30), phaseChange("b", ChecklistItemStateSkipped, 31)},
		)
		assert.Equal(t, PhaseStatusSkipped, phases[0].Status)
		assert.Zero(t, phases[0].StartedAt)
		assert.Zero(t, phases[0].EndedAt)
		assert.Zero(t, phases[0].TasksOpen)
	})

	t.Run("closed and skipped tasks together are done", func(t *testing.T) {
		phases := ComputePhases(phaseChecklist(phaseItem("a", ChecklistItemStateClosed, 10), phaseItem("b", ChecklistItemStateSkipped, 20)), nil)
		assert.Equal(t, PhaseStatusDone, phases[0].Status)
	})

	t.Run("counts visible tasks that are still open", func(t *testing.T) {
		hidden := phaseItem("h", ChecklistItemStateOpen, 0)
		hidden.ConditionAction = ConditionActionHidden
		phases := ComputePhases(phaseChecklist(
			phaseItem("a", ChecklistItemStateClosed, 10),
			phaseItem("b", ChecklistItemStateSkipped, 20),
			phaseItem("c", ChecklistItemStateInProgress, 30),
			phaseItem("d", ChecklistItemStateOpen, 0),
			hidden,
		), nil)
		assert.Equal(t, 4, phases[0].TasksTotal)
		assert.Equal(t, 2, phases[0].TasksOpen)
	})

	t.Run("blocked when any task is blocked, even if others are done", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateClosed, 10), phaseItem("b", ChecklistItemStateBlocked, 40)),
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 10), phaseChange("b", ChecklistItemStateBlocked, 40)},
		)
		assert.Equal(t, PhaseStatusBlocked, phases[0].Status)
		assert.Equal(t, int64(10), phases[0].StartedAt)
		assert.Zero(t, phases[0].EndedAt)
	})

	t.Run("a blocked phase runs from its first activity", func(t *testing.T) {
		phases := ComputePhases(
			phaseChecklist(phaseItem("a", ChecklistItemStateBlocked, 80), phaseItem("b", ChecklistItemStateBlocked, 60)),
			[]ChecklistItemStateChange{
				phaseChange("a", ChecklistItemStateBlocked, 30),
				phaseChange("a", ChecklistItemStateInProgress, 50),
				phaseChange("a", ChecklistItemStateBlocked, 80),
				phaseChange("b", ChecklistItemStateBlocked, 60),
			},
		)
		assert.Equal(t, int64(30), phases[0].StartedAt)
	})

	t.Run("falls back to the task's state_modified without recorded changes", func(t *testing.T) {
		phases := ComputePhases(phaseChecklist(phaseItem("a", ChecklistItemStateInProgress, 77)), nil)
		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(77), phases[0].StartedAt)
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

// phasesStore stubs the only store call the phase code makes.
type phasesStore struct {
	PlaybookRunStore
	changes []ChecklistItemStateChange
	err     error
	reads   int
}

func (p *phasesStore) GetChecklistItemStateChanges(string) ([]ChecklistItemStateChange, error) {
	p.reads++
	return p.changes, p.err
}

func phasesRun(enabled bool, items ...ChecklistItem) *PlaybookRun {
	return &PlaybookRun{ID: "run1", UseChecklistsAsPhases: enabled, Checklists: phaseChecklist(items...)}
}

func TestCapPhasesAtRunEnd(t *testing.T) {
	phases := func() []RunPhase {
		return []RunPhase{
			{Status: PhaseStatusDone, StartedAt: 10, EndedAt: 30},
			{Status: PhaseStatusStarted, StartedAt: 40},
			{Status: PhaseStatusBlocked, StartedAt: 50},
			{Status: PhaseStatusNotStarted},
		}
	}

	t.Run("leaves phases of a run that is still going", func(t *testing.T) {
		assert.Equal(t, phases(), capPhasesAtRunEnd(phases(), 0))
	})

	t.Run("ends active phases at the run's end and leaves the rest", func(t *testing.T) {
		got := capPhasesAtRunEnd(phases(), 100)
		assert.Equal(t, int64(30), got[0].EndedAt)
		assert.Equal(t, int64(100), got[1].EndedAt)
		assert.Equal(t, int64(100), got[2].EndedAt)
		assert.Zero(t, got[3].EndedAt)
	})

	t.Run("never ends a phase before it started", func(t *testing.T) {
		got := capPhasesAtRunEnd([]RunPhase{{Status: PhaseStatusStarted, StartedAt: 200}}, 100)
		assert.Equal(t, int64(200), got[0].EndedAt)
	})
}

func TestPopulatePhases(t *testing.T) {
	t.Run("clears phases when the run does not use them, without reading the log", func(t *testing.T) {
		store := &phasesStore{}
		run := phasesRun(false, phaseItem("a", ChecklistItemStateClosed, 10))
		run.Phases = []RunPhase{{Title: "stale"}}

		(&PlaybookRunServiceImpl{store: store}).PopulatePhases(run)

		assert.Nil(t, run.Phases)
		assert.Zero(t, store.reads)
	})

	t.Run("computes phases from the state change log", func(t *testing.T) {
		store := &phasesStore{changes: []ChecklistItemStateChange{phaseChange("a", ChecklistItemStateInProgress, 20)}}
		run := phasesRun(true, phaseItem("a", ChecklistItemStateInProgress, 90))

		(&PlaybookRunServiceImpl{store: store}).PopulatePhases(run)

		require.Len(t, run.Phases, 1)
		assert.Equal(t, PhaseStatusStarted, run.Phases[0].Status)
		assert.Equal(t, int64(20), run.Phases[0].StartedAt)
	})

	t.Run("a log read failure only costs the exact timestamps", func(t *testing.T) {
		store := &phasesStore{err: errors.New("boom")}
		run := phasesRun(true, phaseItem("a", ChecklistItemStateInProgress, 90))

		(&PlaybookRunServiceImpl{store: store}).PopulatePhases(run)

		require.Len(t, run.Phases, 1)
		assert.Equal(t, PhaseStatusStarted, run.Phases[0].Status)
		assert.Equal(t, int64(90), run.Phases[0].StartedAt)
	})

	t.Run("stops the clock of active phases when the run has ended", func(t *testing.T) {
		store := &phasesStore{changes: []ChecklistItemStateChange{phaseChange("a", ChecklistItemStateInProgress, 20)}}
		run := phasesRun(true, phaseItem("a", ChecklistItemStateInProgress, 20))
		run.EndAt = 500

		(&PlaybookRunServiceImpl{store: store}).PopulatePhases(run)

		require.Len(t, run.Phases, 1)
		assert.Equal(t, PhaseStatusStarted, run.Phases[0].Status)
		assert.Equal(t, int64(500), run.Phases[0].EndedAt)
	})

	t.Run("tolerates a nil run", func(t *testing.T) {
		assert.NotPanics(t, func() { (&PlaybookRunServiceImpl{store: &phasesStore{}}).PopulatePhases(nil) })
	})
}

func TestAddPhasesToChanges(t *testing.T) {
	item := phaseItem("a", ChecklistItemStateInProgress, 90)

	t.Run("adds phases when checklists changed", func(t *testing.T) {
		store := &phasesStore{}
		changes := map[string]interface{}{"checklists": []ChecklistUpdate{{ID: "c1"}}}

		(&PlaybookRunServiceImpl{store: store}).addPhasesToChanges(phasesRun(true, item), changes)

		phases, ok := changes["phases"].([]RunPhase)
		require.True(t, ok)
		require.Len(t, phases, 1)
		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
	})

	t.Run("adds phases when a checklist was deleted", func(t *testing.T) {
		changes := map[string]interface{}{"_checklist_deletes": []string{"c1"}}

		run := &PlaybookRun{ID: "run1", UseChecklistsAsPhases: true}
		(&PlaybookRunServiceImpl{store: &phasesStore{}}).addPhasesToChanges(run, changes)

		phases, ok := changes["phases"].([]RunPhase)
		require.True(t, ok)
		assert.Empty(t, phases)
	})

	t.Run("does not touch the log for unrelated changes", func(t *testing.T) {
		store := &phasesStore{}
		changes := map[string]interface{}{"summary": "new"}

		(&PlaybookRunServiceImpl{store: store}).addPhasesToChanges(phasesRun(true, item), changes)

		assert.NotContains(t, changes, "phases")
		assert.Zero(t, store.reads)
	})

	t.Run("ignores runs without phases", func(t *testing.T) {
		store := &phasesStore{}
		changes := map[string]interface{}{"checklists": []ChecklistUpdate{{ID: "c1"}}}

		(&PlaybookRunServiceImpl{store: store}).addPhasesToChanges(phasesRun(false, item), changes)

		assert.NotContains(t, changes, "phases")
		assert.Zero(t, store.reads)
	})
}

// phaseList builds a checklist with a single task in the given state.
func phaseList(id, state string, at int64) Checklist {
	return Checklist{ID: id, Title: id, Items: []ChecklistItem{{ID: id + "-item", State: state, StateModified: at}}}
}

func currentPhase(phases []RunPhase) string {
	for _, phase := range phases {
		if phase.Current {
			return phase.ChecklistID
		}
	}
	return ""
}

func TestCurrentPhase(t *testing.T) {
	open, doing, closed, skipped, blocked := ChecklistItemStateOpen, ChecklistItemStateInProgress, ChecklistItemStateClosed, ChecklistItemStateSkipped, ChecklistItemStateBlocked

	cases := map[string]struct {
		lists    []Checklist
		expected string
	}{
		"the first phase when nothing has started": {
			lists:    []Checklist{phaseList("a", open, 0), phaseList("b", open, 0)},
			expected: "a",
		},
		"the first phase that is not skipped when nothing has started": {
			lists:    []Checklist{phaseList("a", skipped, 5), phaseList("b", open, 0)},
			expected: "b",
		},
		"the furthest phase where work has started": {
			lists:    []Checklist{phaseList("a", doing, 10), phaseList("b", doing, 20), phaseList("c", open, 0)},
			expected: "b",
		},
		"a later phase even when an earlier one still has open tasks": {
			lists: []Checklist{
				{ID: "a", Title: "a", Items: []ChecklistItem{{ID: "a1", State: closed, StateModified: 10}, {ID: "a2", State: open}}},
				phaseList("b", doing, 20),
			},
			expected: "b",
		},
		"a phase with a blocked task counts as started": {
			lists:    []Checklist{phaseList("a", doing, 10), phaseList("b", blocked, 20), phaseList("c", open, 0)},
			expected: "b",
		},
		"the next phase once the furthest one is done": {
			lists:    []Checklist{phaseList("a", closed, 10), phaseList("b", open, 0), phaseList("c", open, 0)},
			expected: "b",
		},
		"skipping over skipped phases after a finished one": {
			lists:    []Checklist{phaseList("a", closed, 10), phaseList("b", skipped, 11), phaseList("c", open, 0)},
			expected: "c",
		},
		"the last phase when everything is finished": {
			lists:    []Checklist{phaseList("a", closed, 10), phaseList("b", closed, 20)},
			expected: "b",
		},
		"the finished phase when only skipped phases follow": {
			lists:    []Checklist{phaseList("a", closed, 10), phaseList("b", skipped, 11)},
			expected: "a",
		},
		"a skipped phase never counts as started": {
			lists:    []Checklist{phaseList("a", doing, 10), phaseList("b", skipped, 20)},
			expected: "a",
		},
		"no phase when every phase is skipped": {
			lists:    []Checklist{phaseList("a", skipped, 10), phaseList("b", skipped, 20)},
			expected: "",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			phases := ComputePhases(tc.lists, nil)

			assert.Equal(t, tc.expected, currentPhase(phases))
			marked := 0
			for _, phase := range phases {
				if phase.Current {
					marked++
				}
			}
			assert.LessOrEqual(t, marked, 1)
		})
	}

	t.Run("no phases", func(t *testing.T) {
		assert.Empty(t, ComputePhases(nil, nil))
	})
}

func TestPhasesEndWhenTheNextOneStarts(t *testing.T) {
	t.Run("a phase left with open tasks ends when the next phase started", func(t *testing.T) {
		lists := []Checklist{
			{ID: "a", Title: "a", Items: []ChecklistItem{{ID: "a1", State: ChecklistItemStateClosed, StateModified: 10}, {ID: "a2", State: ChecklistItemStateOpen}}},
			phaseList("b", ChecklistItemStateInProgress, 50),
		}
		changes := []ChecklistItemStateChange{phaseChange("a1", ChecklistItemStateClosed, 10), phaseChange("b-item", ChecklistItemStateInProgress, 50)}

		phases := ComputePhases(lists, changes)

		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(10), phases[0].StartedAt)
		assert.Equal(t, int64(50), phases[0].EndedAt)
		assert.Zero(t, phases[1].EndedAt, "the current phase keeps running")
	})

	t.Run("a finished phase keeps its own end", func(t *testing.T) {
		lists := []Checklist{phaseList("a", ChecklistItemStateClosed, 20), phaseList("b", ChecklistItemStateInProgress, 50)}
		phases := ComputePhases(lists, nil)

		assert.Equal(t, int64(20), phases[0].EndedAt)
	})

	t.Run("a blocked phase the run moved past is also stopped", func(t *testing.T) {
		lists := []Checklist{phaseList("a", ChecklistItemStateBlocked, 10), phaseList("b", ChecklistItemStateInProgress, 50)}
		phases := ComputePhases(lists, nil)

		assert.Equal(t, PhaseStatusBlocked, phases[0].Status)
		assert.Equal(t, int64(50), phases[0].EndedAt)
	})
}
