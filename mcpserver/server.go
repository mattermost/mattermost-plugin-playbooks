package mcpserver

import (
	"fmt"

	"github.com/mattermost/mattermost-plugin-playbooks/internal/playbooksmcp/tools"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// PlaybooksMCPServer is the core MCP server for Playbooks.
type PlaybooksMCPServer struct {
	mcpServer     *mcp.Server
	clientFactory tools.ClientFactory
}

// registerTools registers all Playbooks tools with the MCP server.
func (s *PlaybooksMCPServer) registerTools() error {
	provider, err := tools.NewPlaybooksToolProvider(s.clientFactory)
	if err != nil {
		return fmt.Errorf("failed to create tool provider: %w", err)
	}
	provider.ProvideTools(s.mcpServer)
	return nil
}
