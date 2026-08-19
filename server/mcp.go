// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/internal/playbooksmcp/tools"
	"github.com/mattermost/mattermost-plugin-playbooks/server/api"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/sirupsen/logrus"
)

const (
	playbooksMCPEndpoint  = "/mcp/playbooks"
	playbooksLocalAPIBase = "/api/v0/"
)

// usernameResolver looks a username up and returns its user ID. It is passed
// in rather than reached for through the Plugin struct so newPlaybooksMCPServer
// stays constructible in tests.
type usernameResolver func(ctx context.Context, username string) (string, error)

type pluginMCPClient struct {
	handler         http.Handler
	userID          string
	siteURL         string
	resolveUsername usernameResolver
}

type pluginMCPRegistrationAPI struct {
	api      mcphelper.PluginAPI
	pluginID string
}

type pluginMCPResponseRecorder struct {
	header     http.Header
	body       bytes.Buffer
	statusCode int
}

func newPluginMCPResponseRecorder() *pluginMCPResponseRecorder {
	return &pluginMCPResponseRecorder{
		header:     make(http.Header),
		statusCode: http.StatusOK,
	}
}

func (r *pluginMCPResponseRecorder) Header() http.Header {
	return r.header
}

func (r *pluginMCPResponseRecorder) Write(data []byte) (int, error) {
	return r.body.Write(data)
}

func (r *pluginMCPResponseRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
}

func (r *pluginMCPResponseRecorder) Result() *http.Response {
	return &http.Response{
		StatusCode: r.statusCode,
		Header:     r.header.Clone(),
		Body:       io.NopCloser(bytes.NewReader(r.body.Bytes())),
	}
}

func (a *pluginMCPRegistrationAPI) PluginHTTP(req *http.Request) *http.Response {
	if req.Header == nil {
		req.Header = make(http.Header)
	}
	if req.Header.Get("Mattermost-Plugin-ID") == "" {
		req.Header.Set("Mattermost-Plugin-ID", a.pluginID)
	}
	return a.api.PluginHTTP(req)
}

func newPluginMCPRegistrationAPI(api mcphelper.PluginAPI, pluginID string) mcphelper.PluginAPI {
	if api == nil {
		return nil
	}
	return &pluginMCPRegistrationAPI{api: api, pluginID: pluginID}
}

func (c *pluginMCPClient) Get(ctx context.Context, endpoint string, params url.Values, result any) error {
	if len(params) > 0 {
		endpoint += "?" + params.Encode()
	}
	return c.do(ctx, http.MethodGet, endpoint, nil, result)
}

func (c *pluginMCPClient) Post(ctx context.Context, endpoint string, body any, result any) error {
	return c.do(ctx, http.MethodPost, endpoint, body, result)
}

func (c *pluginMCPClient) Put(ctx context.Context, endpoint string, body any, result any) error {
	return c.do(ctx, http.MethodPut, endpoint, body, result)
}

func (c *pluginMCPClient) Patch(ctx context.Context, endpoint string, body any, result any) error {
	return c.do(ctx, http.MethodPatch, endpoint, body, result)
}

func (c *pluginMCPClient) Delete(ctx context.Context, endpoint string) error {
	return c.do(ctx, http.MethodDelete, endpoint, nil, nil)
}

func (c *pluginMCPClient) GetCurrentUserID(context.Context) (string, error) {
	if c.userID == "" {
		return "", fmt.Errorf("missing Mattermost user ID")
	}
	return c.userID, nil
}

