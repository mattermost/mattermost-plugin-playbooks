// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"fmt"
	"net/url"
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeAPIClient struct {
	run      playbookRunDetail
	listRuns listRunsResponse

	getEndpoint string
	getParams   url.Values

	postEndpoint string
	postBody     any
	postResult   any

	putEndpoint string
	putBody     any

	deleteEndpoint string
}

func (f *fakeAPIClient) Get(_ context.Context, endpoint string, params url.Values, result any) error {
	f.getEndpoint = endpoint
	f.getParams = params
	switch v := result.(type) {
	case *playbookRunDetail:
		*v = f.run
	case *listRunsResponse:
		*v = f.listRuns
	case *map[string]any:
		*v = map[string]any{"id": "abcdefghijklmnopqrstuvwxyz", "title": "Created playbook"}
	default:
		return fmt.Errorf("unexpected get result type %T", result)
	}
	return nil
}

func (f *fakeAPIClient) Post(_ context.Context, endpoint string, body any, result any) error {
	f.postEndpoint = endpoint
	f.postBody = body
	f.postResult = result
	if run, ok := result.(*playbookRunDetail); ok {
		*run = f.run
	}
	if created, ok := result.(*struct {
		ID string `json:"id"`
	}); ok {
		created.ID = "abcdefghijklmnopqrstuvwxyz"
	}
	return nil
}

func (f *fakeAPIClient) Put(_ context.Context, endpoint string, body any, _ any) error {
	f.putEndpoint = endpoint
	f.putBody = body
	return nil
}

func (f *fakeAPIClient) Delete(_ context.Context, endpoint string) error {
	f.deleteEndpoint = endpoint
	return nil
}

func (f *fakeAPIClient) GetCurrentUserID(context.Context) (string, error) {
	return "abcdefghijklmnopqrstuvwxy0", nil
}

func (f *fakeAPIClient) GetPlaybookURL(playbookID string) string {
	return "https://mattermost.example.com/playbooks/playbooks/" + playbookID
}

func TestToolCheckItemOpenTranslatesToEmptyAPIState(t *testing.T) {
	client := &fakeAPIClient{}
	args := CheckItemArgs{
		RunID:           "abcdefghijklmnopqrstuvwxyz",
		ChecklistNumber: 1,
		ItemNumber:      2,
		NewState:        "open",
	}

	if _, err := toolCheckItem(context.Background(), client, args); err != nil {
		t.Fatalf("toolCheckItem returned error: %v", err)
	}

	if client.putEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2/state" {
		t.Fatalf("unexpected endpoint: %s", client.putEndpoint)
	}
	body, ok := client.putBody.(map[string]string)
	if !ok {
		t.Fatalf("unexpected body type %T", client.putBody)
	}
	if got := body["new_state"]; got != "" {
		t.Fatalf("expected open state to be sent as empty string, got %q", got)
	}
}

func TestToolEditChecklistItemPreservesOmittedFields(t *testing.T) {
	client := &fakeAPIClient{
		run: playbookRunDetail{
			Checklists: []checklist{
				{
					Items: []checklistItem{
						{
							Title:       "old title",
							Command:     "/old-command",
							Description: "old description",
						},
					},
				},
			},
		},
	}
	newTitle := " new title "
	args := EditChecklistItemArgs{
		RunID:           "abcdefghijklmnopqrstuvwxyz",
		ChecklistNumber: 0,
		ItemNumber:      0,
		Title:           &newTitle,
	}

	if _, err := toolEditChecklistItem(context.Background(), client, args); err != nil {
		t.Fatalf("toolEditChecklistItem returned error: %v", err)
	}

	if client.getEndpoint != "runs/abcdefghijklmnopqrstuvwxyz" {
		t.Fatalf("unexpected get endpoint: %s", client.getEndpoint)
	}
	if client.putEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists/0/item/0" {
		t.Fatalf("unexpected put endpoint: %s", client.putEndpoint)
	}
	body, ok := client.putBody.(map[string]any)
	if !ok {
		t.Fatalf("unexpected body type %T", client.putBody)
	}
	if got := body["title"]; got != "new title" {
		t.Errorf("expected updated title, got %q", got)
	}
	if got := body["command"]; got != "/old-command" {
		t.Errorf("expected existing command to be preserved, got %q", got)
	}
	if got := body["description"]; got != "old description" {
		t.Errorf("expected existing description to be preserved, got %q", got)
	}
	if _, ok := body["due_date"]; ok {
		t.Errorf("expected omitted due_date to be excluded, got %#v", body["due_date"])
	}
}

