// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCheckAssigneeOnlyComplete(t *testing.T) {
	t.Run("allows when not locked", func(t *testing.T) {
		err := checkAssigneeOnlyComplete(ChecklistItem{AssigneeID: "user-1"}, "user-2")
		require.NoError(t, err)
	})

	t.Run("allows when locked but unassigned", func(t *testing.T) {
		err := checkAssigneeOnlyComplete(ChecklistItem{AssigneeOnlyComplete: true}, "user-2")
		require.NoError(t, err)
	})

	t.Run("allows assignee when locked", func(t *testing.T) {
		err := checkAssigneeOnlyComplete(ChecklistItem{AssigneeOnlyComplete: true, AssigneeID: "user-1"}, "user-1")
		require.NoError(t, err)
	})

	t.Run("blocks non-assignee when locked", func(t *testing.T) {
		err := checkAssigneeOnlyComplete(ChecklistItem{AssigneeOnlyComplete: true, AssigneeID: "user-1"}, "user-2")
		require.ErrorIs(t, err, ErrAssigneeOnlyComplete)
		require.ErrorIs(t, err, ErrNoPermissions)
	})
}

func TestCheckAssigneeOnlyChangeAssignee(t *testing.T) {
	t.Run("allows when not locked", func(t *testing.T) {
		err := checkAssigneeOnlyChangeAssignee(ChecklistItem{AssigneeID: "user-1"}, "user-2", "owner")
		require.NoError(t, err)
	})

	t.Run("allows run owner when locked and unassigned", func(t *testing.T) {
		err := checkAssigneeOnlyChangeAssignee(ChecklistItem{AssigneeOnlyComplete: true}, "owner", "owner")
		require.NoError(t, err)
	})

	t.Run("allows non-owner when locked and unassigned", func(t *testing.T) {
		err := checkAssigneeOnlyChangeAssignee(ChecklistItem{AssigneeOnlyComplete: true}, "user-2", "owner")
		require.NoError(t, err)
	})

	t.Run("allows assignee when locked", func(t *testing.T) {
		err := checkAssigneeOnlyChangeAssignee(ChecklistItem{AssigneeOnlyComplete: true, AssigneeID: "user-1"}, "user-1", "owner")
		require.NoError(t, err)
	})

	t.Run("allows run owner when locked and assigned", func(t *testing.T) {
		err := checkAssigneeOnlyChangeAssignee(ChecklistItem{AssigneeOnlyComplete: true, AssigneeID: "user-1"}, "owner", "owner")
		require.NoError(t, err)
	})

	t.Run("blocks other users when locked and assigned", func(t *testing.T) {
		err := checkAssigneeOnlyChangeAssignee(ChecklistItem{AssigneeOnlyComplete: true, AssigneeID: "user-1"}, "user-2", "owner")
		require.ErrorIs(t, err, ErrAssigneeOnlyChangeAssignee)
	})
}
