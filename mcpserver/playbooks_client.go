package mcpserver

import playbooksmcp "github.com/mattermost/mattermost-plugin-playbooks/internal/playbooksmcp"

// PlaybooksClient is a thin HTTP client for the Playbooks plugin REST API.
type PlaybooksClient = playbooksmcp.PlaybooksClient

// NewPlaybooksClient creates a new Playbooks API client.
func NewPlaybooksClient(serverURL, token string) *PlaybooksClient {
	return playbooksmcp.NewPlaybooksClient(serverURL, token)
}
