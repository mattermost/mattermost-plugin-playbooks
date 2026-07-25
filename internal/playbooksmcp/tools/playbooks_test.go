// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestToolCreatePlaybookPostsPlaybook(t *testing.T) {
	client := &fakeAPIClient{}
	_, err := toolCreatePlaybook(context.Background(), client, CreatePlaybookArgs{
		Title:  "  Cloud Incident Response  ",
		TeamID: "abcdefghijklmnopqrstuvwxyz",
	})
	if err != nil {
		t.Fatalf("toolCreatePlaybook returned error: %v", err)
	}
	if client.postEndpoint != "playbooks" {
		t.Fatalf("unexpected post endpoint: %s", client.postEndpoint)
	}
	body := client.postBody.(map[string]any)
	if body["title"] != "Cloud Incident Response" {
		t.Errorf("expected trimmed title, got %q", body["title"])
	}
	if body["team_id"] != "abcdefghijklmnopqrstuvwxyz" {
		t.Errorf("expected team_id, got %q", body["team_id"])
	}
	if body["public"] != true {
		t.Errorf("expected public to default true, got %#v", body["public"])
	}
	if body["reminder_timer_default_seconds"] != defaultReminderTimerSeconds {
		t.Errorf("expected default reminder, got %#v", body["reminder_timer_default_seconds"])
	}
}

func TestToolCreatePlaybookAllowsExplicitPrivatePlaybook(t *testing.T) {
	client := &fakeAPIClient{}
	private := false
	_, err := toolCreatePlaybook(context.Background(), client, CreatePlaybookArgs{Title: "Private", TeamID: "abcdefghijklmnopqrstuvwxyz", Public: &private})
	if err != nil {
		t.Fatalf("toolCreatePlaybook returned error: %v", err)
	}
	if got := client.postBody.(map[string]any)["public"]; got != false {
		t.Fatalf("expected public false, got %#v", got)
	}
}

func TestToolCreatePlaybookDefaultsOwnerToCurrentUser(t *testing.T) {
	client := &fakeAPIClient{}
	_, err := toolCreatePlaybook(context.Background(), client, CreatePlaybookArgs{Title: "Owner", TeamID: "abcdefghijklmnopqrstuvwxyz"})
	if err != nil {
		t.Fatalf("toolCreatePlaybook returned error: %v", err)
	}
	body := client.postBody.(map[string]any)
	if got := body["default_owner_id"]; got != "abcdefghijklmnopqrstuvwxy0" {
		t.Errorf("expected current user default owner, got %q", got)
	}
	if got := body["default_owner_enabled"]; got != true {
		t.Errorf("expected default_owner_enabled true, got %#v", got)
	}
}

func TestToolCreatePlaybookAutoInvitesTaskAssignees(t *testing.T) {
	client := &fakeAPIClient{}
	assigneeID := "bcdefghijklmnopqrstuvwxyza"
	_, err := toolCreatePlaybook(context.Background(), client, CreatePlaybookArgs{
		Title:      "Assigned",
		TeamID:     "abcdefghijklmnopqrstuvwxyz",
		Checklists: []CreatePlaybookChecklist{{Title: "Triage", Items: []CreatePlaybookItem{{Title: "Gather impact", AssigneeID: assigneeID}}}},
	})
	if err != nil {
		t.Fatalf("toolCreatePlaybook returned error: %v", err)
	}
	body := client.postBody.(map[string]any)
	ids := body["invited_user_ids"].([]string)
	if len(ids) != 1 || ids[0] != assigneeID {
		t.Fatalf("expected assignee invited, got %#v", ids)
	}
	if got := body["invite_users_enabled"]; got != true {
		t.Fatalf("expected invite_users_enabled true, got %#v", got)
	}
}

