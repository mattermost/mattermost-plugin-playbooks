// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
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

	token  string
	events []TimelineEvent
}

func (p *phasesStore) CompareAndSetPhaseLedgerToken(_, expected, next string) (bool, error) {
	if p.token != expected {
		return false, nil
	}
	p.token = next
	return true, nil
}

func (p *phasesStore) CreateTimelineEvent(event *TimelineEvent) (*TimelineEvent, error) {
	created := *event
	created.ID = fmt.Sprintf("event%d", len(p.events))
	p.events = append(p.events, created)
	return &created, nil
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
		assert.Equal(t, PhaseStatusStarted, run.Phases[0].Status, "the phase is not marked done")
		assert.Equal(t, int64(500), run.Phases[0].EndedAt, "but its time stops with the run")
		assert.Empty(t, store.events, "and no phase_done event is written for it")
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

	t.Run("adds phases when the run ends or is restored, so their timers stop or resume", func(t *testing.T) {
		for _, field := range []string{"end_at", "current_status", "timeline_events"} {
			changes := map[string]interface{}{field: "x"}
			run := phasesRun(true, item)
			run.EndAt = 500

			(&PlaybookRunServiceImpl{store: &phasesStore{}}).addPhasesToChanges(run, changes)

			phases, ok := changes["phases"].([]RunPhase)
			require.True(t, ok, field)
			assert.Equal(t, int64(500), phases[0].EndedAt, field)
		}
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

func TestMovingOnDoesNotStopAPhase(t *testing.T) {
	t.Run("a phase left with open tasks keeps running when the next phase starts", func(t *testing.T) {
		lists := []Checklist{
			{ID: "a", Title: "a", Items: []ChecklistItem{{ID: "a1", State: ChecklistItemStateClosed, StateModified: 10}, {ID: "a2", State: ChecklistItemStateOpen}}},
			phaseList("b", ChecklistItemStateInProgress, 50),
		}
		changes := []ChecklistItemStateChange{phaseChange("a1", ChecklistItemStateClosed, 10), phaseChange("b-item", ChecklistItemStateInProgress, 50)}

		phases := ComputePhases(lists, changes)

		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(10), phases[0].StartedAt)
		assert.Zero(t, phases[0].EndedAt)
		assert.Zero(t, phases[1].EndedAt)
	})

	t.Run("a finished phase ends when its last task did", func(t *testing.T) {
		lists := []Checklist{phaseList("a", ChecklistItemStateClosed, 20), phaseList("b", ChecklistItemStateInProgress, 50)}
		phases := ComputePhases(lists, nil)

		assert.Equal(t, int64(20), phases[0].EndedAt)
	})

	t.Run("a blocked phase keeps running too", func(t *testing.T) {
		lists := []Checklist{phaseList("a", ChecklistItemStateBlocked, 10), phaseList("b", ChecklistItemStateInProgress, 50)}
		phases := ComputePhases(lists, nil)

		assert.Equal(t, PhaseStatusBlocked, phases[0].Status)
		assert.Zero(t, phases[0].EndedAt)
	})

	t.Run("a person moving the run on leaves the phase running, and it can be returned to", func(t *testing.T) {
		checklists := []Checklist{
			{ID: "c1", Title: "c1", Items: []ChecklistItem{phaseItem("a", ChecklistItemStateInProgress, 10)}},
			{ID: "c2", Title: "c2", Items: []ChecklistItem{phaseItem("b", ChecklistItemStateOpen, 0)}},
		}
		changes := []ChecklistItemStateChange{phaseChange("a", ChecklistItemStateInProgress, 10)}

		phases := ComputePhasesWithOverride(checklists, changes, "c2", []phaseMove{{checklistID: "c2", at: 200}})

		assert.Equal(t, int64(10), phases[0].StartedAt)
		assert.Zero(t, phases[0].EndedAt)
		assert.Equal(t, int64(200), phases[1].StartedAt)
		assert.True(t, phases[1].Current)
	})
}

func twoPhaseRun(enabled bool, first, second ChecklistItem) *PlaybookRun {
	return &PlaybookRun{
		ID:                    "run1",
		UseChecklistsAsPhases: enabled,
		Checklists: []Checklist{
			{ID: "c1", Title: "Triage", Items: []ChecklistItem{first}},
			{ID: "c2", Title: "Containment", Items: []ChecklistItem{second}},
		},
	}
}

func TestComputePhasesWithOverride(t *testing.T) {
	checklists := []Checklist{
		{ID: "c1", Title: "Triage", Items: []ChecklistItem{phaseItem("a", ChecklistItemStateInProgress, 10)}},
		{ID: "c2", Title: "Containment", Items: []ChecklistItem{phaseItem("b", ChecklistItemStateOpen, 0)}},
	}

	current := func(phases []RunPhase) []bool {
		out := make([]bool, len(phases))
		for i, phase := range phases {
			out[i] = phase.Current
		}
		return out
	}

	t.Run("the chosen phase is current whatever the tasks say, statuses stay computed", func(t *testing.T) {
		phases := ComputePhasesWithOverride(checklists, nil, "c2", nil)

		assert.Equal(t, []bool{false, true}, current(phases))
		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, PhaseStatusNotStarted, phases[1].Status)
	})

	t.Run("a phase can be chosen even when it is done", func(t *testing.T) {
		done := []Checklist{
			{ID: "c1", Items: []ChecklistItem{phaseItem("a", ChecklistItemStateClosed, 10)}},
			{ID: "c2", Items: []ChecklistItem{phaseItem("b", ChecklistItemStateOpen, 0)}},
		}

		assert.Equal(t, []bool{true, false}, current(ComputePhasesWithOverride(done, nil, "c1", nil)))
	})

	t.Run("an override naming a missing list is ignored", func(t *testing.T) {
		assert.Equal(t, []bool{true, false}, current(ComputePhasesWithOverride(checklists, nil, "gone", nil)))
	})
}

func phaseEvent(eventType timelineEventType, checklistID, source string, at int64) TimelineEvent {
	details, _ := json.Marshal(PhaseEventDetails{ChecklistID: checklistID, Title: checklistID, Source: source})
	return TimelineEvent{EventType: eventType, EventAt: at, Details: string(details)}
}

func TestRecordPhaseEvents(t *testing.T) {
	list := func(id string, items ...ChecklistItem) Checklist {
		return Checklist{ID: id, Title: id, Items: items}
	}
	run := func(events ...TimelineEvent) *PlaybookRun {
		return &PlaybookRun{
			ID: "run1", UseChecklistsAsPhases: true, CreateAt: 1000, TimelineEvents: events,
			Checklists: []Checklist{
				list("c1", phaseItem("a", ChecklistItemStateClosed, 1100)),
				list("c2", phaseItem("b", ChecklistItemStateClosed, 1500), phaseItem("c", ChecklistItemStateOpen, 0)),
			},
		}
	}
	changes := []ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 1100), phaseChange("b", ChecklistItemStateClosed, 1500)}

	record := func(store *phasesStore, r *PlaybookRun) bool {
		return (&PlaybookRunServiceImpl{store: store}).recordPhaseEvents(r)
	}
	summary := func(events []TimelineEvent) []string {
		out := make([]string, len(events))
		for i, event := range events {
			var details PhaseEventDetails
			_ = json.Unmarshal([]byte(event.Details), &details)
			out[i] = fmt.Sprintf("%s %s @%d", event.EventType, details.ChecklistID, event.EventAt)
		}
		return out
	}

	t.Run("a run that never had phase events is filled in with the times things happened", func(t *testing.T) {
		store := &phasesStore{changes: changes}
		r := run()

		require.True(t, record(store, r))

		assert.Equal(t, []string{
			"phase_started c1 @1000", // the run started in its first phase
			"phase_done c1 @1100",
			"phase_started c2 @1100", // reached when the phase before it was done
		}, summary(store.events))
		assert.Len(t, r.TimelineEvents, 3, "the run carries the events it wrote")
	})

	t.Run("a phase done is written once, at the time its last task was done", func(t *testing.T) {
		store := &phasesStore{changes: append(changes, phaseChange("c", ChecklistItemStateClosed, 1800))}
		r := run(phaseEvent(PhaseStarted, "c1", "automatic", 1000), phaseEvent(PhaseDone, "c1", "automatic", 1100), phaseEvent(PhaseStarted, "c2", "automatic", 1100))
		r.Checklists[1].Items[1] = phaseItem("c", ChecklistItemStateClosed, 1800)

		require.True(t, record(store, r))

		assert.Equal(t, []string{"phase_done c2 @1800"}, summary(store.events))
	})

	t.Run("a done phase that gets an open task again is reopened, when that happened", func(t *testing.T) {
		store := &phasesStore{changes: append(changes, phaseChange("a", ChecklistItemStateOpen, 1300))}
		r := run(phaseEvent(PhaseStarted, "c1", "automatic", 1000), phaseEvent(PhaseDone, "c1", "automatic", 1100), phaseEvent(PhaseStarted, "c2", "automatic", 1100))
		r.Checklists[0].Items[0] = phaseItem("a", ChecklistItemStateOpen, 1300)

		require.True(t, record(store, r))

		assert.Equal(t, []string{"phase_reopened c1 @1300"}, summary(store.events))
	})

	t.Run("nothing is written when the timeline already agrees with the tasks", func(t *testing.T) {
		store := &phasesStore{changes: changes}
		r := run(phaseEvent(PhaseStarted, "c1", "automatic", 1000), phaseEvent(PhaseDone, "c1", "automatic", 1100), phaseEvent(PhaseStarted, "c2", "automatic", 1100))

		assert.False(t, record(store, r))
		assert.Empty(t, store.events)
	})

	t.Run("only one of two writers that saw the same gap writes it", func(t *testing.T) {
		store := &phasesStore{changes: changes, token: "someone else wrote"}
		r := run()

		assert.False(t, record(store, r))
		assert.Empty(t, store.events)
	})

	t.Run("writing twice in a row does not duplicate", func(t *testing.T) {
		store := &phasesStore{changes: changes}
		r := run()

		require.True(t, record(store, r))
		assert.False(t, record(store, r))
		assert.Len(t, store.events, 3)
	})

	t.Run("runs without phases and finished runs record nothing", func(t *testing.T) {
		store := &phasesStore{changes: changes}
		disabled := run()
		disabled.UseChecklistsAsPhases = false
		finished := run()
		finished.EndAt = 2000

		assert.False(t, record(store, disabled))
		assert.False(t, record(store, finished))
		assert.Empty(t, store.events)
	})

	t.Run("phases keep being recorded while a person is in charge of the current phase", func(t *testing.T) {
		store := &phasesStore{changes: changes}
		r := run(phaseEvent(PhaseStarted, "c1", "automatic", 1000))
		r.PhaseOverrideChecklistID = "c2"

		require.True(t, record(store, r))
		assert.Equal(t, []string{"phase_done c1 @1100", "phase_started c2 @1100"}, summary(store.events))
	})
}

