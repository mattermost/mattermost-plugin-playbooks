# Incoming Webhooks for Playbooks Plugin - Technical Spec

**Status:** Draft
**Date:** 2026-02-24
**Author:** TBD

## 1. Problem Statement

The playbooks plugin currently supports **outgoing webhooks** (notifying external
systems when events occur in playbook runs), but lacks the inverse: the ability
for external systems to **trigger actions inside playbook runs** via HTTP.

The initial use case is allowing external systems to **update property values**
on playbook runs. Since properties drive conditional automation (auto-creating
tasks, triggering notifications), this enables powerful integrations:

- A CI/CD pipeline sets a "build status" property on a run, which triggers
  downstream checklist items.
- An external monitoring system updates a "severity" property, which
  conditionally changes the run workflow.
- A third-party service marks a "deployment status" property as complete.

## 2. Goals

1. Allow external systems to update playbook run property values via HTTP POST
   **without Mattermost user credentials**.
2. Authenticate requests using the webhook ID in the URL path, following the
   same pattern as Mattermost core incoming webhooks (`POST /hooks/{id}`).
3. Scope each webhook to a specific playbook (affecting all its runs) or to
   a specific playbook run.
4. Manage webhooks entirely through slash commands (no webapp UI needed in the
   first iteration).
5. Auto-cleanup run-scoped webhooks when a run finishes.

## 3. Non-Goals (first iteration)

- Web UI for managing incoming webhooks.
- Channel-scoped webhooks (can be added later).
- Webhook signature verification (HMAC) for outbound delivery confirmation.
- Rate limiting per webhook (rely on server-level rate limiting).
- Maximum webhooks per scope limits.
- Actions beyond `update_property` (create_run, update_status, check_item,
  post_message, finish_run — all deferred to future iterations).

## 4. Research Summary

### 4.1 How Mattermost Server Handles Incoming Webhooks

- **Model:** `IncomingWebhook` struct with fields: `Id`, `UserId`, `ChannelId`,
  `TeamId`, `DisplayName`, `Description`, `ChannelLocked`.
- **Endpoint:** `POST /hooks/{id}` — registered on the main router with
  `APIHandlerTrustRequester`, which sets `RequireSession: false`.
- **Authentication:** The webhook ID in the URL **is** the credential. No
  separate token exists for core incoming webhooks.
- **Scoping:** Team + Channel + User. The `ChannelLocked` flag prevents posting
  to a different channel than configured.

### 4.2 How Plugins Receive Unauthenticated HTTP Requests

- All requests to `/plugins/{plugin_id}/*` are routed to `ServeHTTP`.
- If no `Authorization` header, no `MATTERMOST_TOKEN` cookie, and no
  `access_token` query parameter are present, the request is passed through
  **without authentication**.
- The `Mattermost-User-Id` header is **only set** when authentication succeeds.
- Plugins can therefore serve unauthenticated endpoints by routing requests
  where `Mattermost-User-Id` is empty to a separate handler.

### 4.3 Current Playbooks Plugin Architecture

- **Router setup** (`server/api/api.go`): A `root` mux router with an
  `/api/v0` subrouter that applies `MattermostAuthorizationRequired` middleware.
- **Key insight:** The `root` router is available to register paths **outside**
  `/api/v0`, bypassing the auth middleware. This is the natural place to mount
  the incoming webhook endpoint.
- **Existing outgoing webhooks:** `WebhookOnCreationURLs` and
  `WebhookOnStatusUpdateURLs` on the `Playbook` model; payloads include the
  full `PlaybookRun` struct, channel URL, details URL, and event metadata.

### 4.4 Playbook Run Properties

Properties are custom fields defined at the playbook level and copied to each
run. The plugin uses the Mattermost core Property API via `pluginapi`.

- **Types:** `text`, `select`, `multiselect`, `user`, `multiuser`, `date`.
- **Setting values:** `PlaybookRunService.SetRunPropertyValue(userID, runID, fieldID, value)`.
- **Validation:** Values are sanitized and validated per type (e.g., select
  values must match a valid option ID).
- **Side effects:** Updating a property value triggers condition evaluation
  (`ConditionService.EvaluateConditionsOnValueChanged`), timeline events, and
  WebSocket notifications. This means incoming webhooks that update properties
  automatically participate in the full automation pipeline.