// ResolveUserID accepts any of the three forms a model realistically produces
// for a person: "me", a raw user ID, or a username (with or without the "@"
// Mattermost renders). Only the last needs a lookup, so the short-circuits live
// here — every APIClient implementation then agrees on the semantics and only
// has to supply the username lookup itself.
func (c *pluginMCPClient) ResolveUserID(ctx context.Context, userRef string) (string, error) {
	ref := strings.TrimSpace(userRef)
	if ref == "" {
		return "", fmt.Errorf("a user reference is required: pass a user ID, %q, or a username such as \"@bob\"", client.Me)
	}
	if ref == client.Me {
		return c.GetCurrentUserID(ctx)
	}
	if model.IsValidId(ref) {
		return ref, nil
	}

	// Mattermost usernames are stored lowercase, so folding the case here is
	// what makes the "case-insensitive" promise in the error below true.
	username := strings.ToLower(strings.TrimPrefix(ref, "@"))
	if username == "" {
		return "", fmt.Errorf("%q is not a valid user reference: pass a user ID, %q, or a username such as \"@bob\"", userRef, client.Me)
	}
	if c.resolveUsername == nil {
		return "", fmt.Errorf("user lookup unavailable: cannot resolve username %q to a user ID; pass the 26-character user ID instead", username)
	}
	userID, err := c.resolveUsername(ctx, username)
	if err != nil {
		return "", fmt.Errorf("no user found with username %q — check the spelling (usernames are case-insensitive, without the @). Underlying error: %w", username, err)
	}
	if userID == "" {
		return "", fmt.Errorf("no user found with username %q — check the spelling (usernames are case-insensitive, without the @)", username)
	}
	return userID, nil
}

func (c *pluginMCPClient) GetPlaybookURL(playbookID string) string {
	return strings.TrimRight(c.siteURL, "/") + "/playbooks/playbooks/" + playbookID
}

// GetRunURL mirrors app.GetRunDetailsRelativeURL ("/playbooks/runs/{id}"), the
// route the webapp serves the run overview from.
func (c *pluginMCPClient) GetRunURL(runID string) string {
	return strings.TrimRight(c.siteURL, "/") + "/playbooks/runs/" + runID
}

func (c *pluginMCPClient) do(ctx context.Context, method, endpoint string, body any, result any) error {
	var r io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		r = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, playbooksLocalAPIBase+strings.TrimLeft(endpoint, "/"), r)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Mattermost-User-ID", c.userID)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.handler == nil {
		return fmt.Errorf("playbooks HTTP handler is nil")
	}
	recorder := newPluginMCPResponseRecorder()
	c.handler.ServeHTTP(recorder, req)
	resp := recorder.Result()
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
		if err != nil {
			return fmt.Errorf("API error (status %d); failed to read response body: %w", resp.StatusCode, err)
		}
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(data))
	}
	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
		return nil
	}
	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("failed to drain response body: %w", err)
	}
	return nil
}

func newPlaybooksMCPServer(api mcphelper.PluginAPI, handler http.Handler, exposeExternal bool, siteURL string, resolveUsername usernameResolver) (*mcphelper.Server, error) {
	server := mcphelper.NewServer(newPluginMCPRegistrationAPI(api, manifest.Id), mcphelper.PluginMCPServer{
		PluginID:       manifest.Id,
		Name:           "Playbooks MCP",
		Path:           playbooksMCPEndpoint,
		ExposeExternal: exposeExternal,
		Version:        manifest.Version,
	})
	factory := func(ctx context.Context) (tools.APIClient, error) {
		userID := mcphelper.GetUserID(ctx)
		if userID == "" {
			return nil, fmt.Errorf("missing Mattermost user ID")
		}
		return &pluginMCPClient{handler: handler, userID: userID, siteURL: siteURL, resolveUsername: resolveUsername}, nil
	}
	provider, err := tools.NewPlaybooksToolProvider(factory)
	if err != nil {
		return nil, fmt.Errorf("failed to create tool provider: %w", err)
	}
	provider.ProvideMCPHelperTools(server)
	return server, nil
}