func TestToolCreatePlaybookFetchesCreatedPlaybookAndReturnsURL(t *testing.T) {
	client := &fakeAPIClient{}
	result, err := toolCreatePlaybook(context.Background(), client, CreatePlaybookArgs{Title: "Fetch", TeamID: "abcdefghijklmnopqrstuvwxyz"})
	if err != nil {
		t.Fatalf("toolCreatePlaybook returned error: %v", err)
	}
	if client.getEndpoint != "playbooks/abcdefghijklmnopqrstuvwxyz" {
		t.Fatalf("unexpected get endpoint: %s", client.getEndpoint)
	}
	var decoded createPlaybookResult
	if err := json.Unmarshal([]byte(result), &decoded); err != nil {
		t.Fatalf("result is not JSON: %v", err)
	}
	if decoded.PlaybookURL != "https://mattermost.example.com/playbooks/playbooks/abcdefghijklmnopqrstuvwxyz" {
		t.Fatalf("unexpected playbook_url: %s", decoded.PlaybookURL)
	}
}

func TestToolCreatePlaybookRejectsInvalidInput(t *testing.T) {
	tests := []struct {
		name string
		args CreatePlaybookArgs
		want string
	}{
		{"blank title", CreatePlaybookArgs{Title: " ", TeamID: "abcdefghijklmnopqrstuvwxyz"}, "title is required"},
		{"invalid team", CreatePlaybookArgs{Title: "x", TeamID: "bad"}, "team_id must be a valid Mattermost ID"},
		{"blank checklist", CreatePlaybookArgs{Title: "x", TeamID: "abcdefghijklmnopqrstuvwxyz", Checklists: []CreatePlaybookChecklist{{Title: " "}}}, "checklists[0].title is required"},
		{"blank item", CreatePlaybookArgs{Title: "x", TeamID: "abcdefghijklmnopqrstuvwxyz", Checklists: []CreatePlaybookChecklist{{Title: "ok", Items: []CreatePlaybookItem{{Title: " "}}}}}, "checklists[0].items[0].title is required"},
		{"invalid webhook", CreatePlaybookArgs{Title: "x", TeamID: "abcdefghijklmnopqrstuvwxyz", WebhookOnCreationURLs: []string{"ftp://example.com"}}, "webhook_on_creation_urls[0] must be an http or https URL"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{}
			_, err := toolCreatePlaybook(context.Background(), client, tt.args)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("expected error containing %q, got %v", tt.want, err)
			}
			if client.postEndpoint != "" {
				t.Fatalf("expected validation before API call, got %s", client.postEndpoint)
			}
		})
	}
}

func TestToolCreatePlaybookValidatesMetrics(t *testing.T) {
	args := CreatePlaybookArgs{Title: "Metrics", TeamID: "abcdefghijklmnopqrstuvwxyz", Metrics: []CreatePlaybookMetric{{Title: "Time", Type: "bad"}}}
	_, err := toolCreatePlaybook(context.Background(), &fakeAPIClient{}, args)
	if err == nil || !strings.Contains(err.Error(), "metrics[0].type") {
		t.Fatalf("expected metric type error, got %v", err)
	}
}

func TestToolCreatePlaybookSupportsWebhooks(t *testing.T) {
	client := &fakeAPIClient{}
	_, err := toolCreatePlaybook(context.Background(), client, CreatePlaybookArgs{
		Title:                     "Hooks",
		TeamID:                    "abcdefghijklmnopqrstuvwxyz",
		WebhookOnCreationURLs:     []string{"https://example.com/create"},
		WebhookOnStatusUpdateURLs: []string{"http://example.com/status"},
	})
	if err != nil {
		t.Fatalf("toolCreatePlaybook returned error: %v", err)
	}
	body := client.postBody.(map[string]any)
	if body["webhook_on_creation_enabled"] != true || body["webhook_on_status_update_enabled"] != true {
		t.Fatalf("expected webhook enablement defaults, got %#v", body)
	}
}

