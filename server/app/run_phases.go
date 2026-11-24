// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

	// EndedAt is when the phase's last task was finished. A phase the run moved past with tasks
	// still open ends when the next phase started, and one still active when the run ended ends
	// then. 0 while the phase is active, in which case it has run from StartedAt until now.
	EndedAt int64 `json:"ended_at"`
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
	byItem := make(map[string][]ChecklistItemStateChange)
	for _, change := range changes {
		byItem[change.ItemID] = append(byItem[change.ItemID], change)
	}

	phases := make([]RunPhase, 0, len(checklists))
	for _, checklist := range checklists {
		phases = append(phases, computePhase(checklist, byItem))
	}
	markCurrentPhase(phases)
	endPhasesAtNextStart(phases)
	return phases
}

// hasActivity reports whether work has started in a phase, as opposed to it being untouched or
// only skipped.
func (p RunPhase) hasActivity() bool {
	return p.Status == PhaseStatusStarted || p.Status == PhaseStatusBlocked || p.Status == PhaseStatusDone
}

func markCurrentPhase(phases []RunPhase) {
	furthest := -1
	for i, phase := range phases {
		if phase.hasActivity() {
			furthest = i
		}
	}

	current := furthest
	if furthest == -1 || phases[furthest].Status == PhaseStatusDone {
		for i := furthest + 1; i < len(phases); i++ {
			if phases[i].Status != PhaseStatusSkipped {
				current = i
				break
			}
		}
	}
	if current >= 0 {
		phases[current].Current = true
	}
}

// endPhasesAtNextStart stops the clock of a phase the run moved past while it still had open
// tasks, at the moment the next phase to start did.
func endPhasesAtNextStart(phases []RunPhase) {
	for i := range phases {
		if phases[i].StartedAt == 0 || phases[i].EndedAt != 0 {
			continue
		}
		var next int64
		for _, later := range phases[i+1:] {
			next = earliest(next, later.StartedAt)
		}
		if next > 0 {
			phases[i].EndedAt = max(next, phases[i].StartedAt)
		}
	}
}

func computePhase(checklist Checklist, byItem map[string][]ChecklistItemStateChange) RunPhase {
	phase := RunPhase{ChecklistID: checklist.ID, Title: checklist.Title, Status: PhaseStatusNotStarted}

	var (
		total, finished, closed int
		blocked, started        bool
		firstActive             int64 // earliest moment any task became in progress, closed or blocked
		lastFinished            int64 // latest moment a task was finished
	)
	for _, item := range checklist.Items {
		if item.ConditionAction == ConditionActionHidden {
			continue
		}
		total++

		itemChanges := byItem[item.ID]
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
		if item.State == ChecklistItemStateInProgress || item.State == ChecklistItemStateClosed || item.State == ChecklistItemStateBlocked {
			firstActive = earliest(firstActive, firstActiveAt(itemChanges, item.StateModified))
		}
	}

	phase.TasksTotal = total
	phase.TasksOpen = total - finished

	switch {
	case blocked:
		phase.Status = PhaseStatusBlocked
		phase.StartedAt = firstActive
	case total > 0 && finished == total && closed == 0:
		phase.Status = PhaseStatusSkipped
	case total > 0 && finished == total:
		phase.Status = PhaseStatusDone
		phase.EndedAt = lastFinished
		phase.StartedAt = firstActive
		if phase.StartedAt == 0 {
			phase.StartedAt = lastFinished
		}
	case started:
		phase.Status = PhaseStatusStarted
		phase.StartedAt = firstActive
	}
	return phase
}

// firstActiveAt is when a task first became in progress, closed or blocked, falling back to fallback.
func firstActiveAt(changes []ChecklistItemStateChange, fallback int64) int64 {
	for _, change := range changes {
		if change.ToState == ChecklistItemStateInProgress || change.ToState == ChecklistItemStateClosed || change.ToState == ChecklistItemStateBlocked {
			return change.ChangedAt
		}
	}
	return fallback
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
// otherwise. A failure to read the state changes only costs the timestamps.
func (s *PlaybookRunServiceImpl) PopulatePhases(run *PlaybookRun) {
	if run == nil {
		return
	}
	if !run.UseChecklistsAsPhases {
		run.Phases = nil
		return
	}

	changes, err := s.store.GetChecklistItemStateChanges(run.ID)
	if err != nil {
		logrus.WithError(err).WithField("playbook_run_id", run.ID).Warn("failed to read state changes for run phases")
	}
	run.Phases = capPhasesAtRunEnd(ComputePhases(run.Checklists, changes), run.EndAt)
}

// addPhasesToChanges resends the run's phases in an incremental update, but only when its
// checklists changed, since phases derive from them. The state change log is only read then.
func (s *PlaybookRunServiceImpl) addPhasesToChanges(run *PlaybookRun, changes map[string]interface{}) {
	if run == nil || !run.UseChecklistsAsPhases {
		return
	}
	_, checklistsChanged := changes["checklists"]
	_, checklistsDeleted := changes["_checklist_deletes"]
	if !checklistsChanged && !checklistsDeleted {
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
