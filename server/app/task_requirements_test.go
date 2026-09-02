// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetChecklistItemUpdates_Requirements(t *testing.T) {
	previous := []ChecklistItem{
		{
			ID:    "item-1",
			Title: "Task",
			Requirements: []TaskRequirement{
				{ID: "req-1", Label: "Ticket URL", Value: ""},
			},
		},
	}
	current := []ChecklistItem{
		{
			ID:    "item-1",
			Title: "Task",
			Requirements: []TaskRequirement{
				{ID: "req-1", Label: "Ticket URL", Value: "https://example.com"},
			},
		},
	}

	updates := GetChecklistItemUpdates(previous, current)
	require.Len(t, updates.Updates, 1)
	assert.Equal(t, "item-1", updates.Updates[0].ID)

	reqs, ok := updates.Updates[0].Fields["requirements"]
	require.True(t, ok, "requirements field should be included when values change")
	assert.Equal(t, current[0].Requirements, reqs)
}

func TestGetChecklistItemUpdates_RequirementsUnchanged(t *testing.T) {
	item := ChecklistItem{
		ID:    "item-1",
		Title: "Task",
		Requirements: []TaskRequirement{
			{ID: "req-1", Label: "Ticket URL", Value: "abc"},
		},
	}

	updates := GetChecklistItemUpdates([]ChecklistItem{item}, []ChecklistItem{item})
	assert.Empty(t, updates.Updates)
}
