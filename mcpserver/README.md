# Mattermost Playbooks MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes Mattermost Playbooks features to AI agents. It allows agents to list and manage playbook runs, update statuses, and work with checklists — all using the calling user's permissions.

## Prerequisites

- Go 1.25+
- A running Mattermost server with the Playbooks plugin installed
- A [Personal Access Token (PAT)](https://docs.mattermost.com/developer/personal-access-tokens.html) from your Mattermost account (only for STDIO transport)

## Build

```bash
cd mcpserver
go build -o playbooks-mcp-server ./cmd/
```

## Usage

### Command line

```bash
./playbooks-mcp-server --server-url http://localhost:8065 --token <YOUR_PAT>
```

Or using environment variables:

```bash
export MM_SERVER_URL=http://localhost:8065
export MM_ACCESS_TOKEN=<YOUR_PAT>
./playbooks-mcp-server
```

### Flags

| Flag | Env var | Description |
|------|---------|-------------|
| `--server-url`, `-s` | `MM_SERVER_URL` | Mattermost server URL (required) |
| `--token`, `-t` | `MM_ACCESS_TOKEN` | Personal Access Token (required) |

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "playbooks": {
      "command": "/absolute/path/to/playbooks-mcp-server",
      "args": ["--server-url", "http://localhost:8065", "--token", "<YOUR_PAT>"]
    }
  }
}
```

### Claude Code

Add to your Claude Code settings or `.mcp.json`:

```json
{
  "mcpServers": {
    "playbooks": {
      "command": "/absolute/path/to/playbooks-mcp-server",
      "args": ["--server-url", "http://localhost:8065", "--token", "<YOUR_PAT>"]
    }
  }
}
```

## Available tools

### Run management

| Tool | Description |
|------|-------------|
| `list_runs` | List playbook runs with filters (team, status, owner). Paginated. |
| `get_run` | Get full details of a run including checklists, participants, and status. |
| `update_run_status` | Post a status update (Markdown). Optionally set a reminder or finish the run. |
| `finish_run` | Mark a run as finished. |
| `change_run_owner` | Reassign ownership of a run. |

### Checklist items

| Tool | Description |
|------|-------------|
| `check_item` | Change item state: `open`, `closed`, or `skipped`. |
| `add_checklist_item` | Add a new task to a checklist. Optionally set description and assignee. |
| `edit_checklist_item` | Edit an item's title, description, or slash command. Only provided fields are updated. |
| `remove_checklist_item` | Permanently delete a checklist item. |

### Sections (checklist groups)

| Tool | Description |
|------|-------------|
| `add_section` | Create a new section in a run. |
| `rename_section` | Rename an existing section. |
| `remove_section` | Delete a section and all its items. |

## Embedding in a plugin (in-memory transport)

The MCP server can run embedded within a Mattermost plugin process using in-memory transport. This eliminates the need for PATs — the user's existing Mattermost session is used for authentication.

### Integration with the agents plugin

The `InMemoryServer` exposes `CreateConnectionForUser()`, which is the method the agents plugin calls to create a per-user MCP connection:

```go
import (
    playbooksmcp "github.com/mattermost/mattermost-plugin-playbooks/mcpserver"
)

// During plugin activation:
config := playbooksmcp.InMemoryConfig{
    MMServerURL:         siteURL,
    MMInternalServerURL: "http://localhost:8065", // internal address
}
playbooksServer, err := playbooksmcp.NewInMemoryServer(config)

// When creating a connection for a user:
tokenResolver := func(sessionID string) (string, error) {
    session, err := pluginAPI.Session.Get(sessionID)
    if err != nil {
        return "", err
    }
    return session.Token, nil
}
clientTransport, err := playbooksServer.CreateConnectionForUser(userID, sessionID, tokenResolver)
// clientTransport is then used by the MCP client to call tools
```

Each tool invocation resolves a fresh token from the session, so the user's permissions are always current.

## Permissions

All API calls go through the standard Mattermost Playbooks permission system. Whether using STDIO (PAT) or in-memory (session), the agent operates as the authenticated user — if the user can't perform an action in the UI, the agent can't either.

## Architecture

A standalone Go module that communicates with the Playbooks plugin over its REST API (`/plugins/playbooks/api/v0/`). Supports two transports, following the same patterns as the [mattermost-plugin-agents MCP server](https://github.com/mattermost/mattermost-plugin-ai).

| Transport | Auth | Use case |
|-----------|------|----------|
| **STDIO** | Personal Access Token (CLI flag / env var) | Standalone binary for Claude Desktop, Claude Code, etc. |
| **In-memory** | Mattermost session (token resolver) | Embedded in a plugin (e.g., agents plugin) |

```text
mcpserver/
├── cmd/main.go            # CLI entry point (STDIO)
├── config.go              # Configuration types
├── server.go              # Core MCP server
├── stdio_server.go        # STDIO transport
├── inmemory_server.go     # In-memory transport (for plugin embedding)
├── playbooks_client.go    # HTTP client for Playbooks API
└── tools/
    ├── provider.go        # Tool registration (ClientFactory pattern)
    ├── runs.go            # Run management tools
    ├── checklist.go       # Checklist and section tools
    └── validate.go        # Input validation helpers
```
