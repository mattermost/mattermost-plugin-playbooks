// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type phaseOverrideCall struct {
	runID, checklistID, setBy string
}

// stubPhaseStore is the store behind the service-level phase tests.
type stubPhaseStore struct {
	stubRunStoreForCheckedState

	changes       []ChecklistItemStateChange
	token         string
	overrideCalls []phaseOverrideCall
	events        []TimelineEvent
	stored        *TimelineEvent
	updated       []*TimelineEvent
}

func (s *stubPhaseStore) GetChecklistItemStateChanges(string) ([]ChecklistItemStateChange, error) {
	return s.changes, nil
}

func (s *stubPhaseStore) CompareAndSetPhaseLedgerToken(_, expected, next string) (bool, error) {
	if s.token != expected {
		return false, nil
	}
	s.token = next
	return true, nil
}

func (s *stubPhaseStore) SetPhaseOverride(runID, checklistID, setBy string, _ int64) error {
	s.overrideCalls = append(s.overrideCalls, phaseOverrideCall{runID, checklistID, setBy})
	return nil
}

func (s *stubPhaseStore) CreateTimelineEvent(event *TimelineEvent) (*TimelineEvent, error) {
	created := *event
	created.ID = fmt.Sprintf("event%d", len(s.events))
	s.events = append(s.events, created)
	return &created, nil
}

func (s *stubPhaseStore) GetTimelineEvent(_, _ string) (*TimelineEvent, error) {
	return s.stored, nil
}

func (s *stubPhaseStore) UpdateTimelineEvent(event *TimelineEvent) error {
	s.updated = append(s.updated, event)
	return nil
}

func newPhaseServiceHarness(t *testing.T, run *PlaybookRun) (*PlaybookRunServiceImpl, *stubPhaseStore) {
	t.Helper()

	svc, base := newModifyCheckedStateHarness(t, run, false)
	store := &stubPhaseStore{stubRunStoreForCheckedState: *base}
	svc.store = store
	return svc, store
}

func phasesServiceRun() *PlaybookRun {
	return &PlaybookRun{
		ID:                    "run1",
		ChannelID:             "channel1",
		CreateAt:              1000,
		CurrentStatus:         StatusInProgress,
		UseChecklistsAsPhases: true,
		Checklists: []Checklist{
			{ID: "c1", Title: "Triage", Items: []ChecklistItem{phaseItem("a", ChecklistItemStateOpen, 0)}},
			{ID: "c2", Title: "Containment", Items: []ChecklistItem{phaseItem("b", ChecklistItemStateOpen, 0)}},
			{ID: "c3", Title: "Recovery", Items: []ChecklistItem{phaseItem("c", ChecklistItemStateOpen, 0)}},
		},
	}
}

func eventTypes(events []TimelineEvent) []timelineEventType {
	out := make([]timelineEventType, len(events))
	for i, event := range events {
		out[i] = event.EventType
	}
	return out
}