func TestLedgerFromEvents(t *testing.T) {
	deleted := phaseEvent(PhaseDone, "c1", "automatic", 5)
	deleted.DeleteAt = 1

	ledger := ledgerFromEvents([]TimelineEvent{
		phaseEvent(PhaseDone, "c1", "automatic", 30),
		phaseEvent(PhaseStarted, "c1", "automatic", 10),
		phaseEvent(PhaseStarted, "c2", "manual", 20),
		phaseEvent(PhaseReopened, "c3", "automatic", 40),
		deleted,
		{EventType: TaskStateModified, EventAt: 1},
		{EventType: PhaseStarted, EventAt: 2, Details: "not json"},
	})

	assert.Equal(t, phaseLedgerEntry{startedAt: 10, doneAt: 30}, ledger.entries["c1"])
	assert.Equal(t, phaseLedgerEntry{startedAt: 20}, ledger.entries["c2"])
	assert.Equal(t, phaseLedgerEntry{startedAt: 40}, ledger.entries["c3"])
	t.Run("a start and a done at the same moment are not read as a reopening", func(t *testing.T) {
		got := ledgerFromEvents([]TimelineEvent{phaseEvent(PhaseDone, "c1", "automatic", 10), phaseEvent(PhaseStarted, "c1", "automatic", 10)})

		assert.Equal(t, phaseLedgerEntry{startedAt: 10, doneAt: 10}, got.entries["c1"])
	})

	t.Run("a later start after done reopens the phase and keeps its first start", func(t *testing.T) {
		got := ledgerFromEvents([]TimelineEvent{phaseEvent(PhaseStarted, "c1", "automatic", 10), phaseEvent(PhaseDone, "c1", "automatic", 20), phaseEvent(PhaseReopened, "c1", "automatic", 30)})

		assert.Equal(t, phaseLedgerEntry{startedAt: 10}, got.entries["c1"])
	})
}

