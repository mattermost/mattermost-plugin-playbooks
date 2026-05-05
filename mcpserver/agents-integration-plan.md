# Playbooks MCP ↔ Agents Plugin Integration Plan

## Goal

Expose the existing Playbooks MCP tools to the Mattermost Agents plugin using the cross-plugin MCP registration flow implemented in `mattermost-plugin-agents`, while preserving the standalone Playbooks MCP server for local development and other non-Agents use cases.

## References Reviewed

- Agents plugin branch: `IDEA-006-cross-plugin-mcp`
- Agents public helper package: `github.com/mattermost/mattermost-plugin-agents/public/mcphelper`
- Demo implementation: `mattermost/mattermost-plugin-demo#210`

## Decisions

1. Reuse the existing Playbooks MCP implementation.
2. Add a dependency on the Agents public MCP helper package.
3. Refactor to a cleaner shared package instead of wiring the root plugin to the nested `mcpserver` module with `require` + `replace`.
4. Tool execution must be user-scoped.
5. Use `/mcp/playbooks` as the plugin-local MCP endpoint.
6. Registration with Agents is best-effort; Playbooks must continue loading if Agents is unavailable.
7. Register all available Playbooks MCP tools.
8. Accept helper-generated tool-name prefixes, e.g. `playbooks__list_runs`.
9. Keep the standalone MCP server for local/dev and other uses.
10. Add tests for activation, deactivation, route protection, user propagation, tool discovery, and standalone build safety.

## Target Architecture

### Shared MCP package

Move reusable MCP logic into a normal root-module internal package:

```text
internal/playbooksmcp/
  config.go
  server.go
  tools/
    provider.go
    runs.go
    checklist.go
```

This package owns the reusable Playbooks MCP server/tool implementation.

### Plugin-integrated MCP endpoint

Add plugin runtime integration in the existing server package:

```text
server/mcp.go
```

This layer should:

- create a `mcphelper.Server`
- register all Playbooks tools
- register/unregister with Agents
- serve `/mcp/playbooks`
- propagate the calling Mattermost user into tool execution

### Standalone MCP server

Keep the standalone server under:

```text
mcpserver/
```

But update it to import shared logic from:

```go
github.com/mattermost/mattermost-plugin-playbooks/internal/playbooksmcp
```

The standalone server should continue to support STDIO/local usage and should not interfere with the plugin-integrated MCP endpoint.

## Agents Integration Behavior

### Registration

On Playbooks `OnActivate`, after normal activation succeeds:

```go
if err := p.ensureMCPServer(); err != nil {
    return errors.Wrap(err, "failed to initialize MCP server")
}
p.registerMCPServerBestEffort()
```

Registration payload:

```go
mcphelper.PluginMCPServer{
    PluginID: manifest.Id,      // "playbooks"
    Name:     "Playbooks MCP",
    Path:     "/mcp/playbooks",
    Version:  manifest.Version,
}
```

Registration must be best-effort. If Agents is missing, disabled, or not ready, Playbooks should log a warning and continue activation.

### Unregistration

On Playbooks `OnDeactivate`, unregister best-effort:

```go
p.unregisterMCPServerBestEffort()
```

Shutdown must not fail if unregister fails.

### Routing

Update `Plugin.ServeHTTP` to intercept MCP requests before the normal Playbooks API handler:

```go
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
    if p.serveMCPIfMatch(w, r) {
        return
    }

    p.handler.ServeHTTP(w, r)
}
```

The MCP route matcher should handle:

```text
/mcp/playbooks
/mcp/playbooks/...
```

and should not interfere with existing `/api/v0` routes.

### Security

The MCP endpoint should only accept inter-plugin requests from Agents. `mcphelper.Server.ServeHTTP` enforces:

```http
Mattermost-Plugin-ID: com.mattermost.ai
```

User identity is supplied by Agents via:

```http
X-Mattermost-UserID: <mattermost-user-id>
```

Tool handlers must use `mcphelper.GetUserID(ctx)` or an equivalent adapter to ensure the action runs as the invoking Mattermost user.

## Tool Execution Model

Tool execution must be user-scoped.

The shared MCP package should retain the existing `ClientFactory` abstraction or an equivalent interface, allowing different transports to create clients differently:

