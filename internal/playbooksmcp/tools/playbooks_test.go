// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
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
		{"invalid team", CreatePlaybookArgs{Title: "x", TeamID: "bad"}, "team_id must be exactly 26 characters"},
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