func TestToolListPlaybooksUsesFiltersAndFormatsIDs(t *testing.T) {
	client := &fakeAPIClient{
		listPlaybooks: listPlaybooksResponse{
			TotalCount: 1,
			Items: []playbookSummary{
				{ID: "abcdefghijklmnopqrstuvwxyz", Title: "Incident Response", TeamID: "bcdefghijklmnopqrstuvwxyza", Public: true},
			},
		},
	}

	result, err := toolListPlaybooks(context.Background(), client, ListPlaybooksArgs{
		TeamID:     "bcdefghijklmnopqrstuvwxyza",
		SearchTerm: "  Incident  ",
		PerPage:    200,
	})
	require.NoError(t, err)
	assert.Equal(t, "playbooks", client.getEndpoint)
	assert.Equal(t, "bcdefghijklmnopqrstuvwxyza", client.getParams.Get("team_id"))
	assert.Equal(t, "Incident", client.getParams.Get("search_term"))
	assert.Equal(t, "100", client.getParams.Get("per_page"))
	assert.Contains(t, result, "Incident Response")
	assert.Contains(t, result, "playbook_id: abcdefghijklmnopqrstuvwxyz")
}

func TestToolGetPlaybookReturnsFetchedTemplate(t *testing.T) {
	playbookID := "abcdefghijklmnopqrstuvwxyz"
	client := &fakeAPIClient{
		playbook: map[string]any{
			"id":    playbookID,
			"title": "Incident Response",
		},
	}

	result, err := toolGetPlaybook(context.Background(), client, GetPlaybookArgs{PlaybookID: playbookID})
	require.NoError(t, err)
	assert.Equal(t, "playbooks/"+playbookID, client.getEndpoint)
	assert.Contains(t, result, `"title": "Incident Response"`)
}

func TestToolAddPlaybookTaskGetsAndPutsMutatedPlaybook(t *testing.T) {
	playbookID := "abcdefghijklmnopqrstuvwxyz"
	existingUserID := "bcdefghijklmnopqrstuvwxyza"
	assigneeID := "cdefghijklmnopqrstuvwxyzab"
	client := &fakeAPIClient{
		playbook: map[string]any{
			"id":                   playbookID,
			"title":                "Incident Response",
			"public":               false,
			"custom_field":         "preserve me",
			"invited_user_ids":     []any{existingUserID},
			"invite_users_enabled": false,
			"checklists": []any{
				map[string]any{
					"title":                  "Triage",
					"items_order":            []any{"task-id-1"},
					"custom_checklist_field": "preserve checklist field",
					"items": []any{
						map[string]any{
							"id":                "task-id-1",
							"title":             "Existing task",
							"description":       "Keep this description",
							"command":           "/keep",
							"assignee_id":       existingUserID,
							"due_date":          float64(5000),
							"state":             "closed",
							"custom_task_field": "preserve task field",
						},
					},
				},
			},
		},
	}

	_, err := toolAddPlaybookTask(context.Background(), client, AddPlaybookTaskArgs{
		PlaybookID:      playbookID,
		ChecklistNumber: 0,
		Title:           "  Verify remediation  ",
		Description:     "Confirm the incident is resolved.",
		Command:         "/remediate",
		AssigneeID:      assigneeID,
		DueDate:         86400000,
	})
	require.NoError(t, err)
	require.Equal(t, "playbooks/"+playbookID, client.getEndpoint)
	require.Equal(t, "playbooks/"+playbookID, client.putEndpoint)

	body := requirePlaybookPutBody(t, client)
	assert.Equal(t, "Incident Response", body["title"])
	assert.Equal(t, false, body["public"])
	assert.Equal(t, "preserve me", body["custom_field"])
	assert.Equal(t, true, body["invite_users_enabled"])
	invited := body["invited_user_ids"].([]any)
	assert.Contains(t, invited, existingUserID)
	assert.Contains(t, invited, assigneeID)

	checklist := requirePlaybookChecklist(t, body, 0)
	assert.Equal(t, []any{"task-id-1"}, checklist["items_order"])
	assert.Equal(t, "preserve checklist field", checklist["custom_checklist_field"])
	items := requirePlaybookItems(t, body, 0)
	require.Len(t, items, 2)
	existingTask := items[0].(map[string]any)
	assert.Equal(t, "Existing task", existingTask["title"])
	assert.Equal(t, "preserve task field", existingTask["custom_task_field"])
	assert.Equal(t, "closed", existingTask["state"])

	addedTask := items[1].(map[string]any)
	assert.Equal(t, "Verify remediation", addedTask["title"])
	assert.Equal(t, "Confirm the incident is resolved.", addedTask["description"])
	assert.Equal(t, "/remediate", addedTask["command"])
	assert.Equal(t, assigneeID, addedTask["assignee_id"])
	assert.Equal(t, int64(86400000), addedTask["due_date"])
}

