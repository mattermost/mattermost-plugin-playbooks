package playbooksmcp

// Version is the version of the MCP server, used by both transports.
const Version = "0.1.0"

// StdioConfig represents configuration for the STDIO transport MCP server.
type StdioConfig struct {
	// MMServerURL is the Mattermost server URL (e.g., "https://mattermost.example.com").
	MMServerURL string

	// PersonalAccessToken is the PAT used for authentication.
	PersonalAccessToken string
}

// InMemoryConfig represents configuration for the in-memory transport MCP server.
// Used when the MCP server is embedded within a Mattermost plugin process.
type InMemoryConfig struct {
	// MMServerURL is the external Mattermost server URL.
	MMServerURL string

	// MMInternalServerURL is the internal URL for API communication.
	// If empty, MMServerURL is used. Useful in containerized deployments
	// where the internal address differs from the public URL.
	MMInternalServerURL string
}

// GetServerURL returns the URL to use for API calls (internal if set, otherwise external).
func (c InMemoryConfig) GetServerURL() string {
	if c.MMInternalServerURL != "" {
		return c.MMInternalServerURL
	}
	return c.MMServerURL
}
