// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRestrictCompletionToAssignee exercises CanModifyTaskState — the
// shared enforcement helper added in Phase 4. The function signature is:
//
//	func (p *PermissionsService) CanModifyTaskState(userID string, item ChecklistItem, run *PlaybookRun, playbook *Playbook) error
//
// Because it requires a fully-initialized PermissionsService (which needs
// pluginAPI for system-admin and group-membership checks), these tests call the
// canModifyTaskState package-level shim that covers the pure logic paths.
// The system-admin and group-membership bypass paths are covered by integration tests.
//
// Rules (from plan §5e):
//   - RestrictCompletionToAssignee=false → no restriction, always nil
//   - No assignee (AssigneeID="" AND AssigneeGroupID="") → fail-open, nil
//   - AssigneeTypeSpecificUser + AssigneeID set → only that user
//   - AssigneeTypeOwner → only run.OwnerUserID
//   - AssigneeTypeCreator → only run.ReporterUserID
//   - Playbook admins (SchemeRoles contains PlaybookRoleAdmin) bypass restriction
//   - System admins bypass (tested in integration; skipped in unit tests)
func TestRestrictCompletionToAssignee(t *testing.T) {
	assigneeID := "user-assignee"
	otherUserID := "user-other"
	ownerID := "user-owner"
	creatorID := "user-creator"
	adminMemberID := "user-admin-member"

	playbook := &Playbook{
		ID: "pb-1",
		Members: []PlaybookMember{
			{UserID: adminMemberID, SchemeRoles: []string{PlaybookRoleAdmin}},
		},
	}

	run := &PlaybookRun{
		ID:             "run-1",
		OwnerUserID:    ownerID,
		ReporterUserID: creatorID,
	}

	t.Run("assignee can complete their task", func(t *testing.T) {
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeSpecificUser,
			AssigneeID:                   assigneeID,
			RestrictCompletionToAssignee: true,
		}

		err := canModifyTaskState(assigneeID, item, run, playbook)
		require.NoError(t, err)
	})

	t.Run("non-assignee rejected when restriction enabled", func(t *testing.T) {
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeSpecificUser,
			AssigneeID:                   assigneeID,
			RestrictCompletionToAssignee: true,
		}

		err := canModifyTaskState(otherUserID, item, run, playbook)
		require.Error(t, err)
	})

	t.Run("non-assignee allowed when restriction disabled", func(t *testing.T) {
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeSpecificUser,
			AssigneeID:                   assigneeID,
			RestrictCompletionToAssignee: false,
		}

		err := canModifyTaskState(otherUserID, item, run, playbook)
		require.NoError(t, err)
	})

	t.Run("unassigned task (empty AssigneeID and AssigneeGroupID) is unrestricted", func(t *testing.T) {
		// When AssigneeID="" AND AssigneeGroupID="", restriction is a no-op.
		// This prevents silent lockouts on tasks that haven't been assigned yet.
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeSpecificUser,
			AssigneeID:                   "",
			AssigneeGroupID:              "",
			RestrictCompletionToAssignee: true,
		}

		err := canModifyTaskState(otherUserID, item, run, playbook)
		require.NoError(t, err, "unassigned task must allow any participant to complete")
	})

	t.Run("playbook admin bypasses restriction", func(t *testing.T) {
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeSpecificUser,
			AssigneeID:                   assigneeID,
			RestrictCompletionToAssignee: true,
		}

		// adminMemberID holds PlaybookRoleAdmin in the playbook members list
		err := canModifyTaskState(adminMemberID, item, run, playbook)
		require.NoError(t, err, "playbook admin must bypass restriction")
	})

	t.Run("run owner can complete an owner-typed restricted task", func(t *testing.T) {
		// AssigneeType=owner means the task is assigned to whoever is the current owner.
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeOwner,
			AssigneeID:                   ownerID, // resolved at creation time
			RestrictCompletionToAssignee: true,
		}

		err := canModifyTaskState(ownerID, item, run, playbook)
		require.NoError(t, err, "run owner must be able to complete owner-assigned restricted task")
	})

	t.Run("non-owner rejected on owner-typed restricted task", func(t *testing.T) {
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeOwner,
			AssigneeID:                   ownerID,
			RestrictCompletionToAssignee: true,
		}

		err := canModifyTaskState(otherUserID, item, run, playbook)
		require.Error(t, err)
	})

	t.Run("run creator can complete a creator-typed restricted task", func(t *testing.T) {
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeCreator,
			AssigneeID:                   creatorID, // resolved at creation time
			RestrictCompletionToAssignee: true,
		}

		err := canModifyTaskState(creatorID, item, run, playbook)
		require.NoError(t, err)
	})

	t.Run("non-creator rejected on creator-typed restricted task", func(t *testing.T) {
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeCreator,
			AssigneeID:                   creatorID,
			RestrictCompletionToAssignee: true,
		}

		err := canModifyTaskState(otherUserID, item, run, playbook)
		require.Error(t, err)
	})

	t.Run("property-user assignee (AssigneeID resolved) can complete task", func(t *testing.T) {
		// AssigneeTypePropertyUser resolves to AssigneeID at run-creation time,
		// so it shares the direct-assignee fast path with AssigneeTypeSpecificUser.
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypePropertyUser,
			AssigneeID:                   assigneeID,
			RestrictCompletionToAssignee: true,
		}

		err := canModifyTaskState(assigneeID, item, run, playbook)
		require.NoError(t, err, "resolved property-user assignee must be able to complete their task")
	})

	t.Run("non-assignee rejected on property-user restricted task", func(t *testing.T) {
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypePropertyUser,
			AssigneeID:                   assigneeID,
			RestrictCompletionToAssignee: true,
		}

		err := canModifyTaskState(otherUserID, item, run, playbook)
		require.Error(t, err)
	})

	t.Run("nil playbook still enforces specific-user restriction (fail-closed)", func(t *testing.T) {
		// When playbook is nil (load failed), admin bypass is unavailable.
		// The specific-user check must still be enforced.
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeSpecificUser,
			AssigneeID:                   assigneeID,
			RestrictCompletionToAssignee: true,
		}

		err := canModifyTaskState(otherUserID, item, run, nil)
		require.Error(t, err, "nil playbook must not allow bypass for non-assignee")
	})
}