func TestToolAddPlaybookTaskCreatesItemsAndDoesNotDuplicateInvite(t *testing.T) {
	playbookID := "abcdefghijklmnopqrstuvwxyz"
	assigneeID := "cdefghijklmnopqrstuvwxyzab"
	client := &fakeAPIClient{
		playbook: map[string]any{
			"id":                   playbookID,
			"invited_user_ids":     []any{assigneeID},
			"invite_users_enabled": false,
			"checklists": []any{
				map[string]any{
					"title":                  "Triage",
					"custom_checklist_field": "preserve checklist field",
				},
			},
		},
	}

	_, err := toolAddPlaybookTask(context.Background(), client, AddPlaybookTaskArgs{
		PlaybookID:      playbookID,
		ChecklistNumber: 0,
		Title:           "Verify remediation",
		AssigneeID:      assigneeID,
	})
	require.NoError(t, err)

	body := requirePlaybookPutBody(t, client)
	assert.Equal(t, true, body["invite_users_enabled"])
	assert.Equal(t, []any{assigneeID}, body["invited_user_ids"])
	checklist := requirePlaybookChecklist(t, body, 0)
	assert.Equal(t, "preserve checklist field", checklist["custom_checklist_field"])
	items := requirePlaybookItems(t, body, 0)
	require.Len(t, items, 1)
	assert.Equal(t, "Verify remediation", items[0].(map[string]any)["title"])
}

func TestToolAddPlaybookTaskWithoutAssigneeLeavesInvitesUnchanged(t *testing.T) {
	playbookID := "abcdefghijklmnopqrstuvwxyz"
	client := &fakeAPIClient{
		playbook: map[string]any{
			"id":                   playbookID,
			"invited_user_ids":     []any{},
			"invite_users_enabled": false,
			"checklists": []any{
				map[string]any{
					"title": "Triage",
					"items": []any{},
				},
			},
		},
	}

	_, err := toolAddPlaybookTask(context.Background(), client, AddPlaybookTaskArgs{
		PlaybookID:      playbookID,
		ChecklistNumber: 0,
		Title:           "Verify remediation",
	})
	require.NoError(t, err)

	body := requirePlaybookPutBody(t, client)
	assert.Equal(t, false, body["invite_users_enabled"])
	assert.Equal(t, []any{}, body["invited_user_ids"])
	items := requirePlaybookItems(t, body, 0)
	require.Len(t, items, 1)
	assert.NotContains(t, items[0].(map[string]any), "assignee_id")
}

func TestToolEditPlaybookTaskUpdatesProvidedFieldsOnly(t *testing.T) {
	playbookID := "abcdefghijklmnopqrstuvwxyz"
	assigneeID := "cdefghijklmnopqrstuvwxyzab"
	client := &fakeAPIClient{
		playbook: map[string]any{
			"id":                   playbookID,
			"title":                "Incident Response",
			"custom_field":         "preserve me",
			"invited_user_ids":     []any{},
			"invite_users_enabled": false,
			"checklists": []any{
				map[string]any{
					"title": "Triage",
					"items": []any{
						map[string]any{
							"id":           "task-id-1",
							"title":        "Old title",
							"description":  "Keep this description",
							"command":      "/keep",
							"due_date":     float64(5000),
							"condition_id": "condition-id",
						},
					},
				},
			},
		},
	}
	title := "  New title  "
	dueDate := int64(0)

	_, err := toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{
		PlaybookID:      playbookID,
		ChecklistNumber: 0,
		ItemNumber:      0,
		Title:           &title,
		AssigneeID:      &assigneeID,
		DueDate:         &dueDate,
	})
	require.NoError(t, err)
	require.Equal(t, "playbooks/"+playbookID, client.getEndpoint)
	require.Equal(t, "playbooks/"+playbookID, client.putEndpoint)

	body := requirePlaybookPutBody(t, client)
	assert.Equal(t, "preserve me", body["custom_field"])
	assert.Equal(t, true, body["invite_users_enabled"])
	assert.Contains(t, body["invited_user_ids"].([]any), assigneeID)

	items := requirePlaybookItems(t, body, 0)
	require.Len(t, items, 1)
	task := items[0].(map[string]any)
	assert.Equal(t, "task-id-1", task["id"])
	assert.Equal(t, "New title", task["title"])
	assert.Equal(t, assigneeID, task["assignee_id"])
	assert.Equal(t, int64(0), task["due_date"])
	assert.Equal(t, "Keep this description", task["description"])
	assert.Equal(t, "/keep", task["command"])
	assert.Equal(t, "condition-id", task["condition_id"])
}

