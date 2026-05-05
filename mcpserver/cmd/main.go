package main

import (
	"fmt"
	"os"

	"github.com/mattermost/mattermost-plugin-playbooks/mcpserver"
	"github.com/spf13/cobra"
)

var (
	mmServerURL string
	token       string
)

func main() {
	rootCmd := &cobra.Command{
		Use:   "playbooks-mcp-server",
		Short: "Mattermost Playbooks MCP Server",
		Long: `A Model Context Protocol (MCP) server that provides tools for interacting
with Mattermost Playbooks. Supports listing runs, updating status, managing
checklists, and more.

Authentication is handled via Personal Access Tokens (PAT).`,
		Version: mcpserver.Version,
		RunE:    runServer,
	}

	rootCmd.Flags().StringVarP(&mmServerURL, "server-url", "s", "", "Mattermost server URL (required, or set MM_SERVER_URL)")
	rootCmd.Flags().StringVarP(&token, "token", "t", "", "Personal Access Token (required, or set MM_ACCESS_TOKEN)")
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func runServer(_ *cobra.Command, _ []string) error {
	if mmServerURL == "" {
		mmServerURL = os.Getenv("MM_SERVER_URL")
		if mmServerURL == "" {
			return fmt.Errorf("server URL is required (use --server-url or MM_SERVER_URL)")
		}
	}

	if token == "" {
		token = os.Getenv("MM_ACCESS_TOKEN")
		if token == "" {
			return fmt.Errorf("personal access token is required (use --token or MM_ACCESS_TOKEN)")
		}
	}

	config := mcpserver.StdioConfig{
		MMServerURL:         mmServerURL,
		PersonalAccessToken: token,
	}

	server, err := mcpserver.NewStdioServer(config)
	if err != nil {
		return fmt.Errorf("failed to create MCP server: %w", err)
	}

	return server.Serve()
}