func TestToolEditChecklistItemRejectsBlankTitle(t *testing.T) {
	client := &fakeAPIClient{}
	blankTitle := "   "
	args := EditChecklistItemArgs{
		RunID:           "abcdefghijklmnopqrstuvwxyz",
		ChecklistNumber: 0,
		ItemNumber:      0,
		Title:           &blankTitle,
	}

	if _, err := toolEditChecklistItem(context.Background(), client, args); err == nil || err.Error() != "title is required" {
		t.Fatalf("expected title validation error, got %v", err)
	}

	if client.getEndpoint != "" {
		t.Fatalf("expected validation to fail before fetching run, got endpoint %q", client.getEndpoint)
	}
	if client.putEndpoint != "" {
		t.Fatalf("expected no update call, got endpoint %q", client.putEndpoint)
	}
}

func TestToolEditChecklistItemRejectsNoEditedFields(t *testing.T) {
	client := &fakeAPIClient{}
	args := EditChecklistItemArgs{
		RunID:           "abcdefghijklmnopqrstuvwxyz",
		ChecklistNumber: 0,
		ItemNumber:      0,
	}

	_, err := toolEditChecklistItem(context.Background(), client, args)
	require.EqualError(t, err, "at least one field (title, description, command, or due_date) must be provided")
	assert.Empty(t, client.getEndpoint)
	assert.Empty(t, client.putEndpoint)
}

func TestToolEditChecklistItemSetsDueDate(t *testing.T) {
	client := &fakeAPIClient{
		run: playbookRunDetail{
			Checklists: []checklist{
				{
					Items: []checklistItem{
						{
							Title:       "old title",
							Command:     "/old-command",
							Description: "old description",
							DueDate:     1717100000000,
						},
					},
				},
			},
		},
	}
	dueDate := int64(1717200000000)
	args := EditChecklistItemArgs{
		RunID:           "abcdefghijklmnopqrstuvwxyz",
		ChecklistNumber: 0,
		ItemNumber:      0,
		DueDate:         &dueDate,
	}

	_, err := toolEditChecklistItem(context.Background(), client, args)
	require.NoError(t, err)

	require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/0/item/0", client.putEndpoint)
	require.IsType(t, map[string]any{}, client.putBody)
	body := client.putBody.(map[string]any)
	assert.Equal(t, "old title", body["title"])
	assert.Equal(t, "old description", body["description"])
	assert.Equal(t, "/old-command", body["command"])
	assert.Equal(t, int64(1717200000000), body["due_date"])
}

func TestToolEditChecklistItemClearsDueDate(t *testing.T) {
	client := &fakeAPIClient{
		run: playbookRunDetail{
			Checklists: []checklist{
				{
					Items: []checklistItem{
						{
							Title:       "old title",
							Command:     "/old-command",
							Description: "old description",
							DueDate:     1717100000000,
						},
					},
				},
			},
		},
	}
	dueDate := int64(0)
	args := EditChecklistItemArgs{
		RunID:           "abcdefghijklmnopqrstuvwxyz",
		ChecklistNumber: 0,
		ItemNumber:      0,
		DueDate:         &dueDate,
	}

	_, err := toolEditChecklistItem(context.Background(), client, args)
	require.NoError(t, err)

	require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/0/item/0", client.putEndpoint)
	require.IsType(t, map[string]any{}, client.putBody)
	body := client.putBody.(map[string]any)
	assert.Equal(t, int64(0), body["due_date"])
}

