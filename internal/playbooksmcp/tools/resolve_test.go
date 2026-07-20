// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testChannelID = "chan0000000000000000000000"
	testRunID1    = "run10000000000000000000000"
	testRunID2    = "run20000000000000000000000"
)

func TestToolResolveChannelContextListsItemsWithIndexes(t *testing.T) {
	client := &fakeAPIClient{
		listRuns: listRunsResponse{
			TotalCount: 1,
			Items:      []playbookRunSummary{{ID: testRunID1}},
		},
		runsByID: map[string]playbookRunDetail{
			testRunID1: {
				ID:            testRunID1,
				Name:          "Incident 42",
				CurrentStatus: "InProgress",
				Checklists: []checklist{
					{Title: "Triage", Items: []checklistItem{
						{Title: "Acknowledge", State: "closed"},
						{Title: "Deploy fix", State: ""},
					}},
				},
			},
		},
	}

	out, err := toolResolveChannelContext(context.Background(), client, ResolveChannelContextArgs{ChannelID: testChannelID})
	require.NoError(t, err)

	assert.Equal(t, testChannelID, client.listParams.Get("channel_id"))
	assert.Equal(t, "InProgress", client.listParams.Get("statuses"))
	for _, want := range []string{"Incident 42", testRunID1, "[0][0] Acknowledge (closed)", "[0][1] Deploy fix (open)"} {
		assert.Contains(t, out, want)
	}
}

func TestToolResolveChannelContextIncludeFinished(t *testing.T) {
	client := &fakeAPIClient{}
	_, err := toolResolveChannelContext(context.Background(), client, ResolveChannelContextArgs{
		ChannelID:       testChannelID,
		IncludeFinished: true,
	})
	require.NoError(t, err)
	assert.Empty(t, client.listParams.Get("statuses"))
}

func TestToolResolveChannelContextNoRuns(t *testing.T) {
	client := &fakeAPIClient{}
	out, err := toolResolveChannelContext(context.Background(), client, ResolveChannelContextArgs{ChannelID: testChannelID})
	require.NoError(t, err)
	assert.Contains(t, out, "No in-progress runs found")
}

func TestToolResolveChannelContextRejectsBadChannel(t *testing.T) {
	client := &fakeAPIClient{}
	_, err := toolResolveChannelContext(context.Background(), client, ResolveChannelContextArgs{ChannelID: "bad"})
	require.Error(t, err)
	assert.Empty(t, client.getEndpoints, "expected no API calls on validation failure")
}

func TestToolFindChecklistItemSingleMatch(t *testing.T) {
	client := &fakeAPIClient{
		listRuns: listRunsResponse{Items: []playbookRunSummary{{ID: testRunID1}}},
		runsByID: map[string]playbookRunDetail{
			testRunID1: {
				ID:   testRunID1,
				Name: "Release",
				Checklists: []checklist{
					{Items: []checklistItem{
						{Title: "Write release notes", State: ""},
						{Title: "Deploy to staging", State: ""},
					}},
				},
			},
		},
	}

	out, err := toolFindChecklistItem(context.Background(), client, FindChecklistItemArgs{
		Query:     "deploy to staging",
		ChannelID: testChannelID,
	})
	require.NoError(t, err)
	assert.Contains(t, out, "Found 1 matching item")
	assert.Contains(t, out, "checklist_number: 0, item_number: 1")
}

func TestToolFindChecklistItemMultipleMatches(t *testing.T) {
	client := &fakeAPIClient{
		listRuns: listRunsResponse{Items: []playbookRunSummary{{ID: testRunID1}, {ID: testRunID2}}},
		runsByID: map[string]playbookRunDetail{
			testRunID1: {ID: testRunID1, Name: "Run A", Checklists: []checklist{
				{Items: []checklistItem{{Title: "Deploy service", State: ""}}},
			}},
			testRunID2: {ID: testRunID2, Name: "Run B", Checklists: []checklist{
				{Items: []checklistItem{{Title: "Deploy database", State: ""}}},
			}},
		},
	}

	out, err := toolFindChecklistItem(context.Background(), client, FindChecklistItemArgs{
		Query:     "deploy",
		ChannelID: testChannelID,
	})
	require.NoError(t, err)
	assert.Contains(t, out, "Found 2 matching items")
}

func TestToolFindChecklistItemSkipsClosedByDefault(t *testing.T) {
	client := &fakeAPIClient{
		listRuns: listRunsResponse{Items: []playbookRunSummary{{ID: testRunID1}}},
		runsByID: map[string]playbookRunDetail{
			testRunID1: {ID: testRunID1, Name: "Run", Checklists: []checklist{
				{Items: []checklistItem{{Title: "Deploy", State: "closed"}}},
			}},
		},
	}

	out, err := toolFindChecklistItem(context.Background(), client, FindChecklistItemArgs{
		Query:     "deploy",
		ChannelID: testChannelID,
	})
	require.NoError(t, err)
	assert.Contains(t, out, "No open checklist item matching")

	out, err = toolFindChecklistItem(context.Background(), client, FindChecklistItemArgs{
		Query:         "deploy",
		ChannelID:     testChannelID,
		IncludeClosed: true,
	})
	require.NoError(t, err)
	assert.Contains(t, out, "Found 1 matching item")
}