- **REST endpoint:** `PUT /api/v0/runs/{id}/property_fields/{fieldID}/value`
  (requires `RunManageProperties` permission).
- **Licensing:** Requires `PlaybookAttributesAllowed()` license check.

## 5. Design

### 5.1 Data Model

```go
// IncomingWebhook represents an endpoint that external systems can call to
// trigger actions on playbooks or playbook runs. The webhook ID is used as
// the credential in the URL path, following the Mattermost core pattern.
type IncomingWebhook struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    CreatorID string `json:"creator_id"` // Mattermost user who created it
    TeamID    string `json:"team_id"`

    // Scoping — exactly one of these must be set.
    PlaybookID    string `json:"playbook_id,omitempty"`     // scoped to a playbook
    PlaybookRunID string `json:"playbook_run_id,omitempty"` // scoped to a single run

    CreateAt int64 `json:"create_at"`
    UpdateAt int64 `json:"update_at"`
    DeleteAt int64 `json:"delete_at"`
}
```

**Design decisions:**

| Decision | Rationale |
|----------|-----------|
| **ID as credential** | Follows the Mattermost core incoming webhook pattern (`POST /hooks/{id}`). The 26-character `model.NewId()` provides ~155 bits of entropy, which is consistent with what core considers sufficient. Simplifies the model (no separate token, no hashing, no regeneration). |
| **Playbook-scoped vs Run-scoped** | A playbook-scoped webhook can act on any run of that playbook. A run-scoped webhook is locked to a single run. This covers the two main usage patterns: long-lived integrations that span many runs, and incident-specific integrations. |
| **Run-scoped auto-cleanup** | When a run finishes, its webhooks are soft-deleted. A finished run is read-only, so webhooks are no longer useful. |

### 5.2 Database Schema

```sql
CREATE TABLE IF NOT EXISTS IR_IncomingWebhook (
    ID            TEXT PRIMARY KEY,
    Name          TEXT NOT NULL,
    CreatorID     TEXT NOT NULL,
    TeamID        TEXT NOT NULL,
    PlaybookID    TEXT DEFAULT '',
    PlaybookRunID TEXT DEFAULT '',
    CreateAt      BIGINT NOT NULL DEFAULT 0,
    UpdateAt      BIGINT NOT NULL DEFAULT 0,
    DeleteAt      BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_ir_incoming_webhook_playbook ON IR_IncomingWebhook (PlaybookID) WHERE DeleteAt = 0;
CREATE INDEX idx_ir_incoming_webhook_run ON IR_IncomingWebhook (PlaybookRunID) WHERE DeleteAt = 0;
```

### 5.3 ID Generation

- **Generation:** Use `model.NewId()` (26-character alphanumeric, ~155 bits of
  entropy), same as Mattermost core incoming webhooks.
- **Lookup:** Direct primary key lookup by ID on each incoming request.
- **Display:** The ID is returned in the slash command response on creation.
  It is **not** shown in `webhook list` output since the ID **is** the
  credential. Users should treat webhook URLs as secrets.

### 5.4 HTTP Endpoint

```
POST /plugins/playbooks/hooks/{id}
```

Registered on the `root` router (not the `/api/v0` subrouter), so it
**bypasses** the `MattermostAuthorizationRequired` middleware. This follows
the same pattern as Mattermost core webhooks (`POST /hooks/{id}`), which
register on the main router with `RequireSession: false`.

**Authentication:** The webhook ID in the URL path **is** the credential. No
additional authentication headers or tokens are required.

**Request body:**

```json
{
    "action": "update_property",

    // Required for playbook-scoped webhooks to identify the target run.
    // Ignored for run-scoped webhooks (locked to their run).
    "playbook_run_id": "run-26charidentifier",

    // Property identification — exactly one of these must be set.
    "property_field_id": "field-26charidentifier",
    "property_name": "Build Status",

    // The new value. Format depends on the property type:
    //   text:        "some string"
    //   select:      "option-id"
    //   multiselect: ["option-id-1", "option-id-2"]
    //   user:        "user-id"
    //   multiuser:   ["user-id-1", "user-id-2"]
    //   date:        1708732800000  (unix ms)
    "value": "passed"
}
```

