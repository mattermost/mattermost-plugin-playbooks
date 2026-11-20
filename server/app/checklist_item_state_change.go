// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const maxRunChangedAttempts = 3

// retryIfRunChanged reapplies a change that lost a race with another write to the same run, so
// neither write's checklist changes are lost.
func retryIfRunChanged(apply func() error) error {
	var err error
	for range maxRunChangedAttempts {
		if err = apply(); !errors.Is(err, ErrPlaybookRunChanged) {
			return err
		}
	}
	return err
}

// checklistTarget is the checklist, or checklist item, a request picked by position. A retry must
// change what the user picked even if the checklists were reordered in between, so after the first
// attempt the target is found by the IDs it had then.
type checklistTarget struct {
	checklistNumber int
	itemNumber      int
	located         bool
	checklistID     string
	itemID          string
}

func newChecklistTarget(checklistNumber, itemNumber int) *checklistTarget {
	return &checklistTarget{checklistNumber: checklistNumber, itemNumber: itemNumber}
}

// locate returns where the target is in run. IDs that were missing on the first attempt are not
// tracked, since the IDs filled in for that attempt are only kept if its write succeeds.
func (t *checklistTarget) locate(run *PlaybookRun) (int, int, error) {
	if !t.located {
		t.located = true
		if t.checklistNumber >= 0 && t.checklistNumber < len(run.Checklists) {
			checklist := run.Checklists[t.checklistNumber]
			t.checklistID = checklist.ID
			if t.itemNumber >= 0 && t.itemNumber < len(checklist.Items) {
				t.itemID = checklist.Items[t.itemNumber].ID
			}
		}
		return t.checklistNumber, t.itemNumber, nil
	}

	if t.itemID != "" {
		for i, checklist := range run.Checklists {
			if j := slices.IndexFunc(checklist.Items, func(item ChecklistItem) bool { return item.ID == t.itemID }); j >= 0 {
				return i, j, nil
			}
		}
		return 0, 0, errors.Wrap(ErrNotFound, "the checklist item no longer exists")
	}
	if t.checklistID != "" {
		i := slices.IndexFunc(run.Checklists, func(checklist Checklist) bool { return checklist.ID == t.checklistID })
		if i < 0 {
			return 0, 0, errors.Wrap(ErrNotFound, "the checklist no longer exists")
		}
		return i, t.itemNumber, nil
	}
	return t.checklistNumber, t.itemNumber, nil
}

func (s *PlaybookRunServiceImpl) checklistTargetVerify(playbookRunID string, target *checklistTarget) (*PlaybookRun, int, int, error) {
	playbookRunToModify, err := s.GetPlaybookRun(playbookRunID)
	if err != nil {
		return nil, 0, 0, errors.Wrapf(err, "failed to retrieve playbook run")
	}

	checklistNumber, itemNumber, err := target.locate(playbookRunToModify)
	if err != nil {
		return nil, 0, 0, err
	}
	if checklistNumber < 0 || checklistNumber >= len(playbookRunToModify.Checklists) {
		return nil, 0, 0, errors.New("invalid checklist number")
	}

	fillMissingChecklistIDs(playbookRunToModify.Checklists)
	return playbookRunToModify, checklistNumber, itemNumber, nil
}

func (s *PlaybookRunServiceImpl) checklistItemTargetVerify(playbookRunID string, target *checklistTarget) (*PlaybookRun, int, int, error) {
	playbookRunToModify, checklistNumber, itemNumber, err := s.checklistTargetVerify(playbookRunID, target)
	if err != nil {
		return nil, 0, 0, err
	}
	if itemNumber < 0 || itemNumber >= len(playbookRunToModify.Checklists[checklistNumber].Items) {
		return nil, 0, 0, errors.New("invalid item number")
	}
	return playbookRunToModify, checklistNumber, itemNumber, nil
}

// ModifyCheckedState checks or unchecks the specified checklist item. Idempotent, will not perform
// any action if the checklist item is already in the given checked state.
// When checking off a task that has requirements, opts may supply RequirementValues; all
// requirements must have non-empty values or the call fails.
func (s *PlaybookRunServiceImpl) ModifyCheckedState(playbookRunID, userID, newState string, checklistNumber, itemNumber int, opts ...ModifyCheckedStateOptions) error {
	target := newChecklistTarget(checklistNumber, itemNumber)
	return retryIfRunChanged(func() error {
		return s.modifyCheckedState(playbookRunID, userID, newState, target, opts...)
	})
}

// SkipChecklist skips the checklist.
func (s *PlaybookRunServiceImpl) SkipChecklist(playbookRunID, userID string, checklistNumber int) error {
	target := newChecklistTarget(checklistNumber, -1)
	return retryIfRunChanged(func() error { return s.skipChecklist(playbookRunID, userID, target) })
}

// RestoreChecklist restores the skipped checklist.
func (s *PlaybookRunServiceImpl) RestoreChecklist(playbookRunID, userID string, checklistNumber int) error {
	target := newChecklistTarget(checklistNumber, -1)
	return retryIfRunChanged(func() error { return s.restoreChecklist(playbookRunID, userID, target) })
}

// SkipChecklistItem skips the item at the given index from the given checklist.
func (s *PlaybookRunServiceImpl) SkipChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int) error {
	target := newChecklistTarget(checklistNumber, itemNumber)
	return retryIfRunChanged(func() error { return s.skipChecklistItem(playbookRunID, userID, target) })
}

// RestoreChecklistItem restores the item at the given index from the given checklist.
func (s *PlaybookRunServiceImpl) RestoreChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int) error {
	target := newChecklistTarget(checklistNumber, itemNumber)
	return retryIfRunChanged(func() error { return s.restoreChecklistItem(playbookRunID, userID, target) })
}

// ChecklistItemStateChange is one state transition of a checklist item. Unlike
// ChecklistItem.StateModified, which only holds the latest change, these records are append-only
// and never deleted, so elapsed time between any two transitions can be computed later.
type ChecklistItemStateChange struct {
	ID          string `json:"id"`
	RunID       string `json:"run_id"`
	ChecklistID string `json:"checklist_id"`
	ItemID      string `json:"item_id"`
	FromState   string `json:"from_state"`
	ToState     string `json:"to_state"`
	UserID      string `json:"user_id"`
	ChangedAt   int64  `json:"changed_at"`

	// BlockedReason and BlockedByUserIDs are set when ToState is blocked.
	BlockedReason    string   `json:"blocked_reason,omitempty"`
	BlockedByUserIDs []string `json:"blocked_by_user_ids,omitempty" db:"-"`
}

// fillMissingChecklistIDs gives checklists and items from runs created before IDs were assigned
// the IDs their state changes are recorded under.
func fillMissingChecklistIDs(checklists []Checklist) {
	for i := range checklists {
		if checklists[i].ID == "" {
			checklists[i].ID = model.NewId()
		}
		for j := range checklists[i].Items {
			if checklists[i].Items[j].ID == "" {
				checklists[i].Items[j].ID = model.NewId()
			}
		}
	}
}

func newChecklistItemStateChange(runID, userID string, checklist Checklist, item ChecklistItem, fromState string, changedAt int64) ChecklistItemStateChange {
	return ChecklistItemStateChange{
		RunID:            runID,
		ChecklistID:      checklist.ID,
		ItemID:           item.ID,
		FromState:        fromState,
		ToState:          item.State,
		UserID:           userID,
		ChangedAt:        changedAt,
		BlockedReason:    item.BlockedReason,
		BlockedByUserIDs: item.BlockedByUserIDs,
	}
}
