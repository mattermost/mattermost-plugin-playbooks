// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"fmt"
	"net/url"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeAPIClient struct {
	run           playbookRunDetail
	listRuns      listRunsResponse
	playbook      map[string]any
	listPlaybooks listPlaybooksResponse
	// listPages, when set, returns a distinct listRunsResponse per page index
	// so pagination can be exercised.
	listPages []listRunsResponse

	// runsByID, when set, lets Get resolve a specific run by the ID in the
	// "runs/{id}" endpoint. Falls back to run when the ID is not present.
	runsByID map[string]playbookRunDetail

	// currentUserID / currentUserErr override GetCurrentUserID when set.
	currentUserID  string
	currentUserErr error

	getEndpoint  string
	getParams    url.Values
	getEndpoints []string
	listParams   url.Values
	listCalls    []url.Values

	postEndpoint string
	postBody     any
	postResult   any

	putEndpoint  string
	putBody      any
	putEndpoints []string
	putBodies    []any

	deleteEndpoint string
}

func (f *fakeAPIClient) Get(_ context.Context, endpoint string, params url.Values, result any) error {
	f.getEndpoint = endpoint
	f.getParams = params
	f.getEndpoints = append(f.getEndpoints, endpoint)
	switch v := result.(type) {
	case *playbookRunDetail:
		*v = f.run
		if f.runsByID != nil {
			id := strings.TrimPrefix(endpoint, "runs/")
			if run, ok := f.runsByID[id]; ok {
				*v = run
			}
		}
	case *listRunsResponse:
		*v = f.listRuns
		if f.listPages != nil {
			page, _ := strconv.Atoi(params.Get("page"))
			if page >= 0 && page < len(f.listPages) {
				*v = f.listPages[page]
			} else {
				*v = listRunsResponse{}
			}
		}
		f.listParams = params
		f.listCalls = append(f.listCalls, cloneValues(params))
	case *listPlaybooksResponse:
		*v = f.listPlaybooks
	case *map[string]any:
		if f.playbook != nil {
			*v = cloneMapAny(f.playbook)
		} else {
			*v = map[string]any{"id": "abcdefghijklmnopqrstuvwxyz", "title": "Created playbook"}
		}
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
	f.putEndpoints = append(f.putEndpoints, endpoint)
	f.putBodies = append(f.putBodies, body)
	return nil
}

func (f *fakeAPIClient) Delete(_ context.Context, endpoint string) error {
	f.deleteEndpoint = endpoint
	return nil
}

func (f *fakeAPIClient) GetCurrentUserID(context.Context) (string, error) {
	if f.currentUserErr != nil {
		return "", f.currentUserErr
	}
	if f.currentUserID != "" {
		return f.currentUserID, nil
	}
	return "abcdefghijklmnopqrstuvwxy0", nil
}

func (f *fakeAPIClient) GetPlaybookURL(playbookID string) string {
	return "https://mattermost.example.com/playbooks/playbooks/" + playbookID
}

// cloneValues snapshots query params, since fetchRunDetails mutates the same
// url.Values across pagination iterations.
func cloneValues(v url.Values) url.Values {
	out := url.Values{}
	for k, vals := range v {
		out[k] = append([]string(nil), vals...)
	}
	return out
}

func cloneMapAny(in map[string]any) map[string]any {
	out := make(map[string]any, len(in))
	for k, v := range in {
		out[k] = cloneAny(v)
	}
	return out
}

func cloneAny(in any) any {
	switch v := in.(type) {
	case map[string]any:
		return cloneMapAny(v)
	case []any:
		out := make([]any, len(v))
		for i := range v {
			out[i] = cloneAny(v[i])
		}
		return out
	default:
		return v
	}
}

// fixtureRun builds a run with the given number of sections and items per
// section, so tests can exercise index-based tools that bounds-check.
func fixtureRun(runID string, checklists, items int) playbookRunDetail {
	run := playbookRunDetail{ID: runID}
	for c := 0; c < checklists; c++ {
		cl := checklist{Title: fmt.Sprintf("Section %d", c)}
		for i := 0; i < items; i++ {
			cl.Items = append(cl.Items, checklistItem{Title: fmt.Sprintf("Item %d-%d", c, i)})
		}
		run.Checklists = append(run.Checklists, cl)
	}
	return run
}

func TestToolCheckItemOpenTranslatesToEmptyAPIState(t *testing.T) {
	client := &fakeAPIClient{
		run: playbookRunDetail{
			ID: "abcdefghijklmnopqrstuvwxyz",
			Checklists: []checklist{
				{Items: []checklistItem{{}}},
				{Items: []checklistItem{{}, {}, {Title: "Deploy", State: "closed"}}},
			},
		},
	}
	args := CheckItemArgs{
		RunID:           "abcdefghijklmnopqrstuvwxyz",
		ChecklistNumber: 1,
		ItemNumber:      2,
		NewState:        "open",
	}

	_, err := toolCheckItem(context.Background(), client, args)
	require.NoError(t, err)

	require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2/state", client.putEndpoint)
	body, ok := client.putBody.(map[string]string)
	require.Truef(t, ok, "unexpected body type %T", client.putBody)
	assert.Empty(t, body["new_state"], "expected open state to be sent as empty string")
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
	body, ok := client.putBody.(map[string]string)
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

	assert.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz", client.getEndpoint)
	require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/0/item/0/duedate", client.putEndpoint)
	require.IsType(t, map[string]int64{}, client.putBody)
	body := client.putBody.(map[string]int64)
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

	assert.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz", client.getEndpoint)
	require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/0/item/0/duedate", client.putEndpoint)
	require.IsType(t, map[string]int64{}, client.putBody)
	body := client.putBody.(map[string]int64)
	assert.Equal(t, int64(0), body["due_date"])
}

func TestToolEditChecklistItemUpdatesFieldsAndDueDate(t *testing.T) {
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
	newTitle := "new title"
	dueDate := int64(1717200000000)
	args := EditChecklistItemArgs{
		RunID:           "abcdefghijklmnopqrstuvwxyz",
		ChecklistNumber: 0,
		ItemNumber:      0,
		Title:           &newTitle,
		DueDate:         &dueDate,
	}

	_, err := toolEditChecklistItem(context.Background(), client, args)
	require.NoError(t, err)

	require.Equal(t, []string{
		"runs/abcdefghijklmnopqrstuvwxyz/checklists/0/item/0",
		"runs/abcdefghijklmnopqrstuvwxyz/checklists/0/item/0/duedate",
	}, client.putEndpoints)
	require.Len(t, client.putBodies, 2)
	editBody, ok := client.putBodies[0].(map[string]string)
	require.True(t, ok)
	assert.Equal(t, "new title", editBody["title"])
	assert.Equal(t, "old description", editBody["description"])
	assert.Equal(t, "/old-command", editBody["command"])
	dueDateBody, ok := client.putBodies[1].(map[string]int64)
	require.True(t, ok)
	assert.Equal(t, int64(1717200000000), dueDateBody["due_date"])
}

func TestToolAddChecklistItemRejectsInvalidAssignee(t *testing.T) {
	client := &fakeAPIClient{}
	args := AddChecklistItemArgs{
		RunID:           "abcdefghijklmnopqrstuvwxyz",
		ChecklistNumber: 0,
		Title:           "New item",
		AssigneeID:      "invalid",
	}

	if _, err := toolAddChecklistItem(context.Background(), client, args); err == nil || err.Error() != "assignee_id must be a valid Mattermost ID" {
		t.Fatalf("expected assignee validation error, got %v", err)
	}

	if client.postEndpoint != "" {
		t.Fatalf("expected validation to fail before API call, got endpoint %q", client.postEndpoint)
	}
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

	// The mutating tools now bounds-check indexes against the run, so provide a
	// run large enough for every index used below (checklists 0-3, items 0-4).
	fixture := fixtureRun(runID, 4, 5)
	newClient := func() *fakeAPIClient { return &fakeAPIClient{run: fixture} }

	t.Run("add checklist item", func(t *testing.T) {
		client := newClient()
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
		client := newClient()
		args := AddChecklistItemArgs{RunID: runID, ChecklistNumber: 1, Title: " New item "}
		_, err := toolAddChecklistItem(context.Background(), client, args)
		require.NoError(t, err)
		require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/add", client.postEndpoint)
		require.IsType(t, map[string]any{}, client.postBody)
		body := client.postBody.(map[string]any)
		assert.NotContains(t, body, "due_date")
	})

	t.Run("set checklist item due date", func(t *testing.T) {
		client := newClient()
		args := SetChecklistItemDueDateArgs{RunID: runID, ChecklistNumber: 1, ItemNumber: 2, DueDate: 1717200000000}
		_, err := toolSetChecklistItemDueDate(context.Background(), client, args)
		require.NoError(t, err)
		require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2/duedate", client.putEndpoint)
		require.IsType(t, map[string]int64{}, client.putBody)
		body := client.putBody.(map[string]int64)
		assert.Equal(t, int64(1717200000000), body["due_date"])
	})

	t.Run("clear checklist item due date", func(t *testing.T) {
		client := newClient()
		args := SetChecklistItemDueDateArgs{RunID: runID, ChecklistNumber: 1, ItemNumber: 2, DueDate: 0}
		_, err := toolSetChecklistItemDueDate(context.Background(), client, args)
		require.NoError(t, err)
		require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2/duedate", client.putEndpoint)
		require.IsType(t, map[string]int64{}, client.putBody)
		body := client.putBody.(map[string]int64)
		assert.Equal(t, int64(0), body["due_date"])
	})

	t.Run("set checklist item assignee", func(t *testing.T) {
		client := newClient()
		args := SetChecklistItemAssigneeArgs{RunID: runID, ChecklistNumber: 1, ItemNumber: 2, AssigneeID: assigneeID}
		_, err := toolSetChecklistItemAssignee(context.Background(), client, args)
		require.NoError(t, err)
		require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2/assignee", client.putEndpoint)
		require.IsTypef(t, map[string]string{}, client.putBody, "unexpected body type %T", client.putBody)

		body := client.putBody.(map[string]string)
		assert.Equal(t, assigneeID, body["assignee_id"])
	})

	t.Run("clear checklist item assignee", func(t *testing.T) {
		client := newClient()
		args := SetChecklistItemAssigneeArgs{RunID: runID, ChecklistNumber: 1, ItemNumber: 2}
		_, err := toolSetChecklistItemAssignee(context.Background(), client, args)
		require.NoError(t, err)
		require.Equal(t, "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2/assignee", client.putEndpoint)
		require.IsTypef(t, map[string]string{}, client.putBody, "unexpected body type %T", client.putBody)

		body := client.putBody.(map[string]string)
		assert.Equal(t, "", body["assignee_id"])
	})

	t.Run("remove checklist item", func(t *testing.T) {
		client := newClient()
		if _, err := toolRemoveChecklistItem(context.Background(), client, RemoveChecklistItemArgs{RunID: runID, ChecklistNumber: 1, ItemNumber: 2}); err != nil {
			t.Fatalf("toolRemoveChecklistItem returned error: %v", err)
		}
		if client.deleteEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2" {
			t.Fatalf("unexpected endpoint: %s", client.deleteEndpoint)
		}
	})

	t.Run("move checklist item", func(t *testing.T) {
		client := newClient()
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
		client := newClient()
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
		client := newClient()
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
		client := newClient()
		if _, err := toolRemoveSection(context.Background(), client, RemoveSectionArgs{RunID: runID, ChecklistNumber: 1}); err != nil {
			t.Fatalf("toolRemoveSection returned error: %v", err)
		}
		if client.deleteEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists/1" {
			t.Fatalf("unexpected endpoint: %s", client.deleteEndpoint)
		}
	})

	t.Run("move section", func(t *testing.T) {
		client := newClient()
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

func TestChecklistToolsOutOfRangeIndexes(t *testing.T) {
	const runID = "abcdefghijklmnopqrstuvwxyz"
	const assigneeID = "bcdefghijklmnopqrstuvwxyza"

	// A run with two sections of two items each: valid indexes are 0-1, so
	// index 5 is always out of range while still passing the negative-index
	// validation that runs before the run is fetched.
	fixture := fixtureRun(runID, 2, 2)

	tests := []struct {
		name    string
		runTool func(context.Context, APIClient) (string, error)
		wantErr string
	}{
		{
			name: "add checklist item rejects out-of-range checklist",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolAddChecklistItem(ctx, client, AddChecklistItemArgs{RunID: runID, ChecklistNumber: 5, Title: "New item"})
			},
			wantErr: "checklist_number 5 is out of range",
		},
		{
			name: "set checklist item due date rejects out-of-range item",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolSetChecklistItemDueDate(ctx, client, SetChecklistItemDueDateArgs{RunID: runID, ChecklistNumber: 0, ItemNumber: 5, DueDate: 1717200000000})
			},
			wantErr: "item_number 5 is out of range",
		},
		{
			name: "edit checklist item rejects out-of-range item",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				title := "Updated"
				return toolEditChecklistItem(ctx, client, EditChecklistItemArgs{RunID: runID, ChecklistNumber: 0, ItemNumber: 5, Title: &title})
			},
			wantErr: "item_number 5 is out of range",
		},
		{
			name: "set checklist item assignee rejects out-of-range item",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolSetChecklistItemAssignee(ctx, client, SetChecklistItemAssigneeArgs{RunID: runID, ChecklistNumber: 0, ItemNumber: 5, AssigneeID: assigneeID})
			},
			wantErr: "item_number 5 is out of range",
		},
		{
			name: "remove checklist item rejects out-of-range item",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolRemoveChecklistItem(ctx, client, RemoveChecklistItemArgs{RunID: runID, ChecklistNumber: 0, ItemNumber: 5})
			},
			wantErr: "item_number 5 is out of range",
		},
		{
			name: "rename section rejects out-of-range checklist",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolRenameSection(ctx, client, RenameSectionArgs{RunID: runID, ChecklistNumber: 5, Title: "Renamed"})
			},
			wantErr: "checklist_number 5 is out of range",
		},
		{
			// The move tool's argument is source_checklist_idx, not
			// checklist_number, so the error must name the field the caller passed.
			name: "move checklist item names source_checklist_idx when out of range",
			runTool: func(ctx context.Context, client APIClient) (string, error) {
				return toolMoveChecklistItem(ctx, client, MoveChecklistItemArgs{RunID: runID, SourceChecklistIdx: 5, SourceItemIdx: 0, DestChecklistIdx: 0, DestItemIdx: 0})
			},
			wantErr: "source_checklist_idx 5 is out of range",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{run: fixture}
			_, err := tt.runTool(context.Background(), client)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
			assert.Empty(t, client.postEndpoint, "expected no create/move on out-of-range")
			assert.Empty(t, client.putEndpoint, "expected no update on out-of-range")
			assert.Empty(t, client.deleteEndpoint, "expected no delete on out-of-range")
		})
	}
}

