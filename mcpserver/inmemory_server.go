package mcpserver

import (
	"context"
	"fmt"
	"log"
	"runtime/debug"

	"github.com/mattermost/mattermost-plugin-playbooks/mcpserver/tools"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// TokenResolver is a function that resolves a session ID to a bearer token.
type TokenResolver func(sessionID string) (string, error)

// Context keys for in-memory transport authentication.
type contextKey string

const (
	contextKeySessionID     contextKey = "session_id"
	contextKeyTokenResolver contextKey = "token_resolver"
)

// InMemoryServer runs an MCP server embedded within a plugin process.
// Each user gets their own in-memory transport connection, authenticated
// via Mattermost session tokens.
type InMemoryServer struct {
	*PlaybooksMCPServer
	config InMemoryConfig
}

// NewInMemoryServer creates a new in-memory transport MCP server.
func NewInMemoryServer(config InMemoryConfig) (*InMemoryServer, error) {
	if config.MMServerURL == "" {
		return nil, fmt.Errorf("server URL cannot be empty")
	}

	serverURL := config.GetServerURL()

	// For in-memory transport, the client is created per-request using the
	// session token from context. This ensures each tool call runs with
	// the correct user's permissions.
	clientFactory := func(ctx context.Context) (tools.APIClient, error) {
		resolver, ok := ctx.Value(contextKeyTokenResolver).(TokenResolver)
		if !ok {
			return nil, fmt.Errorf("no token resolver in context")
		}

		sessionID, ok := ctx.Value(contextKeySessionID).(string)
		if !ok || sessionID == "" {
			return nil, fmt.Errorf("no session ID in context")
		}

		token, err := resolver(sessionID)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve session token: %w", err)
		}

		return NewPlaybooksClient(serverURL, token), nil
	}

	mcpServer := mcp.NewServer(
		&mcp.Implementation{
			Name:    "mattermost-playbooks-mcp-server-embedded",
			Version: Version,
		},
		nil,
	)

	s := &InMemoryServer{
		PlaybooksMCPServer: &PlaybooksMCPServer{
			mcpServer:     mcpServer,
			clientFactory: clientFactory,
		},
		config: config,
	}

	s.registerTools()

	return s, nil
}

// CreateConnectionForUser creates a new in-memory transport connection for a user.
// Returns the client-side transport that the caller uses to send MCP requests.
//
// The sessionID and tokenResolver are used to authenticate API calls made by
// the tools — each tool invocation resolves a fresh token from the session.
func (s *InMemoryServer) CreateConnectionForUser(userID, sessionID string, tokenResolver TokenResolver) (*mcp.InMemoryTransport, error) {
	if userID == "" {
		return nil, fmt.Errorf("userID cannot be empty")
	}
	if sessionID == "" {
		return nil, fmt.Errorf("sessionID cannot be empty")
	}
	if tokenResolver == nil {
		return nil, fmt.Errorf("tokenResolver cannot be nil")
	}

	// Validate the session at connection time by resolving the token.
	token, err := tokenResolver(sessionID)
	if err != nil {
		return nil, fmt.Errorf("session validation failed: %w", err)
	}

	// Verify the token belongs to the expected user.
	client := NewPlaybooksClient(s.config.GetServerURL(), token)
	authenticatedUserID, err := client.GetCurrentUserID(context.Background())
	if err != nil {
		return nil, fmt.Errorf("token validation failed for user %s: %w", userID, err)
	}
	if authenticatedUserID != userID {
		return nil, fmt.Errorf("token belongs to user %s, expected %s", authenticatedUserID, userID)
	}

	// Build context with session auth for tool calls.
	ctx := context.Background()
	ctx = context.WithValue(ctx, contextKeySessionID, sessionID)
	ctx = context.WithValue(ctx, contextKeyTokenResolver, tokenResolver)

	// Create in-memory transport pair.
	serverTransport, clientTransport := mcp.NewInMemoryTransports()

	// Run the MCP server on the server-side transport in a goroutine.
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("MCP server panicked for user %s: %v\n%s", userID, r, debug.Stack())
			}
		}()

		if err := s.mcpServer.Run(ctx, serverTransport); err != nil {
			log.Printf("In-memory MCP server stopped for user %s: %v", userID, err)
		}
	}()

	return clientTransport, nil
}
