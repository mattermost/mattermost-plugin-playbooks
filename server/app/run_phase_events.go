// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"slices"
	"sort"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	stripmd "github.com/writeas/go-strip-markdown"
)

// The timeline is the record of a run's phases. A phase's start and end are read from its phase
// events, which are written once, at the time the change really happened, by recordPhaseEvents.
// Phase status, counts and the current phase are still computed from the tasks.

// CurrentPhaseChangedDetails is the JSON payload of a current_phase_changed timeline event: a
// person moving the run's current phase.
type CurrentPhaseChangedDetails struct {
	FromChecklistID string `json:"from_checklist_id"`
	FromTitle       string `json:"from_title"`
	ToChecklistID   string `json:"to_checklist_id"`
	ToTitle         string `json:"to_title"`
}

// isPhaseEvent reports whether an event type is one of the phase events of the run's timeline.
func isPhaseEvent(eventType timelineEventType) bool {
	switch eventType {
	case PhaseStarted, PhaseDone, PhaseReopened, CurrentPhaseChanged:
		return true
	default:
		return false
	}
}

type phaseLedgerEntry struct {
	startedAt int64

	// doneAt is when the phase was done, 0 while it is going. A later start or reopening clears it.
	doneAt int64
}

// phaseLedger is what the timeline says about each phase.
type phaseLedger struct {
	entries map[string]phaseLedgerEntry
}

// phaseEventRank orders events that happened at the same moment: a phase starts, then is done,
// then is reopened.
func phaseEventRank(eventType timelineEventType) int {
	switch eventType {
	case PhaseStarted:
		return 0
	case PhaseDone:
		return 1
	default:
		return 2
	}
}

// ledgerFromEvents reads the phases' history from the run's timeline events. Events a person
// deleted do not count, although phase events cannot be deleted.
func ledgerFromEvents(events []TimelineEvent) phaseLedger {
	var phaseEvents []TimelineEvent
	for _, event := range events {
		if event.DeleteAt == 0 && (event.EventType == PhaseStarted || event.EventType == PhaseDone || event.EventType == PhaseReopened) {
			phaseEvents = append(phaseEvents, event)
		}
	}
	sort.SliceStable(phaseEvents, func(i, j int) bool {
		if phaseEvents[i].EventAt != phaseEvents[j].EventAt {
			return phaseEvents[i].EventAt < phaseEvents[j].EventAt
		}
		return phaseEventRank(phaseEvents[i].EventType) < phaseEventRank(phaseEvents[j].EventType)
	})

	ledger := phaseLedger{entries: make(map[string]phaseLedgerEntry)}
	for _, event := range phaseEvents {
		var details PhaseEventDetails
		if err := json.Unmarshal([]byte(event.Details), &details); err != nil || details.ChecklistID == "" {
			continue
		}

		entry, known := ledger.entries[details.ChecklistID]
		if !known {
			entry.startedAt = event.EventAt
		}
		switch event.EventType {
		case PhaseDone:
			entry.doneAt = event.EventAt
		default:
			entry.doneAt = 0
		}
		ledger.entries[details.ChecklistID] = entry
	}
	return ledger
}

// phaseMove is a phase starting for a reason other than its tasks.
type phaseMove struct {
	checklistID string
	at          int64
}

// firstChecklistWithTasks is the first list a run can be in: an empty list has nothing to do, so the
// run starts in the first one with a visible task.
func firstChecklistWithTasks(checklists []Checklist) string {
	for _, checklist := range checklists {
		for _, item := range checklist.Items {
			if item.ConditionAction != ConditionActionHidden {
				return checklist.ID
			}
		}
	}
	return ""
}

// phaseMoves are the starts the tasks do not tell: the run starting in its first phase, and every
// phase the timeline says started. A phase the run reached stays started when work in the phase
// before it is reopened, so what the timeline recorded is not undone by the tasks.
func phaseMoves(run *PlaybookRun, ledger phaseLedger) []phaseMove {
	var moves []phaseMove
	if first := firstChecklistWithTasks(run.Checklists); first != "" && run.CreateAt > 0 {
		moves = append(moves, phaseMove{checklistID: first, at: run.CreateAt})
	}
	for checklistID, entry := range ledger.entries {
		moves = append(moves, phaseMove{checklistID: checklistID, at: entry.startedAt})
	}
	sort.SliceStable(moves, func(i, j int) bool {
		if moves[i].at != moves[j].at {
			return moves[i].at < moves[j].at
		}
		return moves[i].checklistID < moves[j].checklistID
	})
	return moves
}

