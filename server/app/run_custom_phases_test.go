// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var customPhases = []CustomPhase{{ID: "p1", Title: "Triage"}, {ID: "p2", Title: "Containment"}, {ID: "p3", Title: "Recovery"}}

func customRun(events ...TimelineEvent) *PlaybookRun {
	return &PlaybookRun{
		ID:            "run1",
		ChannelID:     "channel1",
		CreateAt:      1000,
		CurrentStatus: StatusInProgress,
		CustomPhases:  customPhases,
		TimelineEvents: append([]TimelineEvent{
			phaseEvent(PhaseStarted, "p1", phaseSourceAutomatic, 1000),
		}, events...),
	}
}

func phaseSummary(phases []RunPhase) []string {
	out := make([]string, len(phases))
	for i, phase := range phases {
		marker := ""
		if phase.Current {
			marker = "*"
		}
		out[i] = phase.Title + ":" + string(phase.Status) + marker
	}
	return out
}

func TestComputeCustomPhases(t *testing.T) {
	t.Run("the run starts in the first phase", func(t *testing.T) {
		phases := ComputeCustomPhases(customPhases, ledgerFromEvents(nil), 1000)

		assert.Equal(t, []string{"Triage:started*", "Containment:not_started", "Recovery:not_started"}, phaseSummary(phases))
		assert.Equal(t, int64(1000), phases[0].StartedAt)
		assert.Zero(t, phases[0].EndedAt)
	})

	t.Run("phases follow the timeline, and the current one is the furthest started", func(t *testing.T) {
		events := []TimelineEvent{
			phaseEvent(PhaseStarted, "p1", phaseSourceAutomatic, 1000),
			phaseEvent(PhaseDone, "p1", phaseSourceManual, 2000),
			phaseEvent(PhaseStarted, "p2", phaseSourceManual, 2000),
		}

		phases := ComputeCustomPhases(customPhases, ledgerFromEvents(events), 1000)

		assert.Equal(t, []string{"Triage:done", "Containment:started*", "Recovery:not_started"}, phaseSummary(phases))
		assert.Equal(t, int64(2000), phases[0].EndedAt)
		assert.Equal(t, int64(2000), phases[1].StartedAt)
	})

	t.Run("a phase kept open next to the current one keeps running", func(t *testing.T) {
		events := []TimelineEvent{
			phaseEvent(PhaseStarted, "p1", phaseSourceAutomatic, 1000),
			phaseEvent(PhaseStarted, "p2", phaseSourceManual, 2000),
		}

		phases := ComputeCustomPhases(customPhases, ledgerFromEvents(events), 1000)

		assert.Equal(t, []string{"Triage:started", "Containment:started*", "Recovery:not_started"}, phaseSummary(phases))
		assert.Zero(t, phases[0].EndedAt)
	})

	t.Run("the last phase being done leaves it current", func(t *testing.T) {
		events := []TimelineEvent{
			phaseEvent(PhaseStarted, "p1", phaseSourceAutomatic, 1000),
			phaseEvent(PhaseDone, "p1", phaseSourceManual, 2000),
			phaseEvent(PhaseStarted, "p2", phaseSourceManual, 2000),
			phaseEvent(PhaseDone, "p2", phaseSourceManual, 3000),
			phaseEvent(PhaseStarted, "p3", phaseSourceManual, 3000),
			phaseEvent(PhaseDone, "p3", phaseSourceManual, 4000),
		}

		phases := ComputeCustomPhases(customPhases, ledgerFromEvents(events), 1000)

		assert.Equal(t, []string{"Triage:done", "Containment:done", "Recovery:done*"}, phaseSummary(phases))
	})

	t.Run("a reopened phase runs again", func(t *testing.T) {
		events := []TimelineEvent{
			phaseEvent(PhaseStarted, "p1", phaseSourceAutomatic, 1000),
			phaseEvent(PhaseDone, "p1", phaseSourceManual, 2000),
			phaseEvent(PhaseReopened, "p1", phaseSourceManual, 3000),
		}

		phases := ComputeCustomPhases(customPhases, ledgerFromEvents(events), 1000)

		assert.Equal(t, PhaseStatusStarted, phases[0].Status)
		assert.Equal(t, int64(1000), phases[0].StartedAt)
		assert.Zero(t, phases[0].EndedAt)
	})

	t.Run("no phases, no result", func(t *testing.T) {
		assert.Empty(t, ComputeCustomPhases(nil, ledgerFromEvents(nil), 1000))
	})
}