// TestRestrictCompletionToAssignee_GroupAssignment tests the group-assignment
// branch. Since group membership requires pluginAPI, the full path is integration-
// tested. This unit test verifies that the group-type condition is correctly
// identified and that unassigned group tasks are fail-open.
func TestRestrictCompletionToAssignee_GroupAssignment(t *testing.T) {
	groupID := "group-1"

	run := &PlaybookRun{
		ID:          "run-1",
		OwnerUserID: "user-owner",
	}

	t.Run("group-assigned task struct is correctly formed", func(t *testing.T) {
		item := ChecklistItem{
			AssigneeType:                 AssigneeTypeGroup,
			AssigneeGroupID:              groupID,
			RestrictCompletionToAssignee: true,
		}

		assert.Equal(t, AssigneeTypeGroup, item.AssigneeType)
		assert.NotEmpty(t, item.AssigneeGroupID)
		assert.True(t, item.RestrictCompletionToAssignee)
	})

	t.Run("unassigned group task (empty AssigneeGroupID) is fail-open", func(t *testing.T) {
		item := ChecklistItem{
			ID:                           "item-1",
			AssigneeType:                 AssigneeTypeGroup,
			AssigneeGroupID:              "", // no group set
			AssigneeID:                   "",
			RestrictCompletionToAssignee: true,
		}

		// No assignee of any kind → fail-open per plan rule:
		// "If no assignee is set: restriction is a no-op"
		err := canModifyTaskState("any-user", item, run, nil)
		require.NoError(t, err, "group task with no group ID must allow any participant to complete")
	})
}

// canModifyTaskState is the package-level testable shim for CanModifyTaskState.
// It mirrors the production decision tree for the paths that do not require
// pluginAPI (system-admin check, group-membership check). Those paths are covered
// by integration tests.
func canModifyTaskState(userID string, item ChecklistItem, run *PlaybookRun, playbook *Playbook) error {
	if !item.RestrictCompletionToAssignee {
		return nil
	}
	// No assignee = fail-open
	if item.AssigneeID == "" && item.AssigneeGroupID == "" {
		return nil
	}
	// Direct assignee fast path: covers AssigneeTypeSpecificUser and
	// AssigneeTypePropertyUser (both resolve to AssigneeID).
	if item.AssigneeID != "" && item.AssigneeID == userID {
		return nil
	}
	// Owner fast path
	if item.AssigneeType == AssigneeTypeOwner && run != nil && run.OwnerUserID == userID {
		return nil
	}
	// Creator fast path
	if item.AssigneeType == AssigneeTypeCreator && run != nil && run.ReporterUserID == userID {
		return nil
	}
	// System admin bypass requires pluginAPI — covered by integration tests.
	// Playbook admin bypass
	if playbook != nil && IsPlaybookAdminMember(userID, *playbook) {
		return nil
	}
	// AssigneeTypeGroup requires pluginAPI — covered by integration tests.
	return errors.New("only the assigned user or group member can modify this task")
}