func TestToolSetChecklistItemAssigneeValidation(t *testing.T) {
	const runID = "abcdefghijklmnopqrstuvwxyz"
	const assigneeID = "bcdefghijklmnopqrstuvwxyza"

	tests := []struct {
		name    string
		args    SetChecklistItemAssigneeArgs
		wantErr string
	}{
		{
			name:    "rejects invalid run id",
			args:    SetChecklistItemAssigneeArgs{RunID: "invalid", ChecklistNumber: 0, ItemNumber: 1, AssigneeID: assigneeID},
			wantErr: "run_id must be a valid Mattermost ID",
		},
		{
			name:    "rejects negative checklist index",
			args:    SetChecklistItemAssigneeArgs{RunID: runID, ChecklistNumber: -1, ItemNumber: 1, AssigneeID: assigneeID},
			wantErr: "checklist_number must be a non-negative integer, got -1",
		},
		{
			name:    "rejects negative item index",
			args:    SetChecklistItemAssigneeArgs{RunID: runID, ChecklistNumber: 0, ItemNumber: -1, AssigneeID: assigneeID},
			wantErr: "item_number must be a non-negative integer, got -1",
		},
		{
			name:    "rejects invalid assignee id",
			args:    SetChecklistItemAssigneeArgs{RunID: runID, ChecklistNumber: 0, ItemNumber: 1, AssigneeID: "invalid"},
			wantErr: "assignee_id must be a valid Mattermost ID",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{}
			_, err := toolSetChecklistItemAssignee(context.Background(), client, tt.args)
			if err == nil || err.Error() != tt.wantErr {
				t.Fatalf("expected error %q, got %v", tt.wantErr, err)
			}
			if client.putEndpoint != "" {
				t.Fatalf("expected validation to fail before API call, got endpoint %q", client.putEndpoint)
			}
		})
	}
}