**Property identification:** Callers can identify the target property field
either by `property_field_id` (the run-level field ID) or by `property_name`
(the display name, looked up case-insensitively). Using `property_name` is more
ergonomic for external systems that don't know internal IDs. If both are
provided, `property_field_id` takes precedence.

**Response:**

```json
// 200 OK
{
    "ok": true
}

// 4xx/5xx
{
    "error": "description of the problem"
}
```

### 5.5 Supported Actions

| Action | Description | Scope |
|--------|-------------|-------|
| `update_property` | Update a property value on a playbook run | Both |

Each action is executed **as the webhook creator** (`CreatorID`), ensuring
permissions are respected. The creator must have `RunManageProperties`
permission on the target run. If the creator loses access, the webhook
stops working.

**Property update side effects:** Because the action calls
`PlaybookRunService.SetRunPropertyValue()`, all existing side effects fire
automatically:
- Property value validation and sanitization.
- Condition evaluation (`EvaluateConditionsOnValueChanged`) — may auto-create
  checklist items or trigger other automation.
- Timeline event with old/new values.
- WebSocket `playbook_run_updated` event to all participants.

### 5.6 Request Processing Flow

```
External System
    │
    ▼
POST /plugins/playbooks/hooks/{id}
    │
    ├─ Extract webhook ID from URL path
    ├─ Lookup webhook by ID in DB (primary key, filtered by DeleteAt = 0)
    ├─ Parse and validate request body
    ├─ Validate action (must be "update_property")
    ├─ Resolve target run
    │   ├─ Run-scoped webhook: use webhook's PlaybookRunID
    │   └─ Playbook-scoped webhook: use request's playbook_run_id field
    │       └─ Validate run belongs to the webhook's playbook
    ├─ Validate creator still has RunManageProperties permission on the run
    ├─ Resolve property field
    │   ├─ By property_field_id: direct lookup
    │   └─ By property_name: lookup in run's property fields (case-insensitive)
    ├─ Call PlaybookRunService.SetRunPropertyValue(creatorID, runID, fieldID, value)
    │   ├─ Validates and sanitizes value
    │   ├─ Stores the value
    │   ├─ Fires condition evaluation
    │   ├─ Creates timeline event
    │   └─ Sends WebSocket event
    └─ Return response
```

### 5.7 Slash Commands

All webhook management is done through the `/playbook` slash command, under a
new `webhook` subcommand group.

#### `/playbook webhook create`

```
/playbook webhook create --name "Grafana Alerts" --playbook <playbook-id>
/playbook webhook create --name "CI Status" --run <run-id>
```

- Creates a new incoming webhook.
- Returns an ephemeral message with the webhook URL (including the ID).
- The `--playbook` or `--run` flag determines the scope.
- Exactly one scope flag must be provided.

**Permissions:** The user must be a member of the playbook, or a participant of
the run.

**Response (ephemeral):**

```
Incoming webhook "CI Status" created.

URL: https://mattermost.example.com/plugins/playbooks/hooks/abc123def456ghi789jkl012mn

Keep this URL secret — the webhook ID is the credential.
To revoke access, delete the webhook with:
  /playbook webhook delete abc123def456ghi789jkl012mn

Example:
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"action": "update_property", "property_name": "Build Status", "value": "passed"}' \
    https://mattermost.example.com/plugins/playbooks/hooks/abc123def456ghi789jkl012mn
```

**Convenience:** When invoked from a channel associated with a playbook run,
the `--run` flag can be omitted and defaults to the current channel's run.

#### `/playbook webhook list`

```
/playbook webhook list --playbook <playbook-id>
/playbook webhook list --run <run-id>
/playbook webhook list
```

- Lists all active incoming webhooks for the given scope.
- When invoked without flags from a run channel, lists webhooks for that run.
- Shows: name, creator, creation date. The ID is **not** displayed in the list
  since it is the credential — to revoke, the user must know the ID from the
  original creation response or delete by name.

**Permissions:** Must be a member/participant.

#### `/playbook webhook delete`

```
/playbook webhook delete <webhook-id>
```

- Soft-deletes the webhook (sets `DeleteAt`).
- Only the webhook creator or a playbook/run admin can delete.
- If the ID is compromised, deleting and re-creating the webhook is the way
  to rotate credentials (consistent with the MM core approach).

