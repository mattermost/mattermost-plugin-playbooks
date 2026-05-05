# MCP Server — Future Improvements

Findings from reviewing our implementation against the [MCP specification](https://modelcontextprotocol.io/specification/2025-11-25/) and [official best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices).

## 1. Add MCP Resources for read-only data

The MCP spec distinguishes three primitives:
- **Tools** — model-controlled, perform actions (write, mutate, trigger)
- **Resources** — application-controlled, read-only data access
- **Prompts** — user-controlled, reusable workflow templates

Our `get_run` and `list_runs` are read-only operations that could be exposed as **Resources** in addition to tools. Resources use URIs and let the client decide how/when to present the data.

Examples:
- `playbook-run://{id}` — Full run state (checklists, participants, status)
- `playbook-runs://active?team={teamId}` — Active runs for a team
- `playbook-run://{id}/checklist/{num}` — Single checklist with item states

Resources are complementary to tools — keep the tools for when the model needs to actively decide to fetch data, but resources let the application proactively include context.

Reference: https://modelcontextprotocol.io/docs/learn/server-concepts#resources

## 2. Add MCP Prompts for guided workflows

Prompts are structured templates that guide the model through common workflows. They are user-invoked (e.g., via slash commands in the client) and can reference both tools and resources.

Candidates:
- **`incident-response`** — Guide an agent through triaging and working an active run: fetch status, check open items, post updates, assign tasks
- **`status-update`** — Help draft a status update based on recent checklist progress and timeline events
- **`run-summary`** — Produce a summary of a run's current state, open items, and blockers

Reference: https://modelcontextprotocol.io/docs/learn/server-concepts#prompts

## 3. Use MCP SDK logging instead of stderr

The MCP spec defines a [logging utility](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/logging) that lets servers send structured log messages to the client via the protocol. We currently use Go's `log` package which writes to stderr. This works for STDIO transport (the client reads stdout, not stderr) but MCP-native logging would let clients surface server logs in their UI, which is useful for debugging.

The `go-sdk` likely exposes a `server.SendLog()` or similar method.

## 4. Verify JSON Schema `required` fields are generated correctly

The MCP spec examples explicitly set `required: ["origin", "destination", "date"]` on tool schemas. Our `jsonschema-go` library infers required/optional from the `omitempty` JSON tag — fields without `omitempty` should appear in `required`. This should be verified by inspecting the actual generated schema (e.g., via MCP Inspector) to make sure that `run_id`, `title`, etc. are marked as required while optional fields like `description` are not.

## 5. Richer tool descriptions

The spec examples include `description` fields on individual properties (e.g., `"Departure city"` on an `origin` field). Our struct tags provide descriptions via `jsonschema:"description=..."`, but some could be more explicit about:
- What format the value should be in (e.g., "26-character Mattermost ID" is good, keep doing this)
- What the agent should do before calling the tool (e.g., "call get_run first to understand current state")
- What side effects the tool has (e.g., "this posts a message visible to all run participants")

## 6. HTTP transport support

The current PoC only supports STDIO transport, which is the recommended approach for local servers per the [security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices). However, HTTP transport (Streamable HTTP) would be needed for:
- Remote/hosted MCP server deployments
- Multi-user scenarios where the server runs as a service
- Integration with web-based MCP clients

This would require adding OAuth authorization (per the [MCP authorization spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)), HTTPS enforcement, SSRF protections, and session management. The `mattermost-plugin-agents/mcpserver/` already has an HTTP transport implementation (`http_server.go`) that can be used as a reference.

## 7. Add a validated ID type for URL path safety

All tool functions that interpolate IDs into URL paths (e.g., `fmt.Sprintf("runs/%s/...", args.RunID)`) must call `validateID` first, which restricts to `[a-z0-9]{26}` and prevents path traversal. Currently all 12 tools follow this pattern consistently, but there's no compile-time enforcement — a new tool could forget the call.

A `ValidatedID` type (constructed only via `validateID`) would let the compiler reject raw strings in URL interpolation, making the safety guarantee structural rather than convention-based. Low priority given the current codebase size, but worth considering as the tool count grows.

## 8. Embed as in-memory transport inside the plugin

The agents MCP server supports an in-memory transport (`inmemory_server.go`) that runs inside the plugin process. This avoids HTTP overhead and uses session-based auth tied to the Mattermost user session. For Playbooks, this would mean the MCP server runs as part of the plugin and has direct access to the service layer (bypassing the REST API entirely), giving better performance and tighter integration.
