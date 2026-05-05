package tools

import (
	"context"
	"net/url"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// APIClient is the interface the tool provider needs from the Playbooks HTTP client.
type APIClient interface {
	Get(ctx context.Context, endpoint string, params url.Values, result any) error
	Post(ctx context.Context, endpoint string, body any, result any) error
	Put(ctx context.Context, endpoint string, body any, result any) error
	Delete(ctx context.Context, endpoint string) error
}

// ClientFactory creates an APIClient for the current request context.
// For STDIO transport, this returns the same static client every time.
// For in-memory transport, this resolves the user's session token from context.
type ClientFactory func(ctx context.Context) (APIClient, error)

// PlaybooksToolProvider manages and registers all Playbooks MCP tools.
type PlaybooksToolProvider struct {
	clientFactory ClientFactory
}

// NewPlaybooksToolProvider creates a new tool provider.
func NewPlaybooksToolProvider(clientFactory ClientFactory) *PlaybooksToolProvider {
	return &PlaybooksToolProvider{clientFactory: clientFactory}
}

// ProvideTools registers all available tools with the MCP server.
func (p *PlaybooksToolProvider) ProvideTools(mcpServer *mcp.Server) {
	p.addRunTools(mcpServer)
	p.addChecklistTools(mcpServer)
}

// addTool registers a typed tool using the generic mcp.AddTool API.
// The SDK infers the input schema from In, validates input, and wraps
// errors as IsError tool results automatically.
func addTool[In any](server *mcp.Server, factory ClientFactory, name, description string, handler func(context.Context, APIClient, In) (string, error)) {
	tool := &mcp.Tool{Name: name, Description: description}
	mcp.AddTool(server, tool, func(ctx context.Context, _ *mcp.CallToolRequest, input In) (*mcp.CallToolResult, any, error) {
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
	})
}