func TestToolFindChecklistItemByRunID(t *testing.T) {
	client := &fakeAPIClient{
		run: playbookRunDetail{
			ID:   testRunID1,
			Name: "Run",
			Checklists: []checklist{
				{Items: []checklistItem{{Title: "Rotate credentials", State: ""}}},
			},
		},
	}

	out, err := toolFindChecklistItem(context.Background(), client, FindChecklistItemArgs{
		Query: "rotate",
		RunID: testRunID1,
	})
	require.NoError(t, err)
	assert.Contains(t, out, "Found 1 matching item")
	// Should fetch only the single run, never list.
	assert.NotContains(t, client.getEndpoints, "runs", "expected no list_runs call when run_id given")
}

func TestToolResolveChannelContextPaginatesAllRuns(t *testing.T) {
	// Two pages of run summaries; resolve must fetch both, not just the first.
	client := &fakeAPIClient{
		listPages: []listRunsResponse{
			{TotalCount: 2, Items: []playbookRunSummary{{ID: testRunID1}}},
			{TotalCount: 2, Items: []playbookRunSummary{{ID: testRunID2}}},
		},
		runsByID: map[string]playbookRunDetail{
			testRunID1: {ID: testRunID1, Name: "Run one", CurrentStatus: "InProgress"},
			testRunID2: {ID: testRunID2, Name: "Run two", CurrentStatus: "InProgress"},
		},
	}

	out, err := toolResolveChannelContext(context.Background(), client, ResolveChannelContextArgs{ChannelID: testChannelID})
	require.NoError(t, err)
	assert.Contains(t, out, "Run one")
	assert.Contains(t, out, "Run two")
	assert.Contains(t, out, "has 2 run(s)")

	// page 0 and page 1 both requested.
	var pages []string
	for _, call := range client.listCalls {
		pages = append(pages, call.Get("page"))
	}
	assert.Equal(t, []string{"0", "1"}, pages)
}

func TestToolFindChecklistItemFallsBackToCurrentUserRuns(t *testing.T) {
	const currentUser = "usr00000000000000000000000"
	client := &fakeAPIClient{
		currentUserID: currentUser,
		listRuns:      listRunsResponse{Items: []playbookRunSummary{{ID: testRunID1}}},
		runsByID: map[string]playbookRunDetail{
			testRunID1: {ID: testRunID1, Name: "My run", Checklists: []checklist{
				{Items: []checklistItem{{Title: "Rotate credentials", State: ""}}},
			}},
		},
	}

	// No run_id and no channel_id -> fall back to the current user's runs.
	out, err := toolFindChecklistItem(context.Background(), client, FindChecklistItemArgs{
		Query: "rotate",
	})
	require.NoError(t, err)
	assert.Contains(t, out, "Found 1 matching item")

	// The fallback must cover both owned and participant runs (the backend ANDs
	// the two filters, so they are queried separately).
	var owner, participant bool
	for _, call := range client.listCalls {
		if call.Get("owner_user_id") == currentUser {
			owner = true
		}
		if call.Get("participant_id") == currentUser {
			participant = true
		}
	}
	assert.True(t, owner, "expected an owner_user_id=me query")
	assert.True(t, participant, "expected a participant_id=me query")
}

func TestToolFindChecklistItemFallbackSurfacesUserIDError(t *testing.T) {
	client := &fakeAPIClient{currentUserErr: errors.New("no user")}

	_, err := toolFindChecklistItem(context.Background(), client, FindChecklistItemArgs{Query: "rotate"})
	require.Error(t, err)
	assert.Empty(t, client.listCalls, "expected no run listing when the user ID is unavailable")
}

func TestToolFindChecklistItemRequiresQuery(t *testing.T) {
	client := &fakeAPIClient{}
	_, err := toolFindChecklistItem(context.Background(), client, FindChecklistItemArgs{Query: "  "})
	require.Error(t, err)
}

