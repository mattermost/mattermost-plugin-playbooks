// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestResolveAssigneeRoles tests the resolveRoleAssignments package-level helper
// added in Phase 2. At run creation time, checklist items with AssigneeType
// "owner" or "creator" have their AssigneeID set to the actual user IDs from
// the run. AssigneeType is preserved on the item after resolution so that
// subsequent ChangeOwner calls can re-resolve "owner" items.
func TestResolveAssigneeRoles(t *testing.T) {
	ownerID := "user-owner-123"
	creatorID := "user-creator-456"
	specificUserID := "user-specific-789"

	t.Run("AssigneeType user keeps existing AssigneeID unchanged", func(t *testing.T) {
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{
						ID:           "item-1",
						Title:        "Specific user task",
						AssigneeType: AssigneeTypeSpecificUser,
						AssigneeID:   specificUserID,
					},
				},
			},
		}

		resolveRoleAssignments(checklists, ownerID, creatorID)

		require.Equal(t, specificUserID, checklists[0].Items[0].AssigneeID)
		assert.Equal(t, AssigneeTypeSpecificUser, checklists[0].Items[0].AssigneeType)
	})

	t.Run("AssigneeType owner resolves to run OwnerUserID", func(t *testing.T) {
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{
						ID:           "item-1",
						Title:        "Owner task",
						AssigneeType: AssigneeTypeOwner,
						AssigneeID:   "", // empty before resolution
					},
				},
			},
		}

		resolveRoleAssignments(checklists, ownerID, creatorID)

		require.Equal(t, ownerID, checklists[0].Items[0].AssigneeID)
	})

	t.Run("AssigneeType creator resolves to run CreatorUserID", func(t *testing.T) {
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{
						ID:           "item-1",
						Title:        "Creator task",
						AssigneeType: AssigneeTypeCreator,
						AssigneeID:   "", // empty before resolution
					},
				},
			},
		}

		resolveRoleAssignments(checklists, ownerID, creatorID)

		require.Equal(t, creatorID, checklists[0].Items[0].AssigneeID)
	})

	t.Run("AssigneeType owner with no owner leaves AssigneeID empty", func(t *testing.T) {
		// Edge case: OwnerUserID is empty (should not happen in practice per plan,
		// but the helper must handle it gracefully without panicking).
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{
						ID:           "item-1",
						Title:        "Owner task, no owner",
						AssigneeType: AssigneeTypeOwner,
						AssigneeID:   "",
					},
				},
			},
		}

		resolveRoleAssignments(checklists, "" /*ownerID*/, creatorID)

		assert.Equal(t, "", checklists[0].Items[0].AssigneeID)
	})

	t.Run("multiple tasks with different AssigneeTypes all resolved", func(t *testing.T) {
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{ID: "item-1", Title: "Owner task", AssigneeType: AssigneeTypeOwner},
					{ID: "item-2", Title: "Creator task", AssigneeType: AssigneeTypeCreator},
					{ID: "item-3", Title: "Specific user task", AssigneeType: AssigneeTypeSpecificUser, AssigneeID: specificUserID},
					{ID: "item-4", Title: "Unassigned task", AssigneeType: AssigneeTypeSpecificUser, AssigneeID: ""},
				},
			},
		}

		resolveRoleAssignments(checklists, ownerID, creatorID)

		require.Equal(t, ownerID, checklists[0].Items[0].AssigneeID, "owner item")
		require.Equal(t, creatorID, checklists[0].Items[1].AssigneeID, "creator item")
		require.Equal(t, specificUserID, checklists[0].Items[2].AssigneeID, "specific user item unchanged")
		require.Equal(t, "", checklists[0].Items[3].AssigneeID, "unassigned item unchanged")
	})

	t.Run("AssigneeType persists after resolution", func(t *testing.T) {
		// After resolveRoleAssignments, AssigneeType must be kept on both
		// owner and creator items — owner for ChangeOwner re-resolution,
		// creator for the role badge display and task lockdown checks.
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{ID: "item-1", Title: "Owner task", AssigneeType: AssigneeTypeOwner},
					{ID: "item-2", Title: "Creator task", AssigneeType: AssigneeTypeCreator},
				},
			},
		}

		resolveRoleAssignments(checklists, ownerID, creatorID)

		assert.Equal(t, AssigneeTypeOwner, checklists[0].Items[0].AssigneeType,
			"AssigneeType should remain 'owner' after resolution")
		assert.Equal(t, AssigneeTypeCreator, checklists[0].Items[1].AssigneeType,
			"AssigneeType should remain 'creator' after resolution")
	})

	t.Run("items across multiple checklists are all resolved", func(t *testing.T) {
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{ID: "item-1", Title: "Checklist-1 owner task", AssigneeType: AssigneeTypeOwner},
				},
			},
			{
				Items: []ChecklistItem{
					{ID: "item-2", Title: "Checklist-2 creator task", AssigneeType: AssigneeTypeCreator},
				},
			},
		}

		resolveRoleAssignments(checklists, ownerID, creatorID)

		require.Equal(t, ownerID, checklists[0].Items[0].AssigneeID)
		require.Equal(t, creatorID, checklists[1].Items[0].AssigneeID)
	})
}

