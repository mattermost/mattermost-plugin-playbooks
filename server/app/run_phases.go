// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"

	"github.com/sirupsen/logrus"
)

// PhaseStatus is where a run phase stands, derived from the state of its tasks.
type PhaseStatus string

const (
	PhaseStatusNotStarted PhaseStatus = "not_started"
	PhaseStatusStarted    PhaseStatus = "started"
	PhaseStatusDone       PhaseStatus = "done"
	PhaseStatusBlocked    PhaseStatus = "blocked"

	// PhaseStatusSkipped is a phase whose tasks were all skipped. It lets the run move on but is
	// not finished work, so it is kept apart from PhaseStatusDone.
	PhaseStatusSkipped PhaseStatus = "skipped"
)

// PhaseOverride tells that a person took over the run's current phase, and who and when.
type PhaseOverride struct {
	ChecklistID string `json:"checklist_id"`
	SetBy       string `json:"set_by"`
	SetAt       int64  `json:"set_at"`
}

// PhaseEventDetails is the JSON payload of the phase_started, phase_done and phase_reopened timeline events.
type PhaseEventDetails struct {
	ChecklistID string `json:"checklist_id"`
	Title       string `json:"title"`

	// Source is phaseSourceAutomatic when the tasks moved the run, phaseSourceManual when a person did.
	Source string `json:"source"`
}

const (
	phaseSourceAutomatic = "automatic"
	phaseSourceManual    = "manual"
)

// RunPhase is a checklist presented as a phase of the run. It is computed and never persisted.
type RunPhase struct {
	ChecklistID string      `json:"checklist_id"`
	Title       string      `json:"title"`
	Status      PhaseStatus `json:"status"`

	// Current marks where the run is: the furthest phase where work has started, or the phase up
	// next once that one is finished. At most one phase is current.
	Current bool `json:"current"`

	// TasksOpen and TasksTotal count the phase's visible tasks, open being those not yet closed
	// or skipped.
	TasksOpen  int `json:"tasks_open"`
	TasksTotal int `json:"tasks_total"`

	// StartedAt is when the phase first had activity, 0 if it has not started.
	StartedAt int64 `json:"started_at"`

	// EndedAt is when the phase's last task was finished, or when the run ended if the phase was
	// still going. Moving on to another phase does not end a phase. 0 while the phase is going, in
	// which case it has run from StartedAt until now.
	EndedAt int64 `json:"ended_at"`

	// lastChangeAt is when anything last happened to one of the phase's tasks.
	lastChangeAt int64
}

// ComputePhases maps each checklist to a phase. A phase is blocked if any task is blocked, done
// once every task is closed or skipped (skipped if none were closed), started once any task is in
// progress or closed, and not started otherwise. Hidden tasks are ignored, and a phase without
// tasks is not started.
//
// The current phase is the furthest one where work has started, so follow-up tasks left open in an
// earlier phase do not hold the run back. If that phase is finished, the next one that is not
// skipped is current. A run where nothing has started is at its first phase that is not skipped.
//
// StartedAt and EndedAt come from the task state changes (oldest first). A task with no recorded
// change, such as one that moved before changes were recorded, falls back to its StateModified.
func ComputePhases(checklists []Checklist, changes []ChecklistItemStateChange) []RunPhase {
	return ComputePhasesWithOverride(checklists, changes, "", nil)
}

// ComputePhasesWithOverride is ComputePhases for a run whose current phase a person took over.
// The phase named by overrideChecklistID is the current one whatever the tasks say, and statuses
// and times are still computed. An override naming a checklist that no longer exists is ignored.
//
// moves are the times people started phases. Starting a phase counts as its start whatever
// happened to its tasks.
func ComputePhasesWithOverride(checklists []Checklist, changes []ChecklistItemStateChange, overrideChecklistID string, moves []phaseMove) []RunPhase {
	byItem := make(map[string][]ChecklistItemStateChange)
	for _, change := range changes {
		byItem[change.ItemID] = append(byItem[change.ItemID], change)
	}

	phases := make([]RunPhase, 0, len(checklists))
	for _, checklist := range checklists {
		phases = append(phases, computePhase(checklist, byItem))
	}
	startNextPhase(phases)
	applyPhaseMoves(phases, moves)
	if !markOverriddenPhase(phases, overrideChecklistID) {
		markCurrentPhase(phases)
	}
	return phases
}