func TestPopulatePhasesOfARunWithCustomPhases(t *testing.T) {
	t.Run("fills in the phases without reading any task state", func(t *testing.T) {
		store := &phasesStore{}
		run := customRun()

		(&PlaybookRunServiceImpl{store: store}).PopulatePhases(run)

		assert.Equal(t, []string{"Triage:started*", "Containment:not_started", "Recovery:not_started"}, phaseSummary(run.Phases))
		assert.Zero(t, store.reads)
		assert.Nil(t, run.PhaseOverride)
	})

	t.Run("a finished run stops the phases that were still going without finishing them", func(t *testing.T) {
		run := customRun()
		run.EndAt = 5000

		(&PlaybookRunServiceImpl{store: &phasesStore{}}).PopulatePhases(run)

		assert.Equal(t, PhaseStatusStarted, run.Phases[0].Status)
		assert.Equal(t, int64(5000), run.Phases[0].EndedAt)
	})

	t.Run("the run's start in its first phase is written once", func(t *testing.T) {
		store := &phasesStore{}
		run := customRun()
		run.TimelineEvents = nil

		service := &PlaybookRunServiceImpl{store: store}
		require.True(t, service.recordPhaseEvents(run))
		assert.False(t, service.recordPhaseEvents(run))

		require.Len(t, store.events, 1)
		assert.Equal(t, PhaseStarted, store.events[0].EventType)
		assert.Equal(t, int64(1000), store.events[0].EventAt)
		assert.JSONEq(t, `{"checklist_id":"p1","title":"Triage","source":"automatic"}`, store.events[0].Details)
	})
}

func TestMoveRunPhase(t *testing.T) {
	phaseTypes := func(store *stubPhaseStore) []timelineEventType { return eventTypes(store.events) }

	t.Run("moving on finishes the phase it leaves and starts the next, by the person", func(t *testing.T) {
		svc, store := newPhaseServiceHarness(t, customRun())

		require.NoError(t, svc.MoveRunPhase("run1", "user1", true))

		assert.Equal(t, []timelineEventType{PhaseDone, CurrentPhaseChanged, PhaseStarted}, phaseTypes(store))
		for _, event := range store.events {
			assert.Equal(t, "user1", event.SubjectUserID)
		}
		var moved CurrentPhaseChangedDetails
		require.NoError(t, json.Unmarshal([]byte(store.events[1].Details), &moved))
		assert.Equal(t, CurrentPhaseChangedDetails{FromChecklistID: "p1", FromTitle: "Triage", ToChecklistID: "p2", ToTitle: "Containment"}, moved)
		assert.JSONEq(t, `{"checklist_id":"p1","title":"Triage","source":"manual"}`, store.events[0].Details)
		assert.JSONEq(t, `{"checklist_id":"p2","title":"Containment","source":"manual"}`, store.events[2].Details)
	})

	t.Run("moving on can leave the phase open", func(t *testing.T) {
		svc, store := newPhaseServiceHarness(t, customRun())

		require.NoError(t, svc.MoveRunPhase("run1", "user1", false))

		assert.Equal(t, []timelineEventType{CurrentPhaseChanged, PhaseStarted}, phaseTypes(store))
	})

	t.Run("a phase that is already done is not finished again", func(t *testing.T) {
		run := customRun(phaseEvent(PhaseDone, "p1", phaseSourceManual, 1500))
		svc, store := newPhaseServiceHarness(t, run)

		require.NoError(t, svc.MoveRunPhase("run1", "user1", true))

		assert.Equal(t, []timelineEventType{CurrentPhaseChanged, PhaseStarted}, phaseTypes(store))
	})

	t.Run("moves on from wherever the run is", func(t *testing.T) {
		run := customRun(phaseEvent(PhaseDone, "p1", phaseSourceManual, 1500), phaseEvent(PhaseStarted, "p2", phaseSourceManual, 1500))
		svc, store := newPhaseServiceHarness(t, run)

		require.NoError(t, svc.MoveRunPhase("run1", "user1", true))

		assert.Equal(t, []timelineEventType{PhaseDone, CurrentPhaseChanged, PhaseStarted}, phaseTypes(store))
		assert.JSONEq(t, `{"checklist_id":"p3","title":"Recovery","source":"manual"}`, store.events[2].Details)
	})

	t.Run("there is nothing to move to from the last phase", func(t *testing.T) {
		run := customRun(
			phaseEvent(PhaseDone, "p1", phaseSourceManual, 1500), phaseEvent(PhaseStarted, "p2", phaseSourceManual, 1500),
			phaseEvent(PhaseDone, "p2", phaseSourceManual, 1600), phaseEvent(PhaseStarted, "p3", phaseSourceManual, 1600),
		)
		svc, store := newPhaseServiceHarness(t, run)

		require.ErrorIs(t, svc.MoveRunPhase("run1", "user1", true), ErrPhaseTransition)

		assert.Empty(t, store.events)
	})

	t.Run("it is refused for runs that cannot move phases", func(t *testing.T) {
		taskLists := customRun()
		taskLists.UseChecklistsAsPhases = true
		finished := customRun()
		finished.CurrentStatus = StatusFinished
		none := customRun()
		none.CustomPhases = nil

		for name, run := range map[string]*PlaybookRun{"task lists as phases": taskLists, "no phases": none} {
			t.Run(name, func(t *testing.T) {
				svc, store := newPhaseServiceHarness(t, run)

				require.ErrorIs(t, svc.MoveRunPhase("run1", "user1", true), ErrPhasesNotEnabled)
				assert.Empty(t, store.events)
			})
		}
		t.Run("a finished run", func(t *testing.T) {
			svc, store := newPhaseServiceHarness(t, finished)

			require.ErrorIs(t, svc.MoveRunPhase("run1", "user1", true), ErrPlaybookRunNotActive)
			assert.Empty(t, store.events)
		})
	})

	t.Run("when someone else changed the phases at the same moment, nothing is written", func(t *testing.T) {
		run := customRun()
		svc, store := newPhaseServiceHarness(t, run)
		store.token = "someone else"

		require.ErrorIs(t, svc.MoveRunPhase("run1", "user1", true), ErrPlaybookRunChanged)

		assert.Empty(t, store.events)
	})
}