// TestResolveOwnerRoleAssignments tests the resolveOwnerRoleAssignments helper
// called by ChangeOwner. It must re-resolve only "owner" items — not "creator"
// items (creator never changes after run creation).
func TestResolveOwnerRoleAssignments(t *testing.T) {
	originalOwnerID := "user-original-owner"
	newOwnerID := "user-new-owner"
	creatorID := "user-creator"

	t.Run("owner items are re-resolved to the new owner", func(t *testing.T) {
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{ID: "item-1", AssigneeType: AssigneeTypeOwner, AssigneeID: originalOwnerID},
				},
			},
		}

		resolveOwnerRoleAssignments(checklists, newOwnerID)

		require.Equal(t, newOwnerID, checklists[0].Items[0].AssigneeID)
	})

	t.Run("creator items are NOT re-resolved on owner change", func(t *testing.T) {
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{ID: "item-1", AssigneeType: AssigneeTypeCreator, AssigneeID: creatorID},
				},
			},
		}

		resolveOwnerRoleAssignments(checklists, newOwnerID)

		// Creator should be unchanged
		assert.Equal(t, creatorID, checklists[0].Items[0].AssigneeID,
			"creator AssigneeID must not change on owner re-resolution")
	})

	t.Run("specific-user items are NOT re-resolved on owner change", func(t *testing.T) {
		specificUserID := "user-specific"
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{ID: "item-1", AssigneeType: AssigneeTypeSpecificUser, AssigneeID: specificUserID},
				},
			},
		}

		resolveOwnerRoleAssignments(checklists, newOwnerID)

		assert.Equal(t, specificUserID, checklists[0].Items[0].AssigneeID)
	})

	t.Run("mixed items: only owner items updated", func(t *testing.T) {
		specificUserID := "user-specific"
		checklists := []Checklist{
			{
				Items: []ChecklistItem{
					{ID: "item-1", AssigneeType: AssigneeTypeOwner, AssigneeID: originalOwnerID},
					{ID: "item-2", AssigneeType: AssigneeTypeCreator, AssigneeID: creatorID},
					{ID: "item-3", AssigneeType: AssigneeTypeSpecificUser, AssigneeID: specificUserID},
				},
			},
		}

		resolveOwnerRoleAssignments(checklists, newOwnerID)

		assert.Equal(t, newOwnerID, checklists[0].Items[0].AssigneeID, "owner item updated")
		assert.Equal(t, creatorID, checklists[0].Items[1].AssigneeID, "creator item unchanged")
		assert.Equal(t, specificUserID, checklists[0].Items[2].AssigneeID, "specific user item unchanged")
	})
}
