package mcpserver

import playbooksmcp "github.com/mattermost/mattermost-plugin-playbooks/internal/playbooksmcp"

// Version is the version of the MCP server, used by both transports.
const Version = playbooksmcp.Version

// StdioConfig represents configuration for the STDIO transport MCP server.
type StdioConfig = playbooksmcp.StdioConfig

// InMemoryConfig represents configuration for the in-memory transport MCP server.
type InMemoryConfig = playbooksmcp.InMemoryConfig
