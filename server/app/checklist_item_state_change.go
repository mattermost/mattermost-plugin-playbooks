// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

// ModifyCheckedState checks or unchecks the specified checklist item. Idempotent, will not perform
// any action if the checklist item is already in the given checked state.
// When checking off a task that has requirements, opts may supply RequirementValues; all
// requirements must have non-empty values or the call fails.
func (s *PlaybookRunServiceImpl) ModifyCheckedState(playbookRunID, userID, newState string, checklistNumber, itemNumber int, opts ...ModifyCheckedStateOptions) error {
	return retryIfRunChanged(func() error {
		return s.modifyCheckedState(playbookRunID, userID, newState, checklistNumber, itemNumber, opts...)
	})
}

// SkipChecklist skips the checklist.
func (s *PlaybookRunServiceImpl) SkipChecklist(playbookRunID, userID string, checklistNumber int) error {
	return retryIfRunChanged(func() error { return s.skipChecklist(playbookRunID, userID, checklistNumber) })
}

// RestoreChecklist restores the skipped checklist.
func (s *PlaybookRunServiceImpl) RestoreChecklist(playbookRunID, userID string, checklistNumber int) error {
	return retryIfRunChanged(func() error { return s.restoreChecklist(playbookRunID, userID, checklistNumber) })
}

// SkipChecklistItem skips the item at the given index from the given checklist.
func (s *PlaybookRunServiceImpl) SkipChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int) error {
	return retryIfRunChanged(func() error { return s.skipChecklistItem(playbookRunID, userID, checklistNumber, itemNumber) })
}

// RestoreChecklistItem restores the item at the given index from the given checklist.
func (s *PlaybookRunServiceImpl) RestoreChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int) error {
	return retryIfRunChanged(func() error { return s.restoreChecklistItem(playbookRunID, userID, checklistNumber, itemNumber) })
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
