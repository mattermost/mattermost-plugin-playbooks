package mcpserver

import (
	"context"
	"fmt"
	"log"

	"github.com/mattermost/mattermost-plugin-playbooks/mcpserver/tools"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// StdioServer wraps PlaybooksMCPServer for STDIO transport.
type StdioServer struct {
	*PlaybooksMCPServer
}

// NewStdioServer creates a new STDIO transport MCP server.
func NewStdioServer(config StdioConfig) (*StdioServer, error) {
	if config.MMServerURL == "" {
		return nil, fmt.Errorf("server URL cannot be empty")
	}
	if config.PersonalAccessToken == "" {
		return nil, fmt.Errorf("personal access token cannot be empty")
	}

	client := NewPlaybooksClient(config.MMServerURL, config.PersonalAccessToken)

	// Validate token at startup.
	if err := client.ValidateToken(context.Background()); err != nil {
		return nil, fmt.Errorf("startup token validation failed: %w", err)
	}

	// For STDIO, the client is static — same token for every request.
	clientFactory := func(_ context.Context) (tools.APIClient, error) {
		return client, nil
	}

	mcpServer := mcp.NewServer(
		&mcp.Implementation{
			Name:    "mattermost-playbooks-mcp-server",
			Version: Version,
		},
		&mcp.ServerOptions{},
	)

	s := &StdioServer{
		PlaybooksMCPServer: &PlaybooksMCPServer{
			mcpServer:     mcpServer,
			clientFactory: clientFactory,
		},
	}

	s.registerTools()

	return s, nil
}

// Serve starts the STDIO MCP server.
func (s *StdioServer) Serve() error {
	log.Println("Starting Playbooks MCP server with STDIO transport")

	transport := &mcp.StdioTransport{}
	err := s.mcpServer.Run(context.Background(), transport)
	if err != nil {
		log.Printf("MCP server stopped with error: %v", err)
	}
	return err
}
