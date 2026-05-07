package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-plugin-agents/public/bridgeclient"
	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakePluginAPI struct {
	fn func(*http.Request) *http.Response
}

func (f fakePluginAPI) PluginHTTP(req *http.Request) *http.Response {
	return f.fn(req)
}

func pluginHTTPResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     make(http.Header),
	}
}

func TestPluginMCPClientUsesPluginHTTPPath(t *testing.T) {
	var capturedReq *http.Request
	client := &pluginMCPClient{
		userID: "user-id",
		api: fakePluginAPI{fn: func(req *http.Request) *http.Response {
			capturedReq = req
			return pluginHTTPResponse(http.StatusOK, `{"ok": true}`)
		}},
	}

	var result map[string]bool
	err := client.Get(context.Background(), "runs", url.Values{"per_page": {"10"}}, &result)
	require.NoError(t, err)
	require.NotNil(t, capturedReq)

	assert.Equal(t, http.MethodGet, capturedReq.Method)
	assert.Equal(t, "/playbooks/api/v0/runs", capturedReq.URL.Path)
	assert.Equal(t, "per_page=10", capturedReq.URL.RawQuery)
	assert.Equal(t, "user-id", capturedReq.Header.Get("Mattermost-User-ID"))
	assert.Equal(t, map[string]bool{"ok": true}, result)
}

func TestPluginMCPClientSendsJSONBody(t *testing.T) {
	var capturedReq *http.Request
	var capturedBody string
	client := &pluginMCPClient{
		userID: "user-id",
		api: fakePluginAPI{fn: func(req *http.Request) *http.Response {
			capturedReq = req
			data, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			capturedBody = string(data)
			return pluginHTTPResponse(http.StatusNoContent, "")
		}},
	}

	err := client.Post(context.Background(), "runs/run-id/status", map[string]string{"message": "done"}, nil)
	require.NoError(t, err)
	require.NotNil(t, capturedReq)

	assert.Equal(t, http.MethodPost, capturedReq.Method)
	assert.Equal(t, "/playbooks/api/v0/runs/run-id/status", capturedReq.URL.Path)
	assert.Equal(t, "application/json", capturedReq.Header.Get("Content-Type"))
	assert.JSONEq(t, `{"message":"done"}`, capturedBody)
}

func TestPluginMCPClientReturnsResponseBodyReadError(t *testing.T) {
	readErr := errors.New("read failed")
	client := &pluginMCPClient{
		userID: "user-id",
		api: fakePluginAPI{fn: func(req *http.Request) *http.Response {
			return &http.Response{
				StatusCode: http.StatusInternalServerError,
				Body:       errorReadCloser{err: readErr},
				Header:     make(http.Header),
			}
		}},
	}

	err := client.Delete(context.Background(), "runs/run-id")
	require.Error(t, err)
	assert.ErrorIs(t, err, readErr)
	assert.Contains(t, err.Error(), "failed to read response body")
}

type errorReadCloser struct {
	err error
}

func (e errorReadCloser) Read(_ []byte) (int, error) {
	return 0, e.err
}

func (e errorReadCloser) Close() error {
	return nil
}

type testEchoIn struct {
	Message string `json:"message"`
}

type testEchoOut struct {
	Echoed string `json:"echoed"`
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