// applyPhaseMoves lets those starts set when a phase started: the earliest of its first task
// activity and its first move. A phase a person started is started even if nothing was done in
// it. Where the run goes next never stops a phase: only finishing it does.
func applyPhaseMoves(phases []RunPhase, moves []phaseMove) {
	for i := range phases {
		if phases[i].Status == PhaseStatusSkipped {
			continue
		}
		for _, move := range moves {
			if move.checklistID == phases[i].ChecklistID {
				phases[i].StartedAt = earliest(phases[i].StartedAt, move.at)
				if phases[i].Status == PhaseStatusNotStarted {
					phases[i].Status = PhaseStatusStarted
				}
			}
		}
	}
}

// applyLedger reads each phase's start and end from the timeline, where it has been recorded and
// still agrees with the tasks about whether the phase is done. Otherwise the computed times stand,
// and a skipped phase never has a time.
func applyLedger(phases []RunPhase, ledger phaseLedger) {
	for i := range phases {
		entry, ok := ledger.entries[phases[i].ChecklistID]
		if !ok || phases[i].Status == PhaseStatusSkipped || (phases[i].Status == PhaseStatusDone) != (entry.doneAt > 0) {
			continue
		}
		phases[i].StartedAt = entry.startedAt
		phases[i].EndedAt = entry.doneAt
	}
}

type plannedPhaseEvent struct {
	eventType   timelineEventType
	checklistID string
	title       string
	at          int64
}

// planPhaseEvents lists the phase events the timeline is missing, with the times the changes
// happened. Nothing is planned for a phase whose timeline already agrees with its tasks.
func planPhaseEvents(phases []RunPhase, ledger phaseLedger, now int64) []plannedPhaseEvent {
	var planned []plannedPhaseEvent
	add := func(eventType timelineEventType, phase RunPhase, at int64) {
		planned = append(planned, plannedPhaseEvent{eventType: eventType, checklistID: phase.ChecklistID, title: phase.Title, at: at})
	}

	for _, phase := range phases {
		done := phase.Status == PhaseStatusDone
		active := (phase.Status == PhaseStatusStarted || phase.Status == PhaseStatusBlocked) && phase.StartedAt > 0
		if !done && !active {
			continue
		}

		entry, known := ledger.entries[phase.ChecklistID]
		switch {
		case !known:
			started := phase.StartedAt
			if started == 0 {
				started = phase.EndedAt
			}
			add(PhaseStarted, phase, started)
			if done {
				add(PhaseDone, phase, phase.EndedAt)
			}
		case entry.doneAt == 0 && done:
			add(PhaseDone, phase, phase.EndedAt)
		case entry.doneAt > 0 && active:
			add(PhaseReopened, phase, max(phase.lastChangeAt, entry.doneAt, 1))
		}
	}

	sort.SliceStable(planned, func(i, j int) bool { return planned[i].at < planned[j].at })
	for i := range planned {
		if planned[i].at <= 0 {
			planned[i].at = now
		}
	}
	return planned
}

// recordPhaseEvents writes the phase events the run's timeline is missing, and reports whether it
// wrote any. It is the one place phase events are produced, so the timeline cannot disagree with
// the tasks: every change of a phase is written once, stamped when it happened, however late it is
// noticed. Runs that began before phase events existed are filled in the first time they are read.
// The events are also added to run.TimelineEvents.
func (s *PlaybookRunServiceImpl) recordPhaseEvents(run *PlaybookRun) bool {
	if run == nil || !run.UseChecklistsAsPhases || run.EndAt > 0 {
		return false
	}

	logger := logrus.WithField("playbook_run_id", run.ID)
	changes, err := s.store.GetChecklistItemStateChanges(run.ID)
	if err != nil {
		logger.WithError(err).Warn("failed to read state changes to record phases")
		return false
	}

	ledger := ledgerFromEvents(run.TimelineEvents)
	phases := ComputePhasesWithOverride(run.Checklists, changes, run.PhaseOverrideChecklistID, phaseMoves(run, ledger))
	now := model.GetMillis()
	planned := planPhaseEvents(phases, ledger, now)
	if len(planned) == 0 {
		return false
	}

	// Only one of several writers that saw the same gap writes it.
	token := model.NewId()
	won, err := s.store.CompareAndSetPhaseLedgerToken(run.ID, run.PhaseLedgerToken, token)
	if err != nil {
		logger.WithError(err).Warn("failed to claim recording the run's phases")
		return false
	}
	if !won {
		return false
	}
	run.PhaseLedgerToken = token

	for _, plan := range planned {
		verb := map[timelineEventType]string{PhaseStarted: "started", PhaseDone: "done", PhaseReopened: "reopened"}[plan.eventType]
		details := PhaseEventDetails{ChecklistID: plan.checklistID, Title: plan.title, Source: phaseSourceAutomatic}
		s.createPhaseEvent(run, plan.eventType, plan.at, now, "", fmt.Sprintf("Phase **%s** %s", stripmd.Strip(plan.title), verb), details)
	}
	return true
}

