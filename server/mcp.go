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
	"github.com/mattermost/mattermost-plugin-playbooks/internal/playbooksmcp/tools"
	"github.com/sirupsen/logrus"
)

const (
	playbooksMCPEndpoint       = "/mcp/playbooks"
	playbooksPluginHTTPAPIBase = "/playbooks/api/v0/"
)

type pluginMCPClient struct {
	api    mcphelper.PluginAPI
	userID string
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

func (c *pluginMCPClient) Delete(ctx context.Context, endpoint string) error {
	return c.do(ctx, http.MethodDelete, endpoint, nil, nil)
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
	req, err := http.NewRequestWithContext(ctx, method, playbooksPluginHTTPAPIBase+strings.TrimLeft(endpoint, "/"), r)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Mattermost-User-ID", c.userID)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp := c.api.PluginHTTP(req)
	if resp == nil {
		return fmt.Errorf("PluginHTTP returned nil response")
	}
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

func (p *Plugin) ensureMCPServer() error {
	if p.mcpServer != nil {
		return nil
	}

	server := mcphelper.NewServer(p.API, mcphelper.PluginMCPServer{
		PluginID: manifest.Id,
		Name:     "Playbooks MCP",
		Path:     playbooksMCPEndpoint,
		Version:  manifest.Version,
	})
	factory := func(ctx context.Context) (tools.APIClient, error) {
		userID := mcphelper.GetUserID(ctx)
		if userID == "" {
			return nil, fmt.Errorf("missing Mattermost user ID")
		}
		return &pluginMCPClient{api: p.API, userID: userID}, nil
	}
	tools.NewPlaybooksToolProvider(factory).ProvideMCPHelperTools(server)
	p.mcpServer = server
	return nil
}

func (p *Plugin) registerMCPServerBestEffort() {
	if p.mcpServer == nil {
		return
	}
	if err := p.mcpServer.Register(); err != nil {
		logrus.WithError(err).Warn("failed to register Playbooks MCP server with Agents")
	}
}

func (p *Plugin) unregisterMCPServerBestEffort() {
	if p.mcpServer == nil {
		return
	}
	if err := p.mcpServer.Unregister(); err != nil {
		logrus.WithError(err).Warn("failed to unregister Playbooks MCP server with Agents")
	}
}

func (p *Plugin) serveMCPIfMatch(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path != playbooksMCPEndpoint && !strings.HasPrefix(r.URL.Path, playbooksMCPEndpoint+"/") {
		return false
	}
	if p.mcpServer == nil {
		http.Error(w, "MCP server unavailable", http.StatusServiceUnavailable)
		return true
	}
	p.mcpServer.ServeHTTP(w, r)
	return true
}