func TestPopulatePhasesReadsTimesFromTheTimeline(t *testing.T) {
	r := &PlaybookRun{
		ID: "run1", UseChecklistsAsPhases: true, CreateAt: 1000,
		Checklists: []Checklist{{ID: "c1", Title: "c1", Items: []ChecklistItem{phaseItem("a", ChecklistItemStateClosed, 1100)}}},
		TimelineEvents: []TimelineEvent{
			phaseEvent(PhaseStarted, "c1", "automatic", 900),
			phaseEvent(PhaseDone, "c1", "automatic", 1200),
		},
	}
	store := &phasesStore{changes: []ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 1100)}}

	(&PlaybookRunServiceImpl{store: store}).PopulatePhases(r)

	require.Len(t, r.Phases, 1)
	assert.Equal(t, int64(900), r.Phases[0].StartedAt, "the timeline says when it started")
	assert.Equal(t, int64(1200), r.Phases[0].EndedAt, "the timeline says when it was done")
}

func TestPopulatePhasesShowsTheOverride(t *testing.T) {
	run := twoPhaseRun(true, phaseItem("a", ChecklistItemStateInProgress, 10), phaseItem("b", ChecklistItemStateOpen, 0))
	run.PhaseOverrideChecklistID = "c2"
	run.PhaseOverrideSetBy = "user1"
	run.PhaseOverrideSetAt = 42

	(&PlaybookRunServiceImpl{store: &phasesStore{}}).PopulatePhases(run)

	assert.Equal(t, &PhaseOverride{ChecklistID: "c2", SetBy: "user1", SetAt: 42}, run.PhaseOverride)
	require.Len(t, run.Phases, 2)
	assert.True(t, run.Phases[1].Current)

	run.UseChecklistsAsPhases = false
	(&PlaybookRunServiceImpl{store: &phasesStore{}}).PopulatePhases(run)
	assert.Nil(t, run.PhaseOverride)
}

