// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost-plugin-agents/public/bridgeclient"
	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
	"github.com/modelcontextprotocol/go-sdk/mcp"
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

func TestProvideMCPHelperToolsRegistersChecklistAssigneeTool(t *testing.T) {
	ctx := context.Background()

	provider, err := NewPlaybooksToolProvider(func(context.Context) (APIClient, error) {
		return &fakeAPIClient{}, nil
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

	client := mcp.NewClient(&mcp.Implementation{Name: "playbooks-test-client", Version: "0.0.1"}, nil)
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{Endpoint: ts.URL}, nil)
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

	for _, tool := range tools.Tools {
		if tool.Name == "playbooks__set_checklist_item_assignee" {
			return
		}
	}
	t.Fatalf("expected set_checklist_item_assignee to be registered, got tools %#v", tools.Tools)
}
