// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"strings"
	"testing"
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
	if err != nil {
		t.Fatalf("toolResolveChannelContext returned error: %v", err)
	}

	if client.listParams.Get("channel_id") != testChannelID {
		t.Fatalf("expected channel_id filter %q, got %q", testChannelID, client.listParams.Get("channel_id"))
	}
	if client.listParams.Get("statuses") != "InProgress" {
		t.Fatalf("expected InProgress status filter, got %q", client.listParams.Get("statuses"))
	}
	for _, want := range []string{"Incident 42", testRunID1, "[0][0] Acknowledge (closed)", "[0][1] Deploy fix (open)"} {
		if !strings.Contains(out, want) {
			t.Fatalf("expected output to contain %q, got:\n%s", want, out)
		}
	}
}

func TestToolResolveChannelContextIncludeFinished(t *testing.T) {
	client := &fakeAPIClient{}
	if _, err := toolResolveChannelContext(context.Background(), client, ResolveChannelContextArgs{
		ChannelID:       testChannelID,
		IncludeFinished: true,
	}); err != nil {
		t.Fatalf("toolResolveChannelContext returned error: %v", err)
	}
	if client.listParams.Get("statuses") != "" {
		t.Fatalf("expected no status filter when include_finished, got %q", client.listParams.Get("statuses"))
	}
}

func TestToolResolveChannelContextNoRuns(t *testing.T) {
	client := &fakeAPIClient{}
	out, err := toolResolveChannelContext(context.Background(), client, ResolveChannelContextArgs{ChannelID: testChannelID})
	if err != nil {
		t.Fatalf("toolResolveChannelContext returned error: %v", err)
	}
	if !strings.Contains(out, "No in-progress runs found") {
		t.Fatalf("unexpected output: %s", out)
	}
}

func TestToolResolveChannelContextRejectsBadChannel(t *testing.T) {
	client := &fakeAPIClient{}
	if _, err := toolResolveChannelContext(context.Background(), client, ResolveChannelContextArgs{ChannelID: "bad"}); err == nil {
		t.Fatal("expected channel_id validation error")
	}
	if len(client.getEndpoints) != 0 {
		t.Fatalf("expected no API calls on validation failure, got %v", client.getEndpoints)
	}
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
	if err != nil {
		t.Fatalf("toolFindChecklistItem returned error: %v", err)
	}
	if !strings.Contains(out, "Found 1 matching item") {
		t.Fatalf("expected single match, got:\n%s", out)
	}
	if !strings.Contains(out, "checklist_number: 0, item_number: 1") {
		t.Fatalf("expected indexes for matched item, got:\n%s", out)
	}
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
	if err != nil {
		t.Fatalf("toolFindChecklistItem returned error: %v", err)
	}
	if !strings.Contains(out, "Found 2 matching items") {
		t.Fatalf("expected multiple matches, got:\n%s", out)
	}
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
	if err != nil {
		t.Fatalf("toolFindChecklistItem returned error: %v", err)
	}
	if !strings.Contains(out, "No open checklist item matching") {
		t.Fatalf("expected no open match, got:\n%s", out)
	}

	out, err = toolFindChecklistItem(context.Background(), client, FindChecklistItemArgs{
		Query:         "deploy",
		ChannelID:     testChannelID,
		IncludeClosed: true,
	})
	if err != nil {
		t.Fatalf("toolFindChecklistItem returned error: %v", err)
	}
	if !strings.Contains(out, "Found 1 matching item") {
		t.Fatalf("expected match when include_closed, got:\n%s", out)
	}
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
	if err != nil {
		t.Fatalf("toolFindChecklistItem returned error: %v", err)
	}
	if !strings.Contains(out, "Found 1 matching item") {
		t.Fatalf("expected single match, got:\n%s", out)
	}
	// Should fetch only the single run, never list.
	for _, ep := range client.getEndpoints {
		if ep == "runs" {
			t.Fatalf("expected no list_runs call when run_id given, got endpoints %v", client.getEndpoints)
		}
	}
}

func TestToolFindChecklistItemRequiresQuery(t *testing.T) {
	client := &fakeAPIClient{}
	if _, err := toolFindChecklistItem(context.Background(), client, FindChecklistItemArgs{Query: "  "}); err == nil {
		t.Fatal("expected query validation error")
	}
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
	if err == nil {
		t.Fatal("expected out-of-range error")
	}
	if !strings.Contains(err.Error(), "item_number 5 is out of range") || !strings.Contains(err.Error(), "[0][0] First") {
		t.Fatalf("expected actionable out-of-range error, got: %v", err)
	}
	if client.putEndpoint != "" {
		t.Fatalf("expected no state update on out-of-range, got %q", client.putEndpoint)
	}
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
	if err != nil {
		t.Fatalf("toolCheckItem returned error: %v", err)
	}
	if !strings.Contains(out, "already 'closed'") {
		t.Fatalf("expected no-op message, got: %s", out)
	}
	if client.putEndpoint != "" {
		t.Fatalf("expected no PUT on no-op, got %q", client.putEndpoint)
	}
}