func (p *Plugin) ensureMCPServer() error {
	exposeExternal := p.currentMCPExposeExternal()

	p.mcpMu.RLock()
	if p.mcpServer != nil && p.mcpExposeExternal == exposeExternal {
		p.mcpMu.RUnlock()
		return nil
	}
	p.mcpMu.RUnlock()

	server, err := newPlaybooksMCPServer(p.API, p.handler, exposeExternal, p.currentSiteURL(), p.usernameResolver())
	if err != nil {
		return err
	}

	p.mcpMu.Lock()
	oldServer := p.mcpServer
	if oldServer != nil && p.mcpExposeExternal == exposeExternal {
		p.mcpMu.Unlock()
		return nil
	}
	p.mcpServer = server
	p.mcpExposeExternal = exposeExternal
	p.mcpMu.Unlock()

	if oldServer != nil {
		if err := oldServer.Unregister(); err != nil {
			logrus.WithError(err).Warn("failed to unregister replaced Playbooks MCP server with Agents")
		}
	}
	return nil
}

// usernameResolver returns nil when the plugin API is not available yet, which
// pluginMCPClient.ResolveUserID reports as "user lookup unavailable" rather
// than panicking mid-request.
func (p *Plugin) usernameResolver() usernameResolver {
	pluginAPI := p.pluginAPI
	if pluginAPI == nil {
		return nil
	}
	return func(_ context.Context, username string) (string, error) {
		user, err := pluginAPI.User.GetByUsername(username)
		if err != nil {
			return "", err
		}
		return user.Id, nil
	}
}

func (p *Plugin) currentMCPExposeExternal() bool {
	if p.config == nil {
		return false
	}
	return p.config.GetConfiguration().ExposeMCPExternal
}

func (p *Plugin) currentSiteURL() string {
	if p.pluginAPI == nil {
		return ""
	}
	cfg := p.pluginAPI.Configuration.GetConfig()
	if cfg == nil || cfg.ServiceSettings.SiteURL == nil {
		return ""
	}
	return *cfg.ServiceSettings.SiteURL
}

func (p *Plugin) getMCPServer() *mcphelper.Server {
	p.mcpMu.RLock()
	defer p.mcpMu.RUnlock()
	return p.mcpServer
}

func (p *Plugin) clearMCPServer() {
	p.mcpMu.Lock()
	server := p.mcpServer
	p.mcpServer = nil
	p.mcpExposeExternal = false
	p.mcpMu.Unlock()

	if server == nil {
		return
	}
	if err := server.Unregister(); err != nil {
		logrus.WithError(err).Warn("failed to unregister Playbooks MCP server with Agents")
	}
}

func (p *Plugin) registerMCPServerBestEffort() {
	server := p.getMCPServer()
	if server == nil {
		return
	}
	if err := server.Register(); err != nil {
		logrus.WithError(err).Warn("failed to register Playbooks MCP server with Agents")
	}
}

func (p *Plugin) unregisterMCPServerBestEffort() {
	server := p.getMCPServer()
	if server == nil {
		return
	}
	if err := server.Unregister(); err != nil {
		logrus.WithError(err).Warn("failed to unregister Playbooks MCP server with Agents")
	}
}

func (p *Plugin) isMCPEnabled() bool {
	if p.config == nil {
		return p.getMCPServer() != nil
	}
	return p.config.IsExperimentalFeaturesEnabled()
}

func (p *Plugin) serveMCPIfMatch(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path != playbooksMCPEndpoint && !strings.HasPrefix(r.URL.Path, playbooksMCPEndpoint+"/") {
		return false
	}

	handler := api.LogRequest(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !p.isMCPEnabled() {
			http.NotFound(w, r)
			return
		}

		p.mcpMu.RLock()
		srv := p.mcpServer
		p.mcpMu.RUnlock()
		if srv == nil {
			http.Error(w, "MCP server unavailable", http.StatusServiceUnavailable)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, api.MaxRequestSize)
		srv.ServeHTTP(w, r)
	}))
	handler.ServeHTTP(w, r)
	return true
}
