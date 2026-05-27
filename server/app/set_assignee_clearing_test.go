// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestApplyAssigneeUpdate tests the applyAssigneeUpdate package-level helper that
// encapsulates the SetAssignee idempotency check and AssigneeType clearing logic.
//
// Key behaviours:
//   - AssigneeType is ALWAYS cleared to AssigneeTypeSpecificUser (empty string) on every call.
//   - noChangeNeeded (true return) requires BOTH: same assigneeID AND AssigneeType already
//     AssigneeTypeSpecificUser. When noChangeNeeded is true SetAssignee skips the store write.
//   - If AssigneeType was role-based ("owner" / "creator"), noChangeNeeded is false even when
//     the assigneeID matches, forcing the store write so the cleared type is persisted.
func TestApplyAssigneeUpdate(t *testing.T) {
	t.Run("role-based item same user ID — AssigneeType cleared, store write required", func(t *testing.T) {
		// Item has AssigneeType="owner" and AssigneeID="user-1".
		// SetAssignee is called with the same user ID.
		// Even though IDs match, noChangeNeeded must be false because AssigneeType was "owner".
		// After the call AssigneeType must be cleared to "".
		item := &ChecklistItem{
			AssigneeType: AssigneeTypeOwner,
			AssigneeID:   "user-1",
		}

		noChangeNeeded := applyAssigneeUpdate(item, "user-1")

		assert.False(t, noChangeNeeded, "store write must happen to persist the cleared AssigneeType")
		assert.Equal(t, AssigneeTypeSpecificUser, item.AssigneeType, "AssigneeType must be cleared to specific-user")
		assert.Equal(t, "user-1", item.AssigneeID, "AssigneeID must remain unchanged")
	})

	t.Run("role-based item different user ID — AssigneeType cleared, store write required", func(t *testing.T) {
		// Item has AssigneeType="creator" and an empty AssigneeID (typical for unresolved creator).
		// SetAssignee is called with a concrete user ID.
		// AssigneeType must be cleared and the store write must happen.
		item := &ChecklistItem{
			AssigneeType: AssigneeTypeCreator,
			AssigneeID:   "",
		}

		noChangeNeeded := applyAssigneeUpdate(item, "user-2")

		assert.False(t, noChangeNeeded, "store write must happen: both ID and type changed")
		assert.Equal(t, AssigneeTypeSpecificUser, item.AssigneeType, "AssigneeType must be cleared to specific-user")
	})

	t.Run("already specific user same ID — no change needed, store write skipped", func(t *testing.T) {
		// Item is already AssigneeTypeSpecificUser with AssigneeID="user-1".
		// SetAssignee is called with the identical user ID — this is the true idempotent case.
		item := &ChecklistItem{
			AssigneeType: AssigneeTypeSpecificUser,
			AssigneeID:   "user-1",
		}

		noChangeNeeded := applyAssigneeUpdate(item, "user-1")

		require.True(t, noChangeNeeded, "no store write needed: already correct")
		assert.Equal(t, AssigneeTypeSpecificUser, item.AssigneeType)
		assert.Equal(t, "user-1", item.AssigneeID)
	})

	t.Run("already specific user different ID — store write required", func(t *testing.T) {
		// Item has AssigneeType="" (specific user) but a different AssigneeID.
		// The type is already correct, but the ID changed so noChangeNeeded must be false.
		item := &ChecklistItem{
			AssigneeType: AssigneeTypeSpecificUser,
			AssigneeID:   "user-1",
		}

		noChangeNeeded := applyAssigneeUpdate(item, "user-2")

		assert.False(t, noChangeNeeded, "store write must happen: AssigneeID changed")
		assert.Equal(t, AssigneeTypeSpecificUser, item.AssigneeType)
	})

	t.Run("unassign clears role type — store write required", func(t *testing.T) {
		// Item has AssigneeType="owner" and AssigneeID="user-1".
		// SetAssignee is called with an empty assigneeID to unassign.
		// Both the AssigneeType and AssigneeID should be cleared, store write must happen.
		item := &ChecklistItem{
			AssigneeType: AssigneeTypeOwner,
			AssigneeID:   "user-1",
		}

		noChangeNeeded := applyAssigneeUpdate(item, "")

		assert.False(t, noChangeNeeded, "store write must happen to persist unassign and type clear")
		assert.Equal(t, AssigneeTypeSpecificUser, item.AssigneeType, "AssigneeType must be cleared")
	})

	t.Run("property_user field ID cleared — store write required even when user ID matches", func(t *testing.T) {
		// Item previously had AssigneeType=property_user with a field ID.
		// SetAssignee is called with the same concrete user ID that was resolved from the field.
		// noChangeNeeded must be false because AssigneePropertyFieldID is non-empty and must be cleared.
		item := &ChecklistItem{
			AssigneeType:            AssigneeTypeSpecificUser,
			AssigneeID:              "user-1",
			AssigneePropertyFieldID: "field-1",
		}

		noChangeNeeded := applyAssigneeUpdate(item, "user-1")

		assert.False(t, noChangeNeeded, "store write must happen to clear AssigneePropertyFieldID")
		assert.Equal(t, AssigneeTypeSpecificUser, item.AssigneeType)
		assert.Equal(t, "user-1", item.AssigneeID)
		assert.Equal(t, "", item.AssigneePropertyFieldID, "AssigneePropertyFieldID must be cleared")
	})

	t.Run("AssigneeType always cleared regardless of ID match", func(t *testing.T) {
		// Verify the invariant: applyAssigneeUpdate always sets AssigneeType to
		// AssigneeTypeSpecificUser (empty string) on every call, even when the returned
		// noChangeNeeded value differs between invocations.
		cases := []struct {
			name         string
			initialType  string
			initialID    string
			newID        string
			wantNoChange bool
		}{
			{"owner type same id", AssigneeTypeOwner, "u1", "u1", false},
			{"owner type diff id", AssigneeTypeOwner, "u1", "u2", false},
			{"creator type same id", AssigneeTypeCreator, "u1", "u1", false},
			{"creator type diff id", AssigneeTypeCreator, "", "u1", false},
			{"specific type same id", AssigneeTypeSpecificUser, "u1", "u1", true},
			{"specific type diff id", AssigneeTypeSpecificUser, "u1", "u2", false},
			{"specific type unassign", AssigneeTypeSpecificUser, "", "", true},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				item := &ChecklistItem{
					AssigneeType: tc.initialType,
					AssigneeID:   tc.initialID,
				}

				noChangeNeeded := applyAssigneeUpdate(item, tc.newID)

				assert.Equal(t, AssigneeTypeSpecificUser, item.AssigneeType,
					"AssigneeType must always be cleared to specific-user")
				assert.Equal(t, tc.wantNoChange, noChangeNeeded)
			})
		}
	})
}