// createPhaseEvent writes one phase event and adds it to run.TimelineEvents.
func (s *PlaybookRunServiceImpl) createPhaseEvent(run *PlaybookRun, eventType timelineEventType, eventAt, createAt int64, userID, summary string, details interface{}) {
	encoded, err := json.Marshal(details)
	if err != nil {
		logrus.WithError(err).Warn("failed to encode phase event details")
		return
	}

	event, err := s.store.CreateTimelineEvent(&TimelineEvent{
		PlaybookRunID: run.ID,
		CreateAt:      createAt,
		EventAt:       eventAt,
		EventType:     eventType,
		Summary:       summary,
		SubjectUserID: userID,
		Details:       string(encoded),
	})
	if err != nil {
		logrus.WithError(err).WithField("playbook_run_id", run.ID).Warn("failed to create phase timeline event")
		return
	}
	run.TimelineEvents = append(run.TimelineEvents, *event)
}

// SetRunPhase makes checklistID the run's current phase and keeps it there: once a person did this,
// phases no longer move on their own. Moving it again only changes where it sits.
func (s *PlaybookRunServiceImpl) SetRunPhase(playbookRunID, userID, checklistID string) error {
	run, err := s.GetPlaybookRun(playbookRunID)
	if err != nil {
		return err
	}
	if !run.UseChecklistsAsPhases {
		return errors.Wrap(ErrPhasesNotEnabled, "the run does not use its task lists as phases")
	}
	if err := EnsureRunIsActive(run); err != nil {
		return err
	}
	if !slices.ContainsFunc(run.Checklists, func(c Checklist) bool { return c.ID == checklistID }) {
		return errors.Wrapf(ErrPhaseNotFound, "run %s has no task list %s", playbookRunID, checklistID)
	}
	if run.PhaseOverrideChecklistID == checklistID {
		return nil
	}

	// What the tasks did so far is recorded first, so it comes before this move in the timeline.
	s.recordPhaseEvents(run)

	changes, err := s.store.GetChecklistItemStateChanges(run.ID)
	if err != nil {
		return errors.Wrap(err, "failed to read state changes")
	}
	ledger := ledgerFromEvents(run.TimelineEvents)
	phases := ComputePhasesWithOverride(run.Checklists, changes, run.PhaseOverrideChecklistID, phaseMoves(run, ledger))
	from := currentPhaseOf(phases)
	var to *RunPhase
	for i := range phases {
		if phases[i].ChecklistID == checklistID {
			to = &phases[i]
		}
	}

	now := model.GetMillis()
	if err := s.store.SetPhaseOverride(run.ID, checklistID, userID, now); err != nil {
		return err
	}

	if from != nil && from.ChecklistID != checklistID {
		details := CurrentPhaseChangedDetails{FromChecklistID: from.ChecklistID, FromTitle: from.Title, ToChecklistID: to.ChecklistID, ToTitle: to.Title}
		summary := fmt.Sprintf("Current phase moved from **%s** to **%s**", stripmd.Strip(from.Title), stripmd.Strip(to.Title))
		s.createPhaseEvent(run, CurrentPhaseChanged, now, now, userID, summary, details)
	}
	if _, known := ledger.entries[checklistID]; !known && to != nil {
		details := PhaseEventDetails{ChecklistID: to.ChecklistID, Title: to.Title, Source: phaseSourceManual}
		s.createPhaseEvent(run, PhaseStarted, now, now, userID, fmt.Sprintf("Phase **%s** started", stripmd.Strip(to.Title)), details)
	}

	s.sendPlaybookRunUpdatedWS(playbookRunID)
	return nil
}

// reconcilePhases records any phase changes of run, so a websocket update carries them.
func (s *PlaybookRunServiceImpl) reconcilePhases(run *PlaybookRun) *PlaybookRun {
	s.recordPhaseEvents(run)
	return run
}