func TestSetRunPhaseDone(t *testing.T) {
	t.Run("marks a started phase done", func(t *testing.T) {
		svc, store := newPhaseServiceHarness(t, customRun())

		require.NoError(t, svc.SetRunPhaseDone("run1", "user1", "p1", true))

		require.Equal(t, []timelineEventType{PhaseDone}, eventTypes(store.events))
		assert.Equal(t, "user1", store.events[0].SubjectUserID)
		assert.JSONEq(t, `{"checklist_id":"p1","title":"Triage","source":"manual"}`, store.events[0].Details)
	})

	t.Run("reopens a done phase", func(t *testing.T) {
		svc, store := newPhaseServiceHarness(t, customRun(phaseEvent(PhaseDone, "p1", phaseSourceManual, 1500)))

		require.NoError(t, svc.SetRunPhaseDone("run1", "user1", "p1", false))

		assert.Equal(t, []timelineEventType{PhaseReopened}, eventTypes(store.events))
	})

	t.Run("doing what is already so is not an error and writes nothing", func(t *testing.T) {
		done := customRun(phaseEvent(PhaseDone, "p1", phaseSourceManual, 1500))
		svc, store := newPhaseServiceHarness(t, done)
		require.NoError(t, svc.SetRunPhaseDone("run1", "user1", "p1", true))
		assert.Empty(t, store.events)

		svc, store = newPhaseServiceHarness(t, customRun())
		require.NoError(t, svc.SetRunPhaseDone("run1", "user1", "p1", false))
		assert.Empty(t, store.events)
	})

	t.Run("a phase that has not started cannot be reopened", func(t *testing.T) {
		svc, store := newPhaseServiceHarness(t, customRun())

		require.ErrorIs(t, svc.SetRunPhaseDone("run1", "user1", "p2", false), ErrPhaseTransition)

		assert.Empty(t, store.events)
	})

	t.Run("a phase that has not started cannot be done", func(t *testing.T) {
		svc, store := newPhaseServiceHarness(t, customRun())

		require.ErrorIs(t, svc.SetRunPhaseDone("run1", "user1", "p2", true), ErrPhaseTransition)

		assert.Empty(t, store.events)
	})

	t.Run("an unknown phase is refused", func(t *testing.T) {
		svc, store := newPhaseServiceHarness(t, customRun())

		require.ErrorIs(t, svc.SetRunPhaseDone("run1", "user1", "nope", true), ErrPhaseNotFound)

		assert.Empty(t, store.events)
	})

	t.Run("a finished run is refused", func(t *testing.T) {
		run := customRun()
		run.CurrentStatus = StatusFinished
		svc, store := newPhaseServiceHarness(t, run)

		require.ErrorIs(t, svc.SetRunPhaseDone("run1", "user1", "p1", true), ErrPlaybookRunNotActive)

		assert.Empty(t, store.events)
	})
}