// hasActivity reports whether work has started in a phase, as opposed to it being untouched or
// only skipped.
func (p RunPhase) hasActivity() bool {
	return p.Status == PhaseStatusStarted || p.Status == PhaseStatusBlocked || p.Status == PhaseStatusDone
}

// markOverriddenPhase marks the phase a person chose as current, reporting whether it exists.
func markOverriddenPhase(phases []RunPhase, checklistID string) bool {
	if checklistID == "" {
		return false
	}
	for i := range phases {
		if phases[i].ChecklistID == checklistID {
			phases[i].Current = true
			return true
		}
	}
	return false
}

// currentPhaseOf returns the phase marked current, or nil when there is none.
func currentPhaseOf(phases []RunPhase) *RunPhase {
	for i := range phases {
		if phases[i].Current {
			return &phases[i]
		}
	}
	return nil
}

// automaticCurrent is the phase the tasks alone make current, along with the furthest phase where
// work has started, -1 when there is none.
func automaticCurrent(phases []RunPhase) (current, furthest int) {
	furthest = -1
	for i, phase := range phases {
		if phase.hasActivity() {
			furthest = i
		}
	}

	current = furthest
	if furthest == -1 || phases[furthest].Status == PhaseStatusDone {
		for i := furthest + 1; i < len(phases); i++ {
			if phases[i].Status != PhaseStatusSkipped {
				current = i
				break
			}
		}
	}
	return current, furthest
}

// startNextPhase starts each phase at the moment the run reached it: when the phase before it
// (skipping skipped ones) was finished. That holds whoever is in charge of the current phase and
// however late work in the phase began, so a phase finished long after the run reached it has run
// since then.
func startNextPhase(phases []RunPhase) {
	previous := -1
	for i := range phases {
		if phases[i].Status == PhaseStatusSkipped {
			continue
		}
		if previous >= 0 && phases[previous].Status == PhaseStatusDone && phases[previous].EndedAt > 0 {
			phases[i].StartedAt = earliest(phases[i].StartedAt, phases[previous].EndedAt)
			if phases[i].Status == PhaseStatusNotStarted {
				phases[i].Status = PhaseStatusStarted
			}
		}
		previous = i
	}
}

func markCurrentPhase(phases []RunPhase) {
	if current, _ := automaticCurrent(phases); current >= 0 {
		phases[current].Current = true
	}
}

func computePhase(checklist Checklist, byItem map[string][]ChecklistItemStateChange) RunPhase {
	phase := RunPhase{ChecklistID: checklist.ID, Title: checklist.Title, Status: PhaseStatusNotStarted}

	var (
		total, finished, closed int
		blocked, started        bool
		worked                  bool  // something other than skipping happened to a task
		firstActive             int64 // earliest moment anything happened to any task
		lastFinished            int64 // latest moment a task was finished
	)
	for _, item := range checklist.Items {
		if item.ConditionAction == ConditionActionHidden {
			continue
		}
		total++

		itemChanges := byItem[item.ID]
		if len(itemChanges) > 0 {
			phase.lastChangeAt = max(phase.lastChangeAt, itemChanges[len(itemChanges)-1].ChangedAt)
		} else {
			phase.lastChangeAt = max(phase.lastChangeAt, item.StateModified)
		}
		switch item.State {
		case ChecklistItemStateBlocked:
			blocked = true
		case ChecklistItemStateClosed, ChecklistItemStateSkipped:
			finished++
			if item.State == ChecklistItemStateClosed {
				closed++
			}
			lastFinished = max(lastFinished, lastChangeInto(itemChanges, item.State, item.StateModified))
		}

		if item.State == ChecklistItemStateInProgress || item.State == ChecklistItemStateClosed {
			started = true
		}
		firstActive = earliest(firstActive, firstTouchedAt(itemChanges, item))
		for _, change := range itemChanges {
			if change.ToState != ChecklistItemStateSkipped {
				worked = true
			}
		}
	}

	phase.TasksTotal = total
	phase.TasksOpen = total - finished

	phase.StartedAt = firstActive
	switch {
	case blocked:
		phase.Status = PhaseStatusBlocked
	case total > 0 && finished == total && closed == 0:
		// Skipping is not work: a skipped phase has no time, and its tasks never start the next one.
		phase.Status = PhaseStatusSkipped
		phase.StartedAt = 0
	case total > 0 && finished == total:
		phase.Status = PhaseStatusDone
		phase.EndedAt = lastFinished
		if phase.StartedAt == 0 {
			phase.StartedAt = lastFinished
		}
	case started || worked:
		// Anything but skipping started the phase, even if it left the task open again.
		phase.Status = PhaseStatusStarted
	}
	return phase
}

