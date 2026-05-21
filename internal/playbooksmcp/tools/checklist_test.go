// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"fmt"
	"net/url"
	"testing"
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
}

func (f *fakeAPIClient) Get(_ context.Context, endpoint string, params url.Values, result any) error {
	f.getEndpoint = endpoint
	f.getParams = params
	switch v := result.(type) {
	case *playbookRunDetail:
		*v = f.run
	case *listRunsResponse:
		*v = f.listRuns
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
	return nil
}

func (f *fakeAPIClient) Put(_ context.Context, endpoint string, body any, _ any) error {
	f.putEndpoint = endpoint
	f.putBody = body
	return nil
}

func (f *fakeAPIClient) Delete(context.Context, string) error {
	return fmt.Errorf("unexpected Delete call")
}

func (f *fakeAPIClient) GetCurrentUserID(context.Context) (string, error) {
	return "current-user-id", nil
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
	newTitle := "new title"
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
	if got := body["owner_user_id"]; got != "current-user-id" {
		t.Errorf("expected current user as owner, got %q", got)
	}
	if got := body["name"]; got != "Release checklist" {
		t.Errorf("expected trimmed name, got %q", got)
	}
	if got := body["playbook_id"]; got != "" {
		t.Errorf("expected empty playbook_id, got %q", got)
	}
}