func TestMoveChecklistIsBlockedForPhases(t *testing.T) {
	newRun := func(enabled bool) *PlaybookRun {
		run := twoPhaseRun(enabled, phaseItem("a", ChecklistItemStateOpen, 0), phaseItem("b", ChecklistItemStateOpen, 0))
		run.CurrentStatus = StatusInProgress
		return run
	}

	t.Run("the lists of a run that uses phases keep their order", func(t *testing.T) {
		service, store := newModifyCheckedStateHarness(t, newRun(true), false)

		err := service.MoveChecklist("run1", "user1", 0, 1)

		require.ErrorIs(t, err, ErrPhasesReorder)
		assert.Zero(t, store.updateCalls)
	})

	t.Run("a run without phases can still be reordered", func(t *testing.T) {
		service, store := newModifyCheckedStateHarness(t, newRun(false), false)

		require.NoError(t, service.MoveChecklist("run1", "user1", 0, 1))
		assert.Equal(t, 1, store.updateCalls)
	})
}

func TestPhaseStart(t *testing.T) {
	list := func(id string, items ...ChecklistItem) Checklist {
		return Checklist{ID: id, Title: id, Items: items}
	}

	t.Run("a phase starts at the first thing that happened to any of its tasks", func(t *testing.T) {
		// A task was skipped, another reopened: neither counts as work started, but both are activity.
		phases := ComputePhases(
			[]Checklist{list("c1", phaseItem("a", ChecklistItemStateSkipped, 50), phaseItem("b", ChecklistItemStateOpen, 70), phaseItem("c", ChecklistItemStateInProgress, 90))},
			[]ChecklistItemStateChange{
				phaseChange("a", ChecklistItemStateSkipped, 50),
				phaseChange("b", ChecklistItemStateClosed, 60),
				phaseChange("b", ChecklistItemStateOpen, 70),
				phaseChange("c", ChecklistItemStateInProgress, 90),
			},
		)

		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(50), phases[0].StartedAt)
	})

	t.Run("a person starting a phase is its start even with no task activity", func(t *testing.T) {
		phases := ComputePhasesWithOverride(
			[]Checklist{list("c1", phaseItem("a", ChecklistItemStateOpen, 0)), list("c2", phaseItem("b", ChecklistItemStateOpen, 0))},
			nil, "c2",
			[]phaseMove{{checklistID: "c2", at: 100}},
		)

		assert.Equal(t, int64(100), phases[1].StartedAt)
		assert.Zero(t, phases[1].EndedAt)
	})

	t.Run("the start is the earlier of the person's start and the first task activity", func(t *testing.T) {
		phases := ComputePhasesWithOverride(
			[]Checklist{list("c1", phaseItem("a", ChecklistItemStateInProgress, 80))},
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateInProgress, 80)},
			"c1",
			[]phaseMove{{checklistID: "c1", at: 100}},
		)

		assert.Equal(t, int64(80), phases[0].StartedAt)
	})

	t.Run("a done phase ends when its last task did", func(t *testing.T) {
		phases := ComputePhasesWithOverride(
			[]Checklist{list("c1", phaseItem("a", ChecklistItemStateClosed, 40)), list("c2", phaseItem("b", ChecklistItemStateOpen, 0))},
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 40)},
			"c2",
			nil,
		)

		assert.Equal(t, int64(40), phases[0].EndedAt)
	})

	t.Run("work done out of order never ends a phase", func(t *testing.T) {
		// Containment started at 10, before Triage's first activity at 50: Triage is not over.
		phases := ComputePhases(
			[]Checklist{list("c1", phaseItem("a", ChecklistItemStateInProgress, 50), phaseItem("x", ChecklistItemStateOpen, 0)), list("c2", phaseItem("b", ChecklistItemStateClosed, 10), phaseItem("y", ChecklistItemStateOpen, 0))},
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateInProgress, 50), phaseChange("b", ChecklistItemStateClosed, 10)},
		)

		assert.Equal(t, int64(50), phases[0].StartedAt)
		assert.Zero(t, phases[0].EndedAt)
	})

	t.Run("a skipped phase does not end the phase before it either", func(t *testing.T) {
		phases := ComputePhases(
			[]Checklist{list("c1", phaseItem("a", ChecklistItemStateInProgress, 10), phaseItem("x", ChecklistItemStateOpen, 0)), list("c2", phaseItem("b", ChecklistItemStateSkipped, 60))},
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateInProgress, 10), phaseChange("b", ChecklistItemStateSkipped, 60)},
		)

		assert.Zero(t, phases[0].EndedAt)
	})
}