func TestNormalizePhases(t *testing.T) {
	t.Run("it leaves the other phase settings alone", func(t *testing.T) {
		playbook := Playbook{UseChecklistsAsPhases: true}

		require.NoError(t, playbook.NormalizePhases())

		assert.False(t, playbook.PhasesEnabled)
		assert.True(t, playbook.UseChecklistsAsPhases)
	})

	t.Run("names are trimmed and phases get ids that stay as they were", func(t *testing.T) {
		keep := model.NewId()
		playbook := Playbook{CustomPhases: []CustomPhase{{ID: keep, Title: "  Triage "}, {Title: "Contain"}}}

		require.NoError(t, playbook.NormalizePhases())

		assert.Equal(t, keep, playbook.CustomPhases[0].ID)
		assert.Equal(t, "Triage", playbook.CustomPhases[0].Title)
		assert.True(t, model.IsValidId(playbook.CustomPhases[1].ID))
		assert.NotEqual(t, keep, playbook.CustomPhases[1].ID)
	})

	t.Run("an id that is not valid is replaced", func(t *testing.T) {
		playbook := Playbook{CustomPhases: []CustomPhase{{ID: "not-an-id!", Title: "One"}}}

		require.NoError(t, playbook.NormalizePhases())

		assert.True(t, model.IsValidId(playbook.CustomPhases[0].ID))
	})

	t.Run("a repeated id is replaced so phases stay apart", func(t *testing.T) {
		same := model.NewId()
		playbook := Playbook{CustomPhases: []CustomPhase{{ID: same, Title: "One"}, {ID: same, Title: "Two"}}}

		require.NoError(t, playbook.NormalizePhases())

		assert.NotEqual(t, playbook.CustomPhases[0].ID, playbook.CustomPhases[1].ID)
	})

	t.Run("it refuses what cannot be a phase list", func(t *testing.T) {
		tooMany := make([]CustomPhase, MaxCustomPhases+1)
		for i := range tooMany {
			tooMany[i] = CustomPhase{Title: string(rune('a'+i%26)) + string(rune('a'+i/26))}
		}
		longName := make([]rune, MaxCustomPhaseTitleLength+1)
		for i := range longName {
			longName[i] = 'x'
		}

		cases := map[string][]CustomPhase{
			"an empty name":                 {{Title: "  "}},
			"a name that is too long":       {{Title: string(longName)}},
			"two phases with the same name": {{Title: "Triage"}, {Title: "triage"}},
			"too many phases":               tooMany,
		}
		for name, phases := range cases {
			t.Run(name, func(t *testing.T) {
				playbook := Playbook{CustomPhases: phases}

				assert.Error(t, playbook.NormalizePhases())
			})
		}
	})
}

func TestARunTakesItsPhasesFromThePlaybook(t *testing.T) {
	configure := func(playbook Playbook) *PlaybookRun {
		run := &PlaybookRun{}
		run.SetConfigurationFromPlaybook(playbook, "")
		return run
	}

	t.Run("custom phases are copied when phases are enabled without task lists", func(t *testing.T) {
		run := configure(Playbook{PhasesEnabled: true, CustomPhases: customPhases})

		assert.False(t, run.UseChecklistsAsPhases)
		assert.Equal(t, customPhases, run.CustomPhases)
		assert.True(t, run.UsesPhases())
	})

	t.Run("task lists are used when the playbook says so, and its custom phases are left out", func(t *testing.T) {
		run := configure(Playbook{PhasesEnabled: true, UseChecklistsAsPhases: true, CustomPhases: customPhases})

		assert.True(t, run.UseChecklistsAsPhases)
		assert.Empty(t, run.CustomPhases)
	})

	t.Run("a playbook with phases off gives its runs none, whatever it keeps", func(t *testing.T) {
		run := configure(Playbook{PhasesEnabled: false, UseChecklistsAsPhases: true, CustomPhases: customPhases})

		assert.False(t, run.UsesPhases())
	})

	t.Run("the run's phases are its own copy", func(t *testing.T) {
		source := []CustomPhase{{ID: "p1", Title: "Triage"}}
		run := configure(Playbook{PhasesEnabled: true, CustomPhases: source})

		source[0].Title = "Changed later"

		assert.Equal(t, "Triage", run.CustomPhases[0].Title)
	})
}

func TestPlaybookCloneKeepsItsPhases(t *testing.T) {
	t.Run("an empty list stays empty, not nil, so it is sent as []", func(t *testing.T) {
		clone := Playbook{CustomPhases: []CustomPhase{}}.Clone()

		assert.NotNil(t, clone.CustomPhases)
		assert.Empty(t, clone.CustomPhases)
	})

	t.Run("the phases are a copy", func(t *testing.T) {
		original := Playbook{CustomPhases: []CustomPhase{{ID: "p1", Title: "Triage"}}}

		clone := original.Clone()
		clone.CustomPhases[0].Title = "Changed"

		assert.Equal(t, "Triage", original.CustomPhases[0].Title)
	})
}
