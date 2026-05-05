package mcpserver

import (
	"github.com/mattermost/mattermost-plugin-playbooks/mcpserver/tools"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// PlaybooksMCPServer is the core MCP server for Playbooks.
type PlaybooksMCPServer struct {
	mcpServer     *mcp.Server
	clientFactory tools.ClientFactory
}

// registerTools registers all Playbooks tools with the MCP server.
func (s *PlaybooksMCPServer) registerTools() {
	provider := tools.NewPlaybooksToolProvider(s.clientFactory)
	provider.ProvideTools(s.mcpServer)
}