func TestToolListRunsAddsTypeFilter(t *testing.T) {
	client := &fakeAPIClient{}
	args := ListRunsArgs{Type: "channelChecklist", Types: []string{"playbook"}}

	if _, err := toolListRuns(context.Background(), client, args); err != nil {
		t.Fatalf("toolListRuns returned error: %v", err)
	}

	if client.getEndpoint != "runs" {
		t.Fatalf("unexpected get endpoint: %s", client.getEndpoint)
	}
	gotTypes := client.getParams["types"]
	if len(gotTypes) != 2 || gotTypes[0] != "channelChecklist" || gotTypes[1] != "playbook" {
		t.Fatalf("unexpected type filters: %#v", gotTypes)
	}
}

func TestToolCreateChecklistUsesCurrentUserAsOwner(t *testing.T) {
	client := &fakeAPIClient{
		run: playbookRunDetail{
			ID:        "abcdefghijklmnopqrstuvwxyz",
			Name:      "Release checklist",
			ChannelID: "bcdefghijklmnopqrstuvwxyza",
			Type:      "channelChecklist",
		},
	}
	args := CreateChecklistArgs{
		Name:      " Release checklist ",
		ChannelID: "bcdefghijklmnopqrstuvwxyza",
	}

	if _, err := toolCreateChecklist(context.Background(), client, args); err != nil {
		t.Fatalf("toolCreateChecklist returned error: %v", err)
	}

	if client.postEndpoint != "runs" {
		t.Fatalf("unexpected post endpoint: %s", client.postEndpoint)
	}
	body, ok := client.postBody.(map[string]any)
	if !ok {
		t.Fatalf("unexpected body type %T", client.postBody)
	}
	if got := body["owner_user_id"]; got != "abcdefghijklmnopqrstuvwxy0" {
		t.Errorf("expected current user as owner, got %q", got)
	}
	if got := body["name"]; got != "Release checklist" {
		t.Errorf("expected trimmed name, got %q", got)
	}
	if got := body["playbook_id"]; got != "" {
		t.Errorf("expected empty playbook_id, got %q", got)
	}
}

func TestRunToolEndpointsAndBodies(t *testing.T) {
	const runID = "abcdefghijklmnopqrstuvwxyz"
	const ownerID = "bcdefghijklmnopqrstuvwxyza"

	t.Run("get run", func(t *testing.T) {
		client := &fakeAPIClient{run: playbookRunDetail{ID: runID, Name: "Run"}}
		if _, err := toolGetRun(context.Background(), client, GetRunArgs{RunID: runID}); err != nil {
			t.Fatalf("toolGetRun returned error: %v", err)
		}
		if client.getEndpoint != "runs/abcdefghijklmnopqrstuvwxyz" {
			t.Fatalf("unexpected endpoint: %s", client.getEndpoint)
		}
	})

	t.Run("update status", func(t *testing.T) {
		client := &fakeAPIClient{}
		if _, err := toolUpdateRunStatus(context.Background(), client, UpdateRunStatusArgs{RunID: runID, Message: "Update", ReminderSeconds: 15}); err != nil {
			t.Fatalf("toolUpdateRunStatus returned error: %v", err)
		}
		if client.postEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/status" {
			t.Fatalf("unexpected endpoint: %s", client.postEndpoint)
		}
		body, ok := client.postBody.(map[string]any)
		if !ok {
			t.Fatalf("unexpected body type %T", client.postBody)
		}
		if body["message"] != "Update" || body["reminder"] != int64(15) || body["finish_run"] != false {
			t.Fatalf("unexpected body: %#v", body)
		}
	})

	t.Run("finish run", func(t *testing.T) {
		client := &fakeAPIClient{}
		if _, err := toolFinishRun(context.Background(), client, FinishRunArgs{RunID: runID}); err != nil {
			t.Fatalf("toolFinishRun returned error: %v", err)
		}
		if client.putEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/finish" {
			t.Fatalf("unexpected endpoint: %s", client.putEndpoint)
		}
		if client.putBody != nil {
			t.Fatalf("expected nil body, got %#v", client.putBody)
		}
	})

	t.Run("change owner", func(t *testing.T) {
		client := &fakeAPIClient{}
		if _, err := toolChangeRunOwner(context.Background(), client, ChangeRunOwnerArgs{RunID: runID, OwnerID: ownerID}); err != nil {
			t.Fatalf("toolChangeRunOwner returned error: %v", err)
		}
		if client.postEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/owner" {
			t.Fatalf("unexpected endpoint: %s", client.postEndpoint)
		}
		body, ok := client.postBody.(map[string]string)
		if !ok {
			t.Fatalf("unexpected body type %T", client.postBody)
		}
		if body["owner_id"] != ownerID {
			t.Fatalf("unexpected body: %#v", body)
		}
	})
}