func TestToolCheckItemOutOfRangeListsItems(t *testing.T) {
	client := &fakeAPIClient{
		run: playbookRunDetail{
			ID: testRunID1,
			Checklists: []checklist{
				{Title: "Only", Items: []checklistItem{{Title: "First", State: ""}}},
			},
		},
	}

	_, err := toolCheckItem(context.Background(), client, CheckItemArgs{
		RunID:           testRunID1,
		ChecklistNumber: 0,
		ItemNumber:      5,
		NewState:        "closed",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "item_number 5 is out of range")
	assert.Contains(t, err.Error(), "[0][0] First")
	assert.Empty(t, client.putEndpoint, "expected no state update on out-of-range")
}

func TestToolRemoveSectionOutOfRangeDoesNotDelete(t *testing.T) {
	client := &fakeAPIClient{run: fixtureRun(testRunID1, 2, 1)}

	_, err := toolRemoveSection(context.Background(), client, RemoveSectionArgs{
		RunID:           testRunID1,
		ChecklistNumber: 5,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "checklist_number 5 is out of range")
	assert.Empty(t, client.deleteEndpoint, "expected no delete on out-of-range")
}

func TestToolMoveChecklistItemAllowsAppendPosition(t *testing.T) {
	// A destination item index equal to the item count is a valid append.
	client := &fakeAPIClient{run: fixtureRun(testRunID1, 2, 3)}

	_, err := toolMoveChecklistItem(context.Background(), client, MoveChecklistItemArgs{
		RunID:              testRunID1,
		SourceChecklistIdx: 0,
		SourceItemIdx:      0,
		DestChecklistIdx:   1,
		DestItemIdx:        3, // == item count of dest checklist
	})
	require.NoError(t, err, "expected append position to be accepted")
	assert.Equal(t, "runs/"+testRunID1+"/checklists/move-item", client.postEndpoint)
}

func TestToolMoveChecklistItemRejectsPositionBeyondAppend(t *testing.T) {
	client := &fakeAPIClient{run: fixtureRun(testRunID1, 2, 3)}

	_, err := toolMoveChecklistItem(context.Background(), client, MoveChecklistItemArgs{
		RunID:              testRunID1,
		SourceChecklistIdx: 0,
		SourceItemIdx:      0,
		DestChecklistIdx:   1,
		DestItemIdx:        4, // > item count, invalid even cross-checklist
	})
	require.Error(t, err)
	assert.Empty(t, client.postEndpoint, "expected no move on invalid position")
}

func TestToolMoveChecklistItemSameChecklistRejectsItemCount(t *testing.T) {
	// Within the same section the backend caps the destination at count-1, so
	// dest_item_idx == item count must be rejected (not treated as append).
	client := &fakeAPIClient{run: fixtureRun(testRunID1, 1, 3)}

	_, err := toolMoveChecklistItem(context.Background(), client, MoveChecklistItemArgs{
		RunID:              testRunID1,
		SourceChecklistIdx: 0,
		SourceItemIdx:      0,
		DestChecklistIdx:   0,
		DestItemIdx:        3, // == item count, invalid for same-checklist move
	})
	require.Error(t, err, "expected out-of-range error for same-checklist dest_item_idx == count")
	assert.Empty(t, client.postEndpoint, "expected no move on invalid position")
}

func TestToolMoveChecklistItemSameChecklistAllowsLastIndex(t *testing.T) {
	client := &fakeAPIClient{run: fixtureRun(testRunID1, 1, 3)}

	_, err := toolMoveChecklistItem(context.Background(), client, MoveChecklistItemArgs{
		RunID:              testRunID1,
		SourceChecklistIdx: 0,
		SourceItemIdx:      0,
		DestChecklistIdx:   0,
		DestItemIdx:        2, // == count-1, the last valid slot for same-checklist
	})
	require.NoError(t, err, "expected count-1 to be accepted for same-checklist move")
	assert.Equal(t, "runs/"+testRunID1+"/checklists/move-item", client.postEndpoint)
}

func TestToolMoveSectionRejectsSectionCount(t *testing.T) {
	// MoveChecklist rejects a destination >= section count; count itself is invalid.
	client := &fakeAPIClient{run: fixtureRun(testRunID1, 2, 1)}

	_, err := toolMoveSection(context.Background(), client, MoveSectionArgs{
		RunID:              testRunID1,
		SourceChecklistIdx: 0,
		DestChecklistIdx:   2, // == section count, invalid
	})
	require.Error(t, err, "expected out-of-range error for dest_checklist_idx == section count")
	assert.Empty(t, client.postEndpoint, "expected no move on invalid position")
}

func TestToolCheckItemAlreadyInStateIsNoOp(t *testing.T) {
	client := &fakeAPIClient{
		run: playbookRunDetail{
			ID: testRunID1,
			Checklists: []checklist{
				{Items: []checklistItem{{Title: "Done", State: "closed"}}},
			},
		},
	}

	out, err := toolCheckItem(context.Background(), client, CheckItemArgs{
		RunID:           testRunID1,
		ChecklistNumber: 0,
		ItemNumber:      0,
		NewState:        "closed",
	})
	require.NoError(t, err)
	assert.Contains(t, out, "already 'closed'")
	assert.Empty(t, client.putEndpoint, "expected no PUT on no-op")
}