func TestSetRunPhase(t *testing.T) {
	t.Run("a person taking over writes who moved the current phase, and the phase they started", func(t *testing.T) {
		svc, store := newPhaseServiceHarness(t, phasesServiceRun())

		require.NoError(t, svc.SetRunPhase("run1", "user1", "c3"))

		assert.Equal(t, []phaseOverrideCall{{"run1", "c3", "user1"}}, store.overrideCalls)

		// The run's own start comes first; then the person's move.
		require.Equal(t, []timelineEventType{PhaseStarted, CurrentPhaseChanged, PhaseStarted}, eventTypes(store.events))
		moved := store.events[1]
		assert.Equal(t, "user1", moved.SubjectUserID)
		var details CurrentPhaseChangedDetails
		require.NoError(t, json.Unmarshal([]byte(moved.Details), &details))
		assert.Equal(t, CurrentPhaseChangedDetails{FromChecklistID: "c1", FromTitle: "Triage", ToChecklistID: "c3", ToTitle: "Recovery"}, details)

		started := store.events[2]
		assert.Equal(t, "user1", started.SubjectUserID)
		assert.JSONEq(t, `{"checklist_id":"c3","title":"Recovery","source":"manual"}`, started.Details)
	})

	t.Run("moving the phase to the one it is already on does nothing", func(t *testing.T) {
		run := phasesServiceRun()
		run.PhaseOverrideChecklistID = "c2"
		svc, store := newPhaseServiceHarness(t, run)

		require.NoError(t, svc.SetRunPhase("run1", "user1", "c2"))

		assert.Empty(t, store.overrideCalls)
		assert.Empty(t, store.events)
	})

	t.Run("a phase that was already started is not started again", func(t *testing.T) {
		run := phasesServiceRun()
		run.TimelineEvents = []TimelineEvent{phaseEvent(PhaseStarted, "c1", phaseSourceAutomatic, 1000), phaseEvent(PhaseStarted, "c2", phaseSourceManual, 1500)}
		run.PhaseOverrideChecklistID = "c2"
		svc, store := newPhaseServiceHarness(t, run)

		require.NoError(t, svc.SetRunPhase("run1", "user1", "c1"))

		assert.Equal(t, []timelineEventType{CurrentPhaseChanged}, eventTypes(store.events))
	})

	t.Run("it refuses what cannot be a phase move", func(t *testing.T) {
		disabled := phasesServiceRun()
		disabled.UseChecklistsAsPhases = false
		finished := phasesServiceRun()
		finished.CurrentStatus = StatusFinished

		cases := []struct {
			name        string
			run         *PlaybookRun
			checklistID string
			err         error
		}{
			{"a run that does not use phases", disabled, "c2", ErrPhasesNotEnabled},
			{"a finished run", finished, "c2", ErrPlaybookRunNotActive},
			{"a task list the run does not have", phasesServiceRun(), "nope", ErrPhaseNotFound},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				svc, store := newPhaseServiceHarness(t, tc.run)

				require.ErrorIs(t, svc.SetRunPhase("run1", "user1", tc.checklistID), tc.err)

				assert.Empty(t, store.overrideCalls)
				assert.Empty(t, store.events)
			})
		}
	})
}

func TestPhaseEventsCannotBeDeleted(t *testing.T) {
	for _, eventType := range []timelineEventType{PhaseStarted, PhaseDone, PhaseReopened, CurrentPhaseChanged} {
		t.Run(string(eventType), func(t *testing.T) {
			svc, store := newPhaseServiceHarness(t, phasesServiceRun())
			store.stored = &TimelineEvent{ID: "e1", PlaybookRunID: "run1", EventType: eventType}

			require.ErrorIs(t, svc.RemoveTimelineEvent("run1", "user1", "e1"), ErrPhaseEventNotDeletable)

			assert.Empty(t, store.updated, "the event is left as it was")
		})
	}

	t.Run("other events still can be", func(t *testing.T) {
		svc, store := newPhaseServiceHarness(t, phasesServiceRun())
		store.stored = &TimelineEvent{ID: "e1", PlaybookRunID: "run1", EventType: StatusUpdated}

		require.NoError(t, svc.RemoveTimelineEvent("run1", "user1", "e1"))

		require.Len(t, store.updated, 1)
		assert.NotZero(t, store.updated[0].DeleteAt)
	})
}

func TestRemoveChecklistKeepsThePinnedPhase(t *testing.T) {
	t.Run("the task list a person set the phase to cannot be removed", func(t *testing.T) {
		run := phasesServiceRun()
		run.PhaseOverrideChecklistID = "c2"
		svc, store := newPhaseServiceHarness(t, run)

		require.ErrorIs(t, svc.RemoveChecklist("run1", "user1", 1), ErrPhasePinned)

		assert.Zero(t, store.updateCalls)
	})

	t.Run("another task list can", func(t *testing.T) {
		run := phasesServiceRun()
		run.PhaseOverrideChecklistID = "c2"
		svc, store := newPhaseServiceHarness(t, run)

		require.NoError(t, svc.RemoveChecklist("run1", "user1", 2))

		assert.Equal(t, 1, store.updateCalls)
	})
}