func TestPhaseStartedWithoutWork(t *testing.T) {
	list := func(id string, items ...ChecklistItem) Checklist {
		return Checklist{ID: id, Title: id, Items: items}
	}

	t.Run("a phase a person started is started even though nothing was done in it", func(t *testing.T) {
		phases := ComputePhasesWithOverride(
			[]Checklist{list("c1", phaseItem("a", ChecklistItemStateOpen, 0)), list("c2", phaseItem("b", ChecklistItemStateOpen, 0))},
			nil, "c2",
			[]phaseMove{{checklistID: "c1", at: 10}, {checklistID: "c2", at: 20}},
		)

		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.False(t, phases[0].Current)
		assert.Zero(t, phases[0].EndedAt)
		assert.Equal(t, PhaseStatusStarted, phases[1].Status)
	})

	t.Run("a task that was started and reopened started the phase", func(t *testing.T) {
		phases := ComputePhases(
			[]Checklist{list("c1", phaseItem("a", ChecklistItemStateOpen, 40))},
			[]ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 30), phaseChange("a", ChecklistItemStateOpen, 40)},
		)

		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
	})

	t.Run("a phase nobody touched or manually started is not started", func(t *testing.T) {
		phases := ComputePhasesWithOverride(
			[]Checklist{list("c1", phaseItem("a", ChecklistItemStateOpen, 0))}, nil, "", []phaseMove{{checklistID: "other", at: 5}},
		)

		assert.Equal(t, PhaseStatusNotStarted, phases[0].Status)
	})
}