func TestToolEditPlaybookTaskClearsProvidedFields(t *testing.T) {
	playbookID := "abcdefghijklmnopqrstuvwxyz"
	assigneeID := "cdefghijklmnopqrstuvwxyzab"
	client := &fakeAPIClient{
		playbook: map[string]any{
			"id":                   playbookID,
			"invited_user_ids":     []any{},
			"invite_users_enabled": false,
			"checklists": []any{
				map[string]any{
					"title": "Triage",
					"items": []any{
						map[string]any{
							"id":          "task-id-1",
							"title":       "Keep title",
							"description": "Clear this description",
							"command":     "/clear",
							"assignee_id": assigneeID,
							"due_date":    float64(5000),
						},
					},
				},
			},
		},
	}
	empty := ""
	dueDate := int64(0)

	_, err := toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{
		PlaybookID:      playbookID,
		ChecklistNumber: 0,
		ItemNumber:      0,
		Description:     &empty,
		Command:         &empty,
		AssigneeID:      &empty,
		DueDate:         &dueDate,
	})
	require.NoError(t, err)

	body := requirePlaybookPutBody(t, client)
	assert.Equal(t, false, body["invite_users_enabled"])
	assert.Equal(t, []any{}, body["invited_user_ids"])
	items := requirePlaybookItems(t, body, 0)
	require.Len(t, items, 1)
	task := items[0].(map[string]any)
	assert.Equal(t, "task-id-1", task["id"])
	assert.Equal(t, "Keep title", task["title"])
	assert.Equal(t, "", task["description"])
	assert.Equal(t, "", task["command"])
	assert.Equal(t, "", task["assignee_id"])
	assert.Equal(t, int64(0), task["due_date"])
}

func TestToolRemovePlaybookTaskGetsAndPutsMutatedPlaybook(t *testing.T) {
	playbookID := "abcdefghijklmnopqrstuvwxyz"
	client := &fakeAPIClient{
		playbook: map[string]any{
			"id":           playbookID,
			"title":        "Incident Response",
			"custom_field": "preserve me",
			"checklists": []any{
				map[string]any{
					"title": "Triage",
					"items": []any{
						map[string]any{"id": "task-id-1", "title": "Remove me"},
						map[string]any{"id": "task-id-2", "title": "Keep me", "custom_task_field": "preserve task field"},
					},
				},
			},
		},
	}

	_, err := toolRemovePlaybookTask(context.Background(), client, RemovePlaybookTaskArgs{
		PlaybookID:      playbookID,
		ChecklistNumber: 0,
		ItemNumber:      0,
	})
	require.NoError(t, err)
	require.Equal(t, "playbooks/"+playbookID, client.getEndpoint)
	require.Equal(t, "playbooks/"+playbookID, client.putEndpoint)

	body := requirePlaybookPutBody(t, client)
	assert.Equal(t, "preserve me", body["custom_field"])
	items := requirePlaybookItems(t, body, 0)
	require.Len(t, items, 1)
	remainingTask := items[0].(map[string]any)
	assert.Equal(t, "task-id-2", remainingTask["id"])
	assert.Equal(t, "Keep me", remainingTask["title"])
	assert.Equal(t, "preserve task field", remainingTask["custom_task_field"])
}