### 5.8 Argument Resolution for Slash Commands

The `--playbook` and `--run` flags accept the resource ID directly. Users can
obtain these from:

- The playbook run's URL: `.../playbooks/runs/<run-id>`
- The playbook's URL: `.../playbooks/playbooks/<playbook-id>`
- The `/playbook info` command output (for the current channel's run)

### 5.9 Router Integration

In `server/api/api.go`, the `Handler` struct exposes the `root` router. The
new webhook endpoint is registered directly on `root`:

```go
func NewHandler(pluginAPI *pluginapi.Client, config config.Service) *Handler {
    // ... existing setup ...

    // Incoming webhooks — no auth middleware
    root.HandleFunc("/hooks/{id:[A-Za-z0-9]+}",
        handler.handleIncomingWebhook).Methods(http.MethodPost)

    return handler
}
```

This path becomes `/plugins/playbooks/hooks/{id}` externally (the server
prefixes `/plugins/{plugin_id}`).

### 5.10 Run-Scoped Webhook Auto-Cleanup

When a playbook run finishes (transitions to `Finished` status), all
run-scoped webhooks are soft-deleted. This is implemented by calling
`IncomingWebhookStore.DeleteByPlaybookRunID(runID)` from the run finish
handler in `PlaybookRunService`.

This prevents stale webhooks from accumulating and makes it clear to external
systems that the webhook is no longer valid (they'll receive a `404` or `410`
on subsequent calls).

## 6. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **ID leakage** | The webhook ID is the credential (same as MM core). Users should treat webhook URLs as secrets. The ID is not displayed in `webhook list` output. |
| **Brute-force** | 26-char alphanumeric ID = ~155 bits entropy (same as MM core). Rely on server-level rate limiting. |
| **Privilege escalation** | Actions execute as the webhook creator. If creator loses permissions, webhook fails. Re-validated on every request. |
| **SSRF** | Not applicable — this is an **incoming** webhook (we receive requests, not send them). |
| **Replay attacks** | `update_property` is idempotent — setting the same value twice is a no-op (no new timeline event if value unchanged). |
| **Credential rotation** | Delete and re-create the webhook to get a new ID. Consistent with MM core pattern. |

## 7. Store Interface

```go
type IncomingWebhookStore interface {
    Create(webhook IncomingWebhook) (IncomingWebhook, error)
    Get(id string) (IncomingWebhook, error)
    GetByPlaybookID(playbookID string) ([]IncomingWebhook, error)
    GetByPlaybookRunID(playbookRunID string) ([]IncomingWebhook, error)
    Delete(id string) error
    DeleteByPlaybookRunID(runID string) error
}
```

## 8. Implementation Plan

### Phase 1: Data layer
- Define `IncomingWebhook` model in `server/app/`.
- Add database migration for `IR_IncomingWebhook` table.
- Implement `IncomingWebhookStore` in `server/sqlstore/`.

### Phase 2: Webhook endpoint
- Register `/hooks/{id}` on the root router in `api.go`.
- Implement `handleIncomingWebhook` handler with ID extraction, lookup,
  validation, and `update_property` action dispatch.
- Wire into `PlaybookRunService.SetRunPropertyValue()`.

### Phase 3: Slash commands
- Add `webhook` subcommand group to `/playbook`.
- Implement `create`, `list`, `delete` subcommands.
- Register the updated command in `command.go`.

### Phase 4: Auto-cleanup
- Hook into the run finish flow to soft-delete run-scoped webhooks.

## 9. Future Extensions

- **Additional actions:** `create_run`, `update_status`, `check_item`,
  `post_message`, `finish_run`.
- **Channel-scoped webhooks:** A webhook scoped to a channel that could affect
  any run associated with that channel.
- **Action filtering:** Allow a webhook to only trigger specific actions.
- **HMAC signature verification:** For mutual authentication.
- **Web UI:** Full management interface in the playbooks webapp.
- **Webhook templates:** Pre-configured payload mappings for popular services
  (Grafana, PagerDuty, Datadog) that transform their native formats into
  playbook actions.
- **Rate limiting per webhook:** Individual rate limits beyond server-level
  throttling.
