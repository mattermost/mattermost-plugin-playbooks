// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	stripmd "github.com/writeas/go-strip-markdown"
)

// The phases of a run that does not use its task lists as phases are moved by people only. These
// are the three things a person can do: move the run to the next phase (finishing the one it leaves,
// or keeping it open), mark a phase done, and reopen a done phase.

// customPhasesRun loads a run for a phase change and checks it can take one: it has custom phases and
// is still going. Its timeline is brought up to date first, so what a person does comes after.
func (s *PlaybookRunServiceImpl) customPhasesRun(playbookRunID string) (*PlaybookRun, []RunPhase, error) {
	run, err := s.GetPlaybookRun(playbookRunID)
	if err != nil {
		return nil, nil, err
	}
	if run.UseChecklistsAsPhases || len(run.CustomPhases) == 0 {
		return nil, nil, errors.Wrap(ErrPhasesNotEnabled, "the run does not have phases of its own")
	}
	if err := EnsureRunIsActive(run); err != nil {
		return nil, nil, err
	}

	s.recordPhaseEvents(run)
	phases, _, err := s.computeRunPhases(run)
	if err != nil {
		return nil, nil, err
	}
	return run, phases, nil
}

// claimPhaseChange lets only one of several people changing the phases at the same moment go
// through, so a double click or two people clicking cannot move the run twice.
func (s *PlaybookRunServiceImpl) claimPhaseChange(run *PlaybookRun) error {
	won, err := s.store.CompareAndSetPhaseLedgerToken(run.ID, run.PhaseLedgerToken, model.NewId())
	if err != nil {
		return errors.Wrap(err, "failed to claim the phase change")
	}
	if !won {
		return ErrPlaybookRunChanged
	}
	return nil
}

func (s *PlaybookRunServiceImpl) createManualPhaseEvent(run *PlaybookRun, userID string, eventType timelineEventType, phase RunPhase, now int64) {
	verb := map[timelineEventType]string{PhaseStarted: "started", PhaseDone: "done", PhaseReopened: "reopened"}[eventType]
	details := PhaseEventDetails{ChecklistID: phase.ChecklistID, Title: phase.Title, Source: phaseSourceManual}
	s.createPhaseEvent(run, eventType, now, now, userID, fmt.Sprintf("Phase **%s** %s", stripmd.Strip(phase.Title), verb), details)
}

// MoveRunPhase moves a run with phases of its own to the next one, which it starts. The phase it
// leaves is finished, unless closeCurrent is false and it is to stay open next to the new one.
func (s *PlaybookRunServiceImpl) MoveRunPhase(playbookRunID, userID string, closeCurrent bool) error {
	run, phases, err := s.customPhasesRun(playbookRunID)
	if err != nil {
		return err
	}

	currentIndex := -1
	for i, phase := range phases {
		if phase.Current {
			currentIndex = i
		}
	}
	if currentIndex < 0 || currentIndex+1 >= len(phases) {
		return errors.Wrap(ErrPhaseTransition, "there is no next phase to move to")
	}
	current, next := phases[currentIndex], phases[currentIndex+1]

	if err := s.claimPhaseChange(run); err != nil {
		return err
	}

	now := model.GetMillis()
	if closeCurrent && current.Status != PhaseStatusDone {
		s.createManualPhaseEvent(run, userID, PhaseDone, current, now)
	}
	details := CurrentPhaseChangedDetails{FromChecklistID: current.ChecklistID, FromTitle: current.Title, ToChecklistID: next.ChecklistID, ToTitle: next.Title}
	summary := fmt.Sprintf("Current phase moved from **%s** to **%s**", stripmd.Strip(current.Title), stripmd.Strip(next.Title))
	s.createPhaseEvent(run, CurrentPhaseChanged, now, now, userID, summary, details)
	s.createManualPhaseEvent(run, userID, PhaseStarted, next, now)

	s.sendPlaybookRunUpdatedWS(playbookRunID)
	return nil
}

// SetRunPhaseDone marks a started phase of a run with phases of its own done, or reopens a done one.
func (s *PlaybookRunServiceImpl) SetRunPhaseDone(playbookRunID, userID, phaseID string, done bool) error {
	run, phases, err := s.customPhasesRun(playbookRunID)
	if err != nil {
		return err
	}

	var target *RunPhase
	for i := range phases {
		if phases[i].ChecklistID == phaseID {
			target = &phases[i]
		}
	}
	if target == nil {
		return errors.Wrapf(ErrPhaseNotFound, "run %s has no phase %s", playbookRunID, phaseID)
	}

	switch {
	case done && target.Status == PhaseStatusDone, !done && target.Status == PhaseStatusStarted:
		return nil
	case done && target.Status != PhaseStatusStarted:
		return errors.Wrap(ErrPhaseTransition, "a phase that has not started cannot be done")
	case !done && target.Status != PhaseStatusDone:
		return errors.Wrap(ErrPhaseTransition, "a phase that has not started cannot be reopened")
	}

	if err := s.claimPhaseChange(run); err != nil {
		return err
	}

	eventType := PhaseReopened
	if done {
		eventType = PhaseDone
	}
	s.createManualPhaseEvent(run, userID, eventType, *target, model.GetMillis())

	s.sendPlaybookRunUpdatedWS(playbookRunID)
	return nil
}