- plugin-integrated MCP: create a user-scoped Playbooks client from the Mattermost user ID propagated by Agents
- standalone STDIO MCP: keep existing token/PAT-based behavior

All existing Playbooks MCP tools should be registered:

- playbook run tools
- checklist tools
- any other existing MCP tools in the current implementation

For the plugin-integrated MCP server, tools should be registered with `mcphelper.AddTool`, which automatically prefixes tool names with the sanitized plugin ID:

```text
playbooks__<tool_name>
```

Standalone STDIO can keep its current tool names unless changed later.

## Dependency Plan

Root plugin module should add:

```go
github.com/mattermost/mattermost-plugin-agents/public/mcphelper
```

and the required MCP SDK dependency if not already present in the root module:

```go
github.com/modelcontextprotocol/go-sdk/mcp
```

Avoid making the root plugin depend on the nested `mcpserver` module via `require` + `replace`. Instead, move shared MCP code into `internal/playbooksmcp` so both root plugin code and the standalone module can import the same implementation cleanly.

## Implementation Steps

### 1. Create shared package

Create:

```text
internal/playbooksmcp/
internal/playbooksmcp/tools/
```

Move reusable files from `mcpserver/` into the shared package, adjusting package names and imports.

Likely candidates:

```text
mcpserver/config.go              -> internal/playbooksmcp/config.go
mcpserver/server.go              -> internal/playbooksmcp/server.go
mcpserver/playbooks_client.go    -> internal/playbooksmcp/playbooks_client.go, if still shared
mcpserver/tools/*                -> internal/playbooksmcp/tools/*
```

Transport-specific wrappers should remain in `mcpserver/` unless they are useful to plugin runtime.

### 2. Update standalone MCP server

Update files under `mcpserver/` to import and use `internal/playbooksmcp`.

Keep the standalone CLI behavior intact:

```sh
cd mcpserver
go build ./cmd/
```

### 3. Add plugin MCP runtime

Add `server/mcp.go` with helpers similar to the demo plugin:

- `ensureMCPServer() error`
- `registerMCPServerBestEffort()`
- `unregisterMCPServerBestEffort()`
- `serveMCPIfMatch(w http.ResponseWriter, r *http.Request) bool`

Add a field to `Plugin`:

```go
mcpServer *mcphelper.Server
```

### 4. Wire activation/deactivation

Update `OnActivate`:

- run existing activation first
- initialize MCP server
- register with Agents best-effort

Update `OnDeactivate`:

- preserve existing shutdown behavior
- unregister best-effort
- do not mask existing shutdown errors

### 5. Register tools for plugin-integrated MCP

Use the shared package/tool provider to register all available tools on `mcphelper.Server`.

Ensure the plugin-integrated tool path uses the Agents-provided user ID from context.

### 6. Add tests

Add or update tests for:

1. `OnActivate` continues when MCP registration fails.
2. `OnDeactivate` continues when MCP unregister fails.
3. `OnDeactivate` preserves existing core shutdown errors even if MCP unregister fails.
4. `/mcp/playbooks` is intercepted before the normal Playbooks router.
5. `/mcp/playbooks` without Agents inter-plugin header returns forbidden.
6. `/mcp/playbooks/...` is also intercepted/protected.
7. Tool handlers receive the expected Mattermost user ID from context.
8. All expected tools are discoverable through the MCP endpoint.
9. Standalone `mcpserver` still builds.

## Open Risks / Things to Watch

- Dependency version conflicts between root Playbooks module, Agents helper, Mattermost server public packages, and the MCP Go SDK.
- Ensuring user-scoped execution does not accidentally bypass Playbooks permission checks.
- Keeping standalone STDIO behavior unchanged while moving shared code.
- Ensuring `/mcp/playbooks` does not get caught by existing API middleware that requires `Mattermost-User-Id`; Agents calls use inter-plugin auth plus `X-Mattermost-UserID`, not the normal user auth header.
- Tool-name prefixing may require prompt/UI updates if existing standalone tool names are referenced anywhere.

## Recommended First PR Shape

A single implementation PR can be organized as:

1. Shared package refactor.
2. Standalone MCP server import updates.
3. Plugin-integrated MCP server using `mcphelper`.
4. Activation/deactivation/routing wiring.
5. Tests.
6. Documentation updates in `mcpserver/README.md` describing both standalone and Agents-integrated usage.
