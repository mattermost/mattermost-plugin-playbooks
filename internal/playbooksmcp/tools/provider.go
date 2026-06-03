// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"fmt"
	"net/url"

	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// APIClient is the interface the tool provider needs from the Playbooks HTTP client.
type APIClient interface {
	Get(ctx context.Context, endpoint string, params url.Values, result any) error
	Post(ctx context.Context, endpoint string, body any, result any) error
	Put(ctx context.Context, endpoint string, body any, result any) error
	Delete(ctx context.Context, endpoint string) error
	GetCurrentUserID(ctx context.Context) (string, error)
	GetPlaybookURL(playbookID string) string
}

// ClientFactory creates an APIClient for the current MCP request context.
type ClientFactory func(ctx context.Context) (APIClient, error)

// PlaybooksToolProvider manages and registers all Playbooks MCP tools.
type PlaybooksToolProvider struct {
	clientFactory ClientFactory
}

// NewPlaybooksToolProvider creates a new tool provider.
func NewPlaybooksToolProvider(clientFactory ClientFactory) (*PlaybooksToolProvider, error) {
	if clientFactory == nil {
		return nil, fmt.Errorf("clientFactory cannot be nil")
	}
	return &PlaybooksToolProvider{clientFactory: clientFactory}, nil
}

// ProvideMCPHelperTools registers all available tools with the Agents MCP helper server.
func (p *PlaybooksToolProvider) ProvideMCPHelperTools(mcpServer *mcphelper.Server) {
	p.addMCPHelperRunTools(mcpServer)
	p.addMCPHelperChecklistTools(mcpServer)
	p.addMCPHelperPlaybookTools(mcpServer)
}

func addMCPHelperTool[In any](server *mcphelper.Server, factory ClientFactory, name, description string, handler func(context.Context, APIClient, In) (string, error)) {
	tool := &mcp.Tool{Name: name, Description: description}
	mcphelper.AddTool(server, tool, makeToolHandler(factory, handler))
}

func makeToolHandler[In any](factory ClientFactory, handler func(context.Context, APIClient, In) (string, error)) func(context.Context, *mcp.CallToolRequest, In) (*mcp.CallToolResult, any, error) {
	return func(ctx context.Context, _ *mcp.CallToolRequest, input In) (*mcp.CallToolResult, any, error) {
		client, err := factory(ctx)
		if err != nil {
			return nil, nil, err
		}
		result, err := handler(ctx, client, input)
		if err != nil {
			return nil, nil, err
		}
		return &mcp.CallToolResult{
			Content: []mcp.Content{&mcp.TextContent{Text: result}},
		}, nil, nil
	}
}