// firstTouchedAt is when anything first happened to a task: its first recorded state change, or its
// StateModified when it moved before changes were recorded. 0 for a task nobody touched.
func firstTouchedAt(changes []ChecklistItemStateChange, item ChecklistItem) int64 {
	if len(changes) > 0 {
		return changes[0].ChangedAt
	}
	if item.State == "" || item.State == ChecklistItemStateOpen {
		return 0
	}
	return item.StateModified
}

// lastChangeInto is when a task last moved into state, falling back to fallback.
func lastChangeInto(changes []ChecklistItemStateChange, state string, fallback int64) int64 {
	for i := len(changes) - 1; i >= 0; i-- {
		if changes[i].ToState == state {
			return changes[i].ChangedAt
		}
	}
	return fallback
}

// earliest returns the smaller of two timestamps, treating 0 as unset.
func earliest(current, candidate int64) int64 {
	if candidate <= 0 {
		return current
	}
	if current == 0 || candidate < current {
		return candidate
	}
	return current
}

// PopulatePhases fills in run.Phases when the run uses its checklists as phases, and clears them
// otherwise. It first records any phase change in the timeline, which is where a phase's start and
// end are read from. A failure to read the state changes only costs the timestamps.
func (s *PlaybookRunServiceImpl) PopulatePhases(run *PlaybookRun) {
	if run == nil {
		return
	}
	if !run.UseChecklistsAsPhases {
		run.Phases = nil
		run.PhaseOverride = nil
		return
	}

	s.recordPhaseEvents(run)

	changes, err := s.store.GetChecklistItemStateChanges(run.ID)
	if err != nil {
		logrus.WithError(err).WithField("playbook_run_id", run.ID).Warn("failed to read state changes for run phases")
	}
	ledger := ledgerFromEvents(run.TimelineEvents)
	phases := ComputePhasesWithOverride(run.Checklists, changes, run.PhaseOverrideChecklistID, phaseMoves(run, ledger))
	applyLedger(phases, ledger)
	run.Phases = capPhasesAtRunEnd(phases, run.EndAt)

	run.PhaseOverride = nil
	if run.PhaseOverrideChecklistID != "" {
		run.PhaseOverride = &PhaseOverride{ChecklistID: run.PhaseOverrideChecklistID, SetBy: run.PhaseOverrideSetBy, SetAt: run.PhaseOverrideSetAt}
	}
}

// phaseDependentChanges are the changed fields that move a run's phases: its checklists, the end of
// the run, which stops the timers of the phases still going, and the timeline their times come from.
var phaseDependentChanges = []string{"checklists", "_checklist_deletes", "end_at", "current_status", "timeline_events"}

// addPhasesToChanges resends the run's phases in an incremental update when something they derive
// from changed. The state change log is only read then.
func (s *PlaybookRunServiceImpl) addPhasesToChanges(run *PlaybookRun, changes map[string]interface{}) {
	if run == nil || !run.UseChecklistsAsPhases {
		return
	}
	if !slices.ContainsFunc(phaseDependentChanges, func(field string) bool { _, ok := changes[field]; return ok }) {
		return
	}

	s.PopulatePhases(run)
	changes["phases"] = run.Phases
}

// capPhasesAtRunEnd stops the clock of phases still active when the run ended, so a finished run's
// phases do not keep growing. It matches how run timing treats an ended run.
func capPhasesAtRunEnd(phases []RunPhase, runEndAt int64) []RunPhase {
	if runEndAt <= 0 {
		return phases
	}
	for i := range phases {
		if phases[i].StartedAt > 0 && phases[i].EndedAt == 0 {
			phases[i].EndedAt = max(runEndAt, phases[i].StartedAt)
		}
	}
	return phases
}