func TestToolPlaybookTaskValidationErrors(t *testing.T) {
	playbookID := "abcdefghijklmnopqrstuvwxyz"
	tests := []struct {
		name        string
		run         func(*fakeAPIClient) (string, error)
		want        string
		wantDetails []string
		wantGet     bool
		wantNoPut   bool
		playbook    map[string]any
	}{
		{
			name: "add invalid playbook ID",
			run: func(client *fakeAPIClient) (string, error) {
				return toolAddPlaybookTask(context.Background(), client, AddPlaybookTaskArgs{PlaybookID: "bad", ChecklistNumber: 0, Title: "New task"})
			},
			want:      "playbook_id must be a valid Mattermost ID",
			wantNoPut: true,
		},
		{
			name: "add blank title",
			run: func(client *fakeAPIClient) (string, error) {
				return toolAddPlaybookTask(context.Background(), client, AddPlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 0, Title: "   "})
			},
			want:      "title is required",
			wantNoPut: true,
		},
		{
			name: "add invalid assignee ID",
			run: func(client *fakeAPIClient) (string, error) {
				return toolAddPlaybookTask(context.Background(), client, AddPlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 0, Title: "New task", AssigneeID: "bad"})
			},
			want:      "assignee_id must be a valid Mattermost ID",
			wantNoPut: true,
		},
		{
			name: "edit blank title",
			run: func(client *fakeAPIClient) (string, error) {
				blank := "   "
				return toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 0, ItemNumber: 0, Title: &blank})
			},
			want:      "title is required",
			wantNoPut: true,
		},
		{
			name: "edit no fields",
			run: func(client *fakeAPIClient) (string, error) {
				return toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 0, ItemNumber: 0})
			},
			want:      "at least one field",
			wantNoPut: true,
		},
		{
			name: "edit invalid assignee ID",
			run: func(client *fakeAPIClient) (string, error) {
				assigneeID := "bad"
				return toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 0, ItemNumber: 0, AssigneeID: &assigneeID})
			},
			want:      "assignee_id must be a valid Mattermost ID",
			wantNoPut: true,
		},
		{
			name: "edit negative checklist index",
			run: func(client *fakeAPIClient) (string, error) {
				title := "New task"
				return toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: -1, ItemNumber: 0, Title: &title})
			},
			want:      "checklist_number must be a non-negative integer",
			wantNoPut: true,
		},
		{
			name: "edit negative item index",
			run: func(client *fakeAPIClient) (string, error) {
				title := "New task"
				return toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 0, ItemNumber: -1, Title: &title})
			},
			want:      "item_number must be a non-negative integer",
			wantNoPut: true,
		},
		{
			name: "remove negative item index",
			run: func(client *fakeAPIClient) (string, error) {
				return toolRemovePlaybookTask(context.Background(), client, RemovePlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 0, ItemNumber: -1})
			},
			want:      "item_number must be a non-negative integer",
			wantNoPut: true,
		},
		{
			name: "add invalid checklist index",
			run: func(client *fakeAPIClient) (string, error) {
				return toolAddPlaybookTask(context.Background(), client, AddPlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 1, Title: "New task"})
			},
			want:        "checklist_number 1 is out of range",
			wantDetails: []string{"Available tasks:", "[0] Triage", "(no tasks)"},
			wantGet:     true,
			wantNoPut:   true,
			playbook:    playbookWithOneEmptyChecklist(playbookID),
		},
		{
			name: "edit invalid item index",
			run: func(client *fakeAPIClient) (string, error) {
				title := "New task"
				return toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 0, ItemNumber: 0, Title: &title})
			},
			want:        "item_number 0 is out of range",
			wantDetails: []string{"Available tasks:", "[0] Triage", "(no tasks)"},
			wantGet:     true,
			wantNoPut:   true,
			playbook:    playbookWithOneEmptyChecklist(playbookID),
		},
		{
			name: "remove invalid checklist index",
			run: func(client *fakeAPIClient) (string, error) {
				return toolRemovePlaybookTask(context.Background(), client, RemovePlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 1, ItemNumber: 0})
			},
			want:        "checklist_number 1 is out of range",
			wantDetails: []string{"Available tasks:", "[0] Triage", "(no tasks)"},
			wantGet:     true,
			wantNoPut:   true,
			playbook:    playbookWithOneEmptyChecklist(playbookID),
		},
		{
			name: "remove invalid item index",
			run: func(client *fakeAPIClient) (string, error) {
				return toolRemovePlaybookTask(context.Background(), client, RemovePlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 0, ItemNumber: 0})
			},
			want:        "item_number 0 is out of range",
			wantDetails: []string{"Available tasks:", "[0] Triage", "(no tasks)"},
			wantGet:     true,
			wantNoPut:   true,
			playbook:    playbookWithOneEmptyChecklist(playbookID),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{playbook: tt.playbook}
			_, err := tt.run(client)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.want)
			for _, detail := range tt.wantDetails {
				assert.Contains(t, err.Error(), detail)
			}
			if tt.wantGet {
				assert.Equal(t, "playbooks/"+playbookID, client.getEndpoint)
			} else {
				assert.Empty(t, client.getEndpoint)
			}
			if tt.wantNoPut {
				assert.Empty(t, client.putEndpoint)
			}
		})
	}
}