func TestChecklistStructureToolEndpointsAndBodies(t *testing.T) {
	const runID = "abcdefghijklmnopqrstuvwxyz"
	const assigneeID = "bcdefghijklmnopqrstuvwxyza"

	t.Run("add checklist item", func(t *testing.T) {
		client := &fakeAPIClient{}
		args := AddChecklistItemArgs{RunID: runID, ChecklistNumber: 1, Title: " New item ", Description: "details", AssigneeID: assigneeID, DueDate: 1717200000000}
		_, err := toolAddChecklistItem(context.Background(), client, args)
		require.NoError(t, err)
		require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/add", client.postEndpoint)
		require.IsType(t, map[string]any{}, client.postBody)
		body := client.postBody.(map[string]any)
		assert.Equal(t, "New item", body["title"])
		assert.Equal(t, "details", body["description"])
		assert.Equal(t, assigneeID, body["assignee_id"])
		assert.Equal(t, int64(1717200000000), body["due_date"])
	})

	t.Run("add checklist item without due date omits due date", func(t *testing.T) {
		client := &fakeAPIClient{}
		args := AddChecklistItemArgs{RunID: runID, ChecklistNumber: 1, Title: " New item "}
		_, err := toolAddChecklistItem(context.Background(), client, args)
		require.NoError(t, err)
		require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/add", client.postEndpoint)
		require.IsType(t, map[string]any{}, client.postBody)
		body := client.postBody.(map[string]any)
		assert.NotContains(t, body, "due_date")
	})

	t.Run("set checklist item due date", func(t *testing.T) {
		client := &fakeAPIClient{}
		args := SetChecklistItemDueDateArgs{RunID: runID, ChecklistNumber: 1, ItemNumber: 2, DueDate: 1717200000000}
		_, err := toolSetChecklistItemDueDate(context.Background(), client, args)
		require.NoError(t, err)
		require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2/duedate", client.putEndpoint)
		require.IsType(t, map[string]int64{}, client.putBody)
		body := client.putBody.(map[string]int64)
		assert.Equal(t, int64(1717200000000), body["due_date"])
	})

	t.Run("clear checklist item due date", func(t *testing.T) {
		client := &fakeAPIClient{}
		args := SetChecklistItemDueDateArgs{RunID: runID, ChecklistNumber: 1, ItemNumber: 2, DueDate: 0}
		_, err := toolSetChecklistItemDueDate(context.Background(), client, args)
		require.NoError(t, err)
		require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2/duedate", client.putEndpoint)
		require.IsType(t, map[string]int64{}, client.putBody)
		body := client.putBody.(map[string]int64)
		assert.Equal(t, int64(0), body["due_date"])
	})

	t.Run("remove checklist item", func(t *testing.T) {
		client := &fakeAPIClient{}
		if _, err := toolRemoveChecklistItem(context.Background(), client, RemoveChecklistItemArgs{RunID: runID, ChecklistNumber: 1, ItemNumber: 2}); err != nil {
			t.Fatalf("toolRemoveChecklistItem returned error: %v", err)
		}
		if client.deleteEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2" {
			t.Fatalf("unexpected endpoint: %s", client.deleteEndpoint)
		}
	})

	t.Run("move checklist item", func(t *testing.T) {
		client := &fakeAPIClient{}
		args := MoveChecklistItemArgs{
			RunID:              runID,
			SourceChecklistIdx: 1,
			SourceItemIdx:      2,
			DestChecklistIdx:   3,
			DestItemIdx:        4,
		}
		if _, err := toolMoveChecklistItem(context.Background(), client, args); err != nil {
			t.Fatalf("toolMoveChecklistItem returned error: %v", err)
		}
		if client.postEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists/move-item" {
			t.Fatalf("unexpected endpoint: %s", client.postEndpoint)
		}
		body, ok := client.postBody.(map[string]int)
		if !ok {
			t.Fatalf("unexpected body type %T", client.postBody)
		}
		expected := map[string]int{
			"source_checklist_idx": 1,
			"source_item_idx":      2,
			"dest_checklist_idx":   3,
			"dest_item_idx":        4,
		}
		if !reflect.DeepEqual(body, expected) {
			t.Fatalf("unexpected body: %#v", body)
		}
	})

	t.Run("add section", func(t *testing.T) {
		client := &fakeAPIClient{}
		if _, err := toolAddSection(context.Background(), client, AddSectionArgs{RunID: runID, Title: " Section "}); err != nil {
			t.Fatalf("toolAddSection returned error: %v", err)
		}
		if client.postEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists" {
			t.Fatalf("unexpected endpoint: %s", client.postEndpoint)
		}
		body, ok := client.postBody.(map[string]string)
		if !ok {
			t.Fatalf("unexpected body type %T", client.postBody)
		}
		if body["title"] != "Section" {
			t.Fatalf("unexpected body: %#v", body)
		}
	})

	t.Run("rename section", func(t *testing.T) {
		client := &fakeAPIClient{}
		if _, err := toolRenameSection(context.Background(), client, RenameSectionArgs{RunID: runID, ChecklistNumber: 1, Title: " Renamed "}); err != nil {
			t.Fatalf("toolRenameSection returned error: %v", err)
		}
		if client.putEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/rename" {
			t.Fatalf("unexpected endpoint: %s", client.putEndpoint)
		}
		body, ok := client.putBody.(map[string]string)
		if !ok {
			t.Fatalf("unexpected body type %T", client.putBody)
		}
		if body["title"] != "Renamed" {
			t.Fatalf("unexpected body: %#v", body)
		}
	})

	t.Run("remove section", func(t *testing.T) {
		client := &fakeAPIClient{}
		if _, err := toolRemoveSection(context.Background(), client, RemoveSectionArgs{RunID: runID, ChecklistNumber: 1}); err != nil {
			t.Fatalf("toolRemoveSection returned error: %v", err)
		}
		if client.deleteEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists/1" {
			t.Fatalf("unexpected endpoint: %s", client.deleteEndpoint)
		}
	})

	t.Run("move section", func(t *testing.T) {
		client := &fakeAPIClient{}
		args := MoveSectionArgs{RunID: runID, SourceChecklistIdx: 2, DestChecklistIdx: 0}
		if _, err := toolMoveSection(context.Background(), client, args); err != nil {
			t.Fatalf("toolMoveSection returned error: %v", err)
		}
		if client.postEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists/move" {
			t.Fatalf("unexpected endpoint: %s", client.postEndpoint)
		}
		body, ok := client.postBody.(map[string]int)
		if !ok {
			t.Fatalf("unexpected body type %T", client.postBody)
		}
		expected := map[string]int{
			"source_checklist_idx": 2,
			"dest_checklist_idx":   0,
		}
		if !reflect.DeepEqual(body, expected) {
			t.Fatalf("unexpected body: %#v", body)
		}
	})
}