func TestPopulatePhasesStartsTheFirstPhaseWithTheRun(t *testing.T) {
	populate := func(run *PlaybookRun) []RunPhase {
		(&PlaybookRunServiceImpl{store: &phasesStore{}}).PopulatePhases(run)
		return run.Phases
	}

	t.Run("the first phase is in progress from the moment the run started", func(t *testing.T) {
		run := twoPhaseRun(true, phaseItem("a", ChecklistItemStateOpen, 0), phaseItem("b", ChecklistItemStateOpen, 0))
		run.CreateAt = 1000

		phases := populate(run)

		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(1000), phases[0].StartedAt)
		assert.True(t, phases[0].Current)
		assert.Equal(t, PhaseStatusNotStarted, phases[1].Status)
	})

	t.Run("it stays started once a person moved on without doing anything in it", func(t *testing.T) {
		run := twoPhaseRun(true, phaseItem("a", ChecklistItemStateOpen, 0), phaseItem("b", ChecklistItemStateOpen, 0))
		run.CreateAt = 1000
		run.PhaseOverrideChecklistID = "c2"
		run.TimelineEvents = append(run.TimelineEvents, phaseEvent(PhaseStarted, "c2", phaseSourceManual, 2000))

		phases := populate(run)

		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.False(t, phases[0].Current)
		assert.Equal(t, int64(1000), phases[0].StartedAt)
		assert.Zero(t, phases[0].EndedAt)
		assert.True(t, phases[1].Current)
	})

	t.Run("a first phase that was skipped has no time", func(t *testing.T) {
		run := twoPhaseRun(true, phaseItem("a", ChecklistItemStateSkipped, 30), phaseItem("b", ChecklistItemStateOpen, 0))
		run.CreateAt = 1000

		phases := populate(run)

		assert.Equal(t, PhaseStatusSkipped, phases[0].Status)
		assert.Zero(t, phases[0].StartedAt)
	})
}

func TestNextPhaseStartsWhenThePreviousOneIsDone(t *testing.T) {
	list := func(id string, items ...ChecklistItem) Checklist {
		return Checklist{ID: id, Title: id, Items: items}
	}
	done := list("c1", phaseItem("a", ChecklistItemStateClosed, 40))
	changes := []ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 40)}

	t.Run("the next phase is in progress from the moment the previous one was done", func(t *testing.T) {
		phases := ComputePhases([]Checklist{done, list("c2", phaseItem("b", ChecklistItemStateOpen, 0))}, changes)

		assert.Equal(t, PhaseStatusStarted, phases[1].Status)
		assert.True(t, phases[1].Current)
		assert.Equal(t, int64(40), phases[1].StartedAt)
		assert.Zero(t, phases[1].EndedAt)
	})

	t.Run("a skipped phase in between is passed over", func(t *testing.T) {
		phases := ComputePhases([]Checklist{done, list("c2", phaseItem("s", ChecklistItemStateSkipped, 50)), list("c3", phaseItem("b", ChecklistItemStateOpen, 0))}, append(changes, phaseChange("s", ChecklistItemStateSkipped, 50)))

		assert.Equal(t, PhaseStatusSkipped, phases[1].Status)
		assert.True(t, phases[2].Current)
		assert.Equal(t, PhaseStatusStarted, phases[2].Status)
		assert.Equal(t, int64(40), phases[2].StartedAt)
	})

	t.Run("the last phase being done leaves it current and finished", func(t *testing.T) {
		phases := ComputePhases([]Checklist{done}, changes)

		assert.Equal(t, PhaseStatusDone, phases[0].Status)
		assert.True(t, phases[0].Current)
	})
}

