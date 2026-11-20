// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

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