func TestPlaybookTaskOutOfRangeErrorsListAvailableTaskIndexes(t *testing.T) {
	playbookID := "abcdefghijklmnopqrstuvwxyz"
	client := &fakeAPIClient{
		playbook: map[string]any{
			"id":    playbookID,
			"title": "Incident Response",
			"checklists": []any{
				map[string]any{
					"title": "Triage",
					"items": []any{
						map[string]any{"title": "Confirm customer impact"},
					},
				},
				map[string]any{
					"title": "Follow-up",
					"items": []any{
						map[string]any{"title": "Schedule retrospective"},
					},
				},
			},
		},
	}
	title := "Updated task"

	_, err := toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{
		PlaybookID:      playbookID,
		ChecklistNumber: 0,
		ItemNumber:      5,
		Title:           &title,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "item_number 5 is out of range")
	assert.Contains(t, err.Error(), "**Incident Response** (playbook_id: abcdefghijklmnopqrstuvwxyz)")
	assert.Contains(t, err.Error(), "[0][0] Confirm customer impact")
	assert.Contains(t, err.Error(), "[1][0] Schedule retrospective")
	assert.Empty(t, client.putEndpoint)
}

func playbookWithOneEmptyChecklist(playbookID string) map[string]any {
	return map[string]any{
		"id":    playbookID,
		"title": "Incident Response",
		"checklists": []any{
			map[string]any{
				"title": "Triage",
				"items": []any{},
			},
		},
	}
}

func requirePlaybookPutBody(t *testing.T, client *fakeAPIClient) map[string]any {
	t.Helper()
	body, ok := client.putBody.(map[string]any)
	require.Truef(t, ok, "unexpected put body type %T", client.putBody)
	return body
}

func requirePlaybookChecklist(t *testing.T, playbook map[string]any, checklistNumber int) map[string]any {
	t.Helper()
	checklists, ok := playbook["checklists"].([]any)
	require.Truef(t, ok, "unexpected checklists type %T", playbook["checklists"])
	require.Greater(t, len(checklists), checklistNumber)
	checklist, ok := checklists[checklistNumber].(map[string]any)
	require.Truef(t, ok, "unexpected checklist type %T", checklists[checklistNumber])
	return checklist
}

func requirePlaybookItems(t *testing.T, playbook map[string]any, checklistNumber int) []any {
	t.Helper()
	checklist := requirePlaybookChecklist(t, playbook, checklistNumber)
	items, ok := checklist["items"].([]any)
	require.Truef(t, ok, "unexpected items type %T", checklist["items"])
	return items
}