func TestPhaseTheRunReachedStaysStartedAfterAPersonMovesOn(t *testing.T) {
	list := func(id string, items ...ChecklistItem) Checklist {
		return Checklist{ID: id, Title: id, Items: items}
	}
	checklists := []Checklist{
		list("c1", phaseItem("a", ChecklistItemStateClosed, 10)),
		list("c2", phaseItem("b", ChecklistItemStateClosed, 20)),
		list("c3", phaseItem("c", ChecklistItemStateOpen, 0)),
		list("c4", phaseItem("d", ChecklistItemStateOpen, 0)),
	}
	changes := []ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 10), phaseChange("b", ChecklistItemStateClosed, 20)}

	// The run landed on c3 when c2 was done, then a person moved it to c4 at 50.
	phases := ComputePhasesWithOverride(checklists, changes, "c4", []phaseMove{
		{checklistID: "c4", at: 50},
	})

	assert.Equal(t, PhaseStatusStarted, phases[2].Status)
	assert.False(t, phases[2].Current)
	assert.Equal(t, int64(20), phases[2].StartedAt)
	assert.Zero(t, phases[2].EndedAt, "Eradication is not done, so its time keeps running")
	assert.True(t, phases[3].Current)
	assert.Equal(t, int64(50), phases[3].StartedAt)
}

func TestPhaseStartsWhenTheRunReachedItEvenIfWorkCameLater(t *testing.T) {
	list := func(id string, items ...ChecklistItem) Checklist {
		return Checklist{ID: id, Title: id, Items: items}
	}
	checklists := []Checklist{
		list("c1", phaseItem("a", ChecklistItemStateClosed, 100)),
		list("c2", phaseItem("b", ChecklistItemStateClosed, 600), phaseItem("c", ChecklistItemStateClosed, 604)),
		list("c3", phaseItem("d", ChecklistItemStateOpen, 0)),
	}
	changes := []ChecklistItemStateChange{
		phaseChange("a", ChecklistItemStateClosed, 100),
		phaseChange("b", ChecklistItemStateClosed, 600),
		phaseChange("c", ChecklistItemStateClosed, 604),
	}

	// A person moved to c3 at 110, long before the tasks of c2 were done.
	phases := ComputePhasesWithOverride(checklists, changes, "c3", []phaseMove{{checklistID: "c3", at: 110}})

	assert.Equal(t, PhaseStatusDone, phases[1].Status)
	assert.Equal(t, int64(100), phases[1].StartedAt, "reached when the phase before it was done, not at its first task")
	assert.Equal(t, int64(604), phases[1].EndedAt)
	assert.Equal(t, int64(110), phases[2].StartedAt)
}

func TestAPhaseTheRunReachedStaysStartedWhenThePreviousOneIsReopened(t *testing.T) {
	run := twoPhaseRun(true, phaseItem("a", ChecklistItemStateOpen, 1300), phaseItem("b", ChecklistItemStateOpen, 0))
	run.CreateAt = 1000
	run.TimelineEvents = []TimelineEvent{
		phaseEvent(PhaseStarted, "c1", phaseSourceAutomatic, 1000),
		phaseEvent(PhaseDone, "c1", phaseSourceAutomatic, 1100),
		phaseEvent(PhaseStarted, "c2", phaseSourceAutomatic, 1100),
	}
	store := &phasesStore{changes: []ChecklistItemStateChange{phaseChange("a", ChecklistItemStateClosed, 1100), phaseChange("a", ChecklistItemStateOpen, 1300)}}

	(&PlaybookRunServiceImpl{store: store}).PopulatePhases(run)

	require.Len(t, run.Phases, 2)
	assert.Equal(t, PhaseStatusStarted, run.Phases[0].Status, "the reopened phase runs again")
	assert.Equal(t, PhaseStatusStarted, run.Phases[1].Status, "the phase the run reached stays started")
	assert.Equal(t, int64(1100), run.Phases[1].StartedAt)
	assert.True(t, run.Phases[1].Current, "and stays the current one")
	assert.False(t, run.Phases[0].Current)
}
