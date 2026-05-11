package tools

import (
	"context"
	"fmt"
	"net/url"
	"testing"
)

type fakeAPIClient struct {
	run playbookRunDetail

	getEndpoint string
	putEndpoint string
	putBody     any
}

func (f *fakeAPIClient) Get(_ context.Context, endpoint string, _ url.Values, result any) error {
	f.getEndpoint = endpoint
	run, ok := result.(*playbookRunDetail)
	if !ok {
		return fmt.Errorf("unexpected get result type %T", result)
	}
	*run = f.run
	return nil
}

func (f *fakeAPIClient) Post(context.Context, string, any, any) error {
	return fmt.Errorf("unexpected Post call")
}

func (f *fakeAPIClient) Put(_ context.Context, endpoint string, body any, _ any) error {
	f.putEndpoint = endpoint
	f.putBody = body
	return nil
}

func (f *fakeAPIClient) Delete(context.Context, string) error {
	return fmt.Errorf("unexpected Delete call")
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