func TestMoveChecklistToolsValidation(t *testing.T) {
	const runID = "abcdefghijklmnopqrstuvwxyz"

	tests := []struct {
		name    string
		runTool func(context.Context, APIClient) (string, error)
		wantErr string
	}{
		{
			name: "move section rejects invalid run id",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolMoveSection(ctx, client, MoveSectionArgs{RunID: "invalid", SourceChecklistIdx: 0, DestChecklistIdx: 1})
			},
			wantErr: "run_id must be a valid Mattermost ID",
		},
		{
			name: "move section rejects negative source checklist index",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolMoveSection(ctx, client, MoveSectionArgs{RunID: runID, SourceChecklistIdx: -1, DestChecklistIdx: 1})
			},
			wantErr: "source_checklist_idx must be a non-negative integer, got -1",
		},
		{
			name: "move section rejects negative destination checklist index",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolMoveSection(ctx, client, MoveSectionArgs{RunID: runID, SourceChecklistIdx: 0, DestChecklistIdx: -1})
			},
			wantErr: "dest_checklist_idx must be a non-negative integer, got -1",
		},
		{
			name: "move checklist item rejects invalid run id",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolMoveChecklistItem(ctx, client, MoveChecklistItemArgs{RunID: "invalid", SourceChecklistIdx: 0, SourceItemIdx: 1, DestChecklistIdx: 2, DestItemIdx: 3})
			},
			wantErr: "run_id must be a valid Mattermost ID",
		},
		{
			name: "move checklist item rejects negative source checklist index",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolMoveChecklistItem(ctx, client, MoveChecklistItemArgs{RunID: runID, SourceChecklistIdx: -1, SourceItemIdx: 1, DestChecklistIdx: 2, DestItemIdx: 3})
			},
			wantErr: "source_checklist_idx must be a non-negative integer, got -1",
		},
		{
			name: "move checklist item rejects negative source item index",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolMoveChecklistItem(ctx, client, MoveChecklistItemArgs{RunID: runID, SourceChecklistIdx: 0, SourceItemIdx: -1, DestChecklistIdx: 2, DestItemIdx: 3})
			},
			wantErr: "source_item_idx must be a non-negative integer, got -1",
		},
		{
			name: "move checklist item rejects negative destination checklist index",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolMoveChecklistItem(ctx, client, MoveChecklistItemArgs{RunID: runID, SourceChecklistIdx: 0, SourceItemIdx: 1, DestChecklistIdx: -1, DestItemIdx: 3})
			},
			wantErr: "dest_checklist_idx must be a non-negative integer, got -1",
		},
		{
			name: "move checklist item rejects negative destination item index",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolMoveChecklistItem(ctx, client, MoveChecklistItemArgs{RunID: runID, SourceChecklistIdx: 0, SourceItemIdx: 1, DestChecklistIdx: 2, DestItemIdx: -1})
			},
			wantErr: "dest_item_idx must be a non-negative integer, got -1",
		},
		{
			name: "set checklist item due date rejects invalid run id",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolSetChecklistItemDueDate(ctx, client, SetChecklistItemDueDateArgs{RunID: "invalid", ChecklistNumber: 0, ItemNumber: 1, DueDate: 1717200000000})
			},
			wantErr: "run_id must be a valid Mattermost ID",
		},
		{
			name: "set checklist item due date rejects negative checklist index",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolSetChecklistItemDueDate(ctx, client, SetChecklistItemDueDateArgs{RunID: runID, ChecklistNumber: -1, ItemNumber: 1, DueDate: 1717200000000})
			},
			wantErr: "checklist_number must be a non-negative integer, got -1",
		},
		{
			name: "set checklist item due date rejects negative item index",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolSetChecklistItemDueDate(ctx, client, SetChecklistItemDueDateArgs{RunID: runID, ChecklistNumber: 0, ItemNumber: -1, DueDate: 1717200000000})
			},
			wantErr: "item_number must be a non-negative integer, got -1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{}
			_, err := tt.runTool(context.Background(), client)
			require.EqualError(t, err, tt.wantErr)
			require.Equal(t, "", client.postEndpoint)
			require.Equal(t, "", client.putEndpoint)
		})
	}
}
