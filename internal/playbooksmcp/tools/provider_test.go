// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-plugin-agents/public/bridgeclient"
	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewPlaybooksToolProviderRejectsNilClientFactory(t *testing.T) {
	provider, err := NewPlaybooksToolProvider(nil)
	if err == nil || err.Error() != "clientFactory cannot be nil" {
		t.Fatalf("expected client factory validation error, got provider=%v err=%v", provider, err)
	}
	if provider != nil {
		t.Fatalf("expected nil provider, got %v", provider)
	}
}

// registerToolsForTest wires the provider into a real mcphelper server backed by
// the given fake, and returns the tools the MCP client can see.
func registerToolsForTest(t *testing.T, fakeClient APIClient) []*mcp.Tool {
	t.Helper()
	ctx := context.Background()

	provider, err := NewPlaybooksToolProvider(func(context.Context) (APIClient, error) {
		return fakeClient, nil
	})
	require.NoError(t, err)

	helperServer := mcphelper.NewServer(nil, mcphelper.PluginMCPServer{
		PluginID: "playbooks",
		Name:     "Playbooks MCP",
		Path:     "/mcp",
		Version:  "0.0.1",
	})
	provider.ProvideMCPHelperTools(helperServer)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Header.Set("Mattermost-Plugin-ID", bridgeclient.AiPluginID)
		r.Header.Set("X-Mattermost-UserID", "user-id")
		helperServer.ServeHTTP(w, r)
	}))
	t.Cleanup(ts.Close)

	mcpClient := mcp.NewClient(&mcp.Implementation{Name: "playbooks-test-client", Version: "0.0.1"}, nil)
	session, err := mcpClient.Connect(ctx, &mcp.StreamableClientTransport{Endpoint: ts.URL}, nil)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = session.Close()
	})

	listed, err := session.ListTools(ctx, nil)
	require.NoError(t, err)
	return listed.Tools
}

// A tool that is implemented but never registered is invisible to the model and
// nothing else in the suite would catch it, since the unit tests call the
// handlers directly.
func TestEveryToolIsRegistered(t *testing.T) {
	registered := make(map[string]*mcp.Tool)
	for _, tool := range registerToolsForTest(t, &fakeAPIClient{}) {
		registered[tool.Name] = tool
	}

	want := []string{
		// runs
		"run_playbook", "list_runs", "create_checklist", "get_run", "get_run_metadata",
		"update_run", "update_run_status", "get_status_updates", "request_status_update",
		"finish_run", "restore_run", "change_run_owner",
		"add_run_participants", "remove_run_participant", "follow_run", "unfollow_run",
		// run checklists
		"check_item", "add_checklist_item", "set_checklist_item_due_date",
		"edit_checklist_item", "set_checklist_item_assignee", "remove_checklist_item",
		"move_checklist_item", "add_section", "rename_section", "remove_section",
		"skip_section", "restore_section", "move_section",
		// playbook templates
		"create_playbook", "list_playbooks", "get_playbook", "update_playbook",
		"archive_playbook", "restore_playbook", "duplicate_playbook",
		"create_playbook_attribute", "add_playbook_task", "edit_playbook_task",
		"remove_playbook_task", "add_playbook_section", "rename_playbook_section",
		"remove_playbook_section", "move_playbook_section",
		// discovery
		"resolve_channel_context", "find_checklist_item",
	}

	for _, name := range want {
		assert.Contains(t, registered, "playbooks__"+name)
	}
	assert.Len(t, registered, len(want), "a tool was registered without being listed here")
}

// Descriptions double as BM25 retrieval text under dynamic tool loading, so a
// thin or misleading one makes the tool unfindable rather than merely terse.
func TestToolDescriptionsFollowRetrievalConventions(t *testing.T) {
	for _, tool := range registerToolsForTest(t, &fakeAPIClient{}) {
		t.Run(tool.Name, func(t *testing.T) {
			description := tool.Description
			require.NotEmpty(t, description)

			assert.NotContains(t, description, "\n", "keep descriptions a single paragraph")
			assert.Contains(t, strings.ToLower(description), "playbook",
				"say whether the tool acts on a playbook run or a playbook template")
			assert.Contains(t, description, "Example: {",
				"include a concrete JSON example of the arguments")

			first, _, _ := strings.Cut(description, ". ")
			assert.NotContains(t, first, "This tool",
				"lead with what the tool does, not with boilerplate")
		})
	}
}

func TestProvideMCPHelperToolsRegistersChecklistAssigneeTool(t *testing.T) {
	ctx := context.Background()
	fakeClient := &fakeAPIClient{run: fixtureRun("abcdefghijklmnopqrstuvwxyz", 3, 3)}

	provider, err := NewPlaybooksToolProvider(func(context.Context) (APIClient, error) {
		return fakeClient, nil
	})
	if err != nil {
		t.Fatalf("NewPlaybooksToolProvider returned error: %v", err)
	}

	helperServer := mcphelper.NewServer(nil, mcphelper.PluginMCPServer{
		PluginID: "playbooks",
		Name:     "Playbooks MCP",
		Path:     "/mcp",
		Version:  "0.0.1",
	})
	provider.ProvideMCPHelperTools(helperServer)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Header.Set("Mattermost-Plugin-ID", bridgeclient.AiPluginID)
		r.Header.Set("X-Mattermost-UserID", "user-id")
		helperServer.ServeHTTP(w, r)
	}))
	t.Cleanup(ts.Close)

	mcpClient := mcp.NewClient(&mcp.Implementation{Name: "playbooks-test-client", Version: "0.0.1"}, nil)
	session, err := mcpClient.Connect(ctx, &mcp.StreamableClientTransport{Endpoint: ts.URL}, nil)
	if err != nil {
		t.Fatalf("client.Connect returned error: %v", err)
	}
	t.Cleanup(func() {
		_ = session.Close()
	})

	tools, err := session.ListTools(ctx, nil)
	if err != nil {
		t.Fatalf("ListTools returned error: %v", err)
	}

	registered := make(map[string]bool)
	for _, tool := range tools.Tools {
		registered[tool.Name] = true
	}
	for _, want := range []string{
		"playbooks__set_checklist_item_assignee",
		"playbooks__resolve_channel_context",
		"playbooks__find_checklist_item",
	} {
		if !registered[want] {
			t.Fatalf("expected %s to be registered, got tools %#v", want, tools.Tools)
		}
	}

	_, err = session.CallTool(ctx, &mcp.CallToolParams{
		Name: "playbooks__set_checklist_item_assignee",
		Arguments: map[string]any{
			"run_id":           "abcdefghijklmnopqrstuvwxyz",
			"checklist_number": 1,
			"item_number":      2,
			"assignee_id":      "bcdefghijklmnopqrstuvwxyza",
		},
	})
	if err != nil {
		t.Fatalf("CallTool returned error: %v", err)
	}

	if fakeClient.putEndpoint != "runs/abcdefghijklmnopqrstuvwxyz/checklists/1/item/2/assignee" {
		t.Fatalf("unexpected endpoint: %s", fakeClient.putEndpoint)
	}
	body, ok := fakeClient.putBody.(map[string]string)
	if !ok {
		t.Fatalf("unexpected body type %T", fakeClient.putBody)
	}
	if body["assignee_id"] != "bcdefghijklmnopqrstuvwxyza" {
		t.Fatalf("unexpected body: %#v", body)
	}
}
