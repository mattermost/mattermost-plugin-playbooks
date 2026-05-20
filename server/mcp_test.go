package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost-plugin-agents/public/bridgeclient"
	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPluginMCPClientUsesLocalAPIPath(t *testing.T) {
	var capturedReq *http.Request
	client := &pluginMCPClient{
		userID: "user-id",
		handler: http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			capturedReq = req
			_, _ = w.Write([]byte(`{"ok": true}`))
		}),
	}

	var result map[string]bool
	err := client.Get(context.Background(), "runs", url.Values{"per_page": {"10"}}, &result)
	require.NoError(t, err)
	require.NotNil(t, capturedReq)

	assert.Equal(t, http.MethodGet, capturedReq.Method)
	assert.Equal(t, "/api/v0/runs", capturedReq.URL.Path)
	assert.Equal(t, "per_page=10", capturedReq.URL.RawQuery)
	assert.Equal(t, "user-id", capturedReq.Header.Get("Mattermost-User-ID"))
	assert.Equal(t, map[string]bool{"ok": true}, result)
}

func TestPluginMCPClientSendsJSONBody(t *testing.T) {
	var capturedReq *http.Request
	var capturedBody string
	client := &pluginMCPClient{
		userID: "user-id",
		handler: http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			capturedReq = req
			data, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			capturedBody = string(data)
			w.WriteHeader(http.StatusNoContent)
		}),
	}

	err := client.Post(context.Background(), "runs/run-id/status", map[string]string{"message": "done"}, nil)
	require.NoError(t, err)
	require.NotNil(t, capturedReq)

	assert.Equal(t, http.MethodPost, capturedReq.Method)
	assert.Equal(t, "/api/v0/runs/run-id/status", capturedReq.URL.Path)
	assert.Equal(t, "application/json", capturedReq.Header.Get("Content-Type"))
	assert.JSONEq(t, `{"message":"done"}`, capturedBody)
}

func TestPluginMCPClientReturnsAPIErrorBody(t *testing.T) {
	client := &pluginMCPClient{
		userID: "user-id",
		handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "boom", http.StatusInternalServerError)
		}),
	}

	err := client.Delete(context.Background(), "runs/run-id")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "API error (status 500): boom")
}

type testEchoIn struct {
	Message string `json:"message"`
}

type testEchoOut struct {
	Echoed string `json:"echoed"`
}

type capturePluginAPI struct {
	requestCh chan *http.Request
	bodyCh    chan []byte
}

func (a *capturePluginAPI) PluginHTTP(req *http.Request) *http.Response {
	data, _ := io.ReadAll(req.Body)
	a.requestCh <- req
	a.bodyCh <- data
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader("{}")),
	}
}

func TestNewPlaybooksMCPServerRegistersExposeExternal(t *testing.T) {
	api := &capturePluginAPI{
		requestCh: make(chan *http.Request, 1),
		bodyCh:    make(chan []byte, 1),
	}
	server := newPlaybooksMCPServer(api, http.NotFoundHandler(), true)

	require.NoError(t, server.Register())

	var req *http.Request
	var body []byte
	select {
	case req = <-api.requestCh:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for MCP registration request")
	}
	select {
	case body = <-api.bodyCh:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for MCP registration body")
	}

	assert.Equal(t, http.MethodPost, req.Method)
	assert.Equal(t, "/"+bridgeclient.AiPluginID+"/bridge/v1/mcp/register", req.URL.Path)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(body, &payload))
	assert.Equal(t, manifest.Id, payload["plugin_id"])
	assert.Equal(t, playbooksMCPEndpoint, payload["path"])
	assert.Equal(t, true, payload["expose_external"])
}

func TestConfigurationClonesExposeMCPExternal(t *testing.T) {
	cfg := &config.Configuration{ExposeMCPExternal: true}
	cloned := cfg.Clone()
	assert.True(t, cloned.ExposeMCPExternal)
}

func TestServeMCPIfMatchServesToolCall(t *testing.T) {
	ctx := context.Background()

	var capturedUserID string
	var mu sync.Mutex

	helperServer := mcphelper.NewServer(nil, mcphelper.PluginMCPServer{
		PluginID: manifest.Id,
		Name:     "Playbooks MCP",
		Path:     playbooksMCPEndpoint,
		Version:  manifest.Version,
	})
	mcphelper.AddTool[testEchoIn, testEchoOut](helperServer, &mcp.Tool{
		Name:        "echo",
		Description: "echoes input",
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in testEchoIn) (*mcp.CallToolResult, testEchoOut, error) {
		mu.Lock()
		capturedUserID = mcphelper.GetUserID(ctx)
		mu.Unlock()
		return &mcp.CallToolResult{}, testEchoOut{Echoed: in.Message}, nil
	})

	p := &Plugin{mcpServer: helperServer}
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Header.Set("Mattermost-Plugin-ID", bridgeclient.AiPluginID)
		r.Header.Set("X-Mattermost-UserID", "user-id")
		if !p.serveMCPIfMatch(w, r) {
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(ts.Close)

	client := mcp.NewClient(&mcp.Implementation{Name: "playbooks-test-client", Version: "0.0.1"}, nil)
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{Endpoint: ts.URL + playbooksMCPEndpoint}, nil)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = session.Close()
	})

	_, err = session.CallTool(ctx, &mcp.CallToolParams{
		Name:      "playbooks__echo",
		Arguments: map[string]any{"message": "hello"},
	})
	require.NoError(t, err)

	mu.Lock()
	defer mu.Unlock()
	assert.Equal(t, "user-id", capturedUserID)
}
