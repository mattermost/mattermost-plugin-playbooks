# Incoming Webhooks — Implementation Architecture

**Spec:** [incoming-webhooks-spec.md](./incoming-webhooks-spec.md)
**Date:** 2026-02-25

This document describes the implementation plan for the incoming webhooks
feature, broken into testable phases. Each phase is self-contained and can be
merged independently.

---

## Phase 1: Data Model and Store

**Goal:** Define the `IncomingWebhook` model, create the database table, and
implement the store layer with full CRUD operations.

### Technical Description

**1.1 Model definition**

Create `server/app/incoming_webhook.go` with:

```go
type IncomingWebhook struct {
    ID            string `json:"id"`
    Name          string `json:"name"`
    CreatorID     string `json:"creator_id"`
    TeamID        string `json:"team_id"`
    PlaybookID    string `json:"playbook_id,omitempty"`
    PlaybookRunID string `json:"playbook_run_id,omitempty"`
    CreateAt      int64  `json:"create_at"`
    UpdateAt      int64  `json:"update_at"`
    DeleteAt      int64  `json:"delete_at"`
}
```

Add a `PreSave()` method that sets `ID` via `model.NewId()` and populates
`CreateAt`/`UpdateAt` timestamps. Add an `IsValid()` method that enforces:
- `Name` is non-empty and <= 128 characters.
- `CreatorID` and `TeamID` are non-empty.
- Exactly one of `PlaybookID` or `PlaybookRunID` is set (not both, not neither).

**1.2 Store interface**

Add the `IncomingWebhookStore` interface to `server/app/incoming_webhook.go`:

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

**1.3 Database migration**

Create migration `000083` in `server/sqlstore/migrations/postgres/`:

- `000083_create_incoming_webhooks.up.sql`: Creates `IR_IncomingWebhook` table
  with columns matching the model, plus partial indexes on `PlaybookID` and
  `PlaybookRunID` (filtered by `DeleteAt = 0`).
- `000083_create_incoming_webhooks.down.sql`: Drops the table.

Register the migration in `server/sqlstore/migrations.go` as version
`0.67.0` → `0.68.0` (the next available version in the migration chain).

**1.4 Store implementation**

Create `server/sqlstore/incoming_webhook.go` implementing
`app.IncomingWebhookStore`. Follow the same patterns as `playbook_run.go`:

- Use the shared `*SQLStore` and its `sq.StatementBuilderType`.
- Constructor: `NewIncomingWebhookStore(sqlStore *SQLStore) app.IncomingWebhookStore`.
- `Get` and listing methods filter by `DeleteAt = 0`.
- `Delete` performs a soft-delete (sets `DeleteAt` to current time).
- `DeleteByPlaybookRunID` soft-deletes all webhooks for a given run.

**1.5 Store wiring**

In `server/plugin.go` `OnActivate()`, after the `sqlStore` is created
(currently around line 147), instantiate the incoming webhook store:

```go
incomingWebhookStore := sqlstore.NewIncomingWebhookStore(sqlStore)
```

Store it as a field on the `Plugin` struct.

### Acceptance Criteria

- [ ] `IncomingWebhook` struct exists in `server/app/incoming_webhook.go` with
      `PreSave()` and `IsValid()` methods.
- [ ] `IncomingWebhookStore` interface is defined in the same file.
- [ ] Migration `000083` creates the `IR_IncomingWebhook` table with the
      correct schema and indexes; the down migration drops it.
- [ ] Migration is registered in `migrations.go`.
- [ ] `server/sqlstore/incoming_webhook.go` implements all interface methods.
- [ ] Unit tests for `PreSave()` and `IsValid()` cover: valid webhook, missing
      name, missing creator, both scopes set, neither scope set.
- [ ] Unit tests for the store layer cover: create + get, create + delete + get
      returns not found, list by playbook ID, list by run ID,
      delete-by-run-ID deletes all webhooks for that run.
- [ ] Store is instantiated in `plugin.go` `OnActivate()`.

---

## Phase 2: HTTP Endpoint

**Goal:** Register an unauthenticated HTTP endpoint that accepts webhook
requests, validates them, and dispatches the `update_property` action.

### Technical Description

**2.1 Handler struct**

Create `server/api/incoming_webhooks.go` with:

```go
type IncomingWebhookHandler struct {
    *ErrorHandler
    webhookStore       app.IncomingWebhookStore
    playbookRunService app.PlaybookRunService
    permissions        *app.PermissionsService
    propertyService    app.PropertyServiceReader
}
```

Constructor `NewIncomingWebhookHandler(...)` receives the `*Handler` and
registers on its `root` router (not the `/api/v0` subrouter):

```go
router.HandleFunc("/hooks/{id:[A-Za-z0-9]+}",
    handler.handleIncomingWebhook).Methods(http.MethodPost)
```

**2.2 Request struct**

```go
type IncomingWebhookRequest struct {
    Action          string          `json:"action"`
    PlaybookRunID   string          `json:"playbook_run_id"`
    PropertyFieldID string          `json:"property_field_id"`
    PropertyName    string          `json:"property_name"`
    Value           json.RawMessage `json:"value"`
}
```

**2.3 Handler logic (`handleIncomingWebhook`)**

1. Extract `{id}` from URL path via `mux.Vars(r)`.
2. Look up webhook via `incomingWebhookStore.Get(id)`. Return `404` if not
   found or deleted.
3. Decode request body into `IncomingWebhookRequest`. Return `400` on parse
   error.
4. Validate `action == "update_property"`. Return `400` for unknown actions.
5. **Resolve target run:**
   - Run-scoped webhook: use `webhook.PlaybookRunID`.
   - Playbook-scoped webhook: use `request.PlaybookRunID` (required, return
     `400` if missing). Validate the run's `PlaybookID` matches
     `webhook.PlaybookID` by fetching the run; return `403` if mismatched.
6. **Validate creator permissions:** Call
   `permissions.RunManageProperties(webhook.CreatorID, runID)`. Return `403`
   if denied.
7. **Resolve property field:**
   - If `request.PropertyFieldID` is set, use it directly.
   - Else if `request.PropertyName` is set, fetch the run's property fields
     via `propertyService.GetRunPropertyFields(runID)` and find a
     case-insensitive name match. Return `400` if not found.
   - If neither is set, return `400`.
8. Call `playbookRunService.SetRunPropertyValue(webhook.CreatorID, runID,
   fieldID, request.Value)`. Return `500` on error.
9. Return `200` with `{"ok": true}`.

**2.4 Handler wiring**

In `server/plugin.go` `OnActivate()`, after the existing handler registrations
(around line 215-263), add:

```go
api.NewIncomingWebhookHandler(
    p.handler,
    p.incomingWebhookStore,
    p.playbookRunService,
    p.permissions,
    p.propertyService,
)
```

### Acceptance Criteria

- [ ] `server/api/incoming_webhooks.go` exists with `IncomingWebhookHandler`
      and `IncomingWebhookRequest` types.
- [ ] Route `POST /hooks/{id}` is registered on the root router (not
      `/api/v0`), bypassing `MattermostAuthorizationRequired`.
- [ ] Requesting a non-existent or deleted webhook ID returns `404`.
- [ ] Requesting with an invalid or missing `action` returns `400`.
- [ ] Requesting with `action: "update_property"` but missing both
      `property_field_id` and `property_name` returns `400`.
- [ ] A playbook-scoped webhook rejects requests where `playbook_run_id` is
      missing (`400`) or belongs to a different playbook (`403`).
- [ ] A run-scoped webhook ignores the `playbook_run_id` field in the request
      and uses its own.
- [ ] If the webhook creator no longer has `RunManageProperties` permission,
      the request returns `403`.
- [ ] A valid `update_property` request updates the property value and returns
      `200` with `{"ok": true}`.
- [ ] Property lookup by `property_name` is case-insensitive and returns `400`
      if no field matches.
- [ ] All existing property side effects fire: condition evaluation, timeline
      event, WebSocket notification.
- [ ] Handler is instantiated in `plugin.go` `OnActivate()`.

---

## Phase 3: Slash Commands

**Goal:** Add `/playbook webhook create|list|delete` subcommands for managing
incoming webhooks.

### Technical Description

**3.1 Command runner dependencies**

Add `incomingWebhookStore app.IncomingWebhookStore` to the `Runner` struct in
`server/command/command.go` (around line 192). Update `NewCommandRunner()` to
accept and store it. Update the call site in `server/plugin.go`
`ExecuteCommand()` to pass the store.

**3.2 Command routing**

In the `Execute()` switch statement (around line 2139), add a `"webhook"` case
that dispatches to `r.actionWebhook(parameters)`.

**3.3 Subcommand dispatch**

Implement `actionWebhook(args []string)` which reads `args[0]` and dispatches
to:
- `actionWebhookCreate(args[1:])`
- `actionWebhookList(args[1:])`
- `actionWebhookDelete(args[1:])`
- Otherwise, return a help message listing the subcommands.

**3.4 `/playbook webhook create`**

Parse flags: `--name <string>` (required), `--playbook <id>` or `--run <id>`
(exactly one required). Use the standard `flag` package.

Validation:
- Exactly one of `--playbook` or `--run` must be set.
- If `--playbook` is set, verify it exists via `playbookService.Get(id)` and
  that the user is a member.
- If `--run` is set, verify it exists and that the user is a participant. If
  neither flag is provided and the command is run from a run channel, default
  `--run` to the current channel's run.
- Derive `TeamID` from the run or playbook.

Create the webhook via `incomingWebhookStore.Create(...)`. Build the full URL
using `siteURL + "/plugins/playbooks/hooks/" + webhook.ID`. Return an
ephemeral response showing the URL, a security reminder, and a curl example.

**3.5 `/playbook webhook list`**

Parse flags: `--playbook <id>` or `--run <id>` (optional). If neither is set
and the command is run from a run channel, default to the current run.

Fetch webhooks via the appropriate store method. Format as a table showing:
name, creator username (fetched via `pluginAPI.User.Get`), creation date. The
webhook ID is **not** shown (it is the credential).

If no webhooks exist, return a message saying so.

**3.6 `/playbook webhook delete`**

Takes one positional argument: the webhook ID. Look up the webhook. Verify the
caller is the creator or has admin permissions on the playbook/run. Soft-delete
via `incomingWebhookStore.Delete(id)`. Return a confirmation message.

**3.7 Autocomplete**

Update `getAutocompleteData()` in `command.go` to include the `webhook`
subcommand with its `create`, `list`, and `delete` children and their
respective flag hints.

### Acceptance Criteria

- [ ] `/playbook webhook create --name "Test" --playbook <id>` creates a
      playbook-scoped webhook and returns the URL in an ephemeral message.
- [ ] `/playbook webhook create --name "Test" --run <id>` creates a
      run-scoped webhook.
- [ ] `/playbook webhook create` from a run channel with `--name` but no
      scope flag defaults to the current run.
- [ ] Creating without `--name` returns an error.
- [ ] Creating with both `--playbook` and `--run` returns an error.
- [ ] Creating with a non-existent playbook/run ID returns an error.
- [ ] Creating without membership/participation returns a permission error.
- [ ] `/playbook webhook list --playbook <id>` lists webhooks showing name,
      creator, and date (no IDs).
- [ ] `/playbook webhook list` from a run channel lists that run's webhooks.
- [ ] `/playbook webhook list` with no scope and outside a run channel returns
      an error.
- [ ] `/playbook webhook delete <id>` deletes the webhook and returns
      confirmation.
- [ ] Deleting someone else's webhook without admin permissions returns an
      error.
- [ ] Deleting a non-existent webhook returns an error.
- [ ] Autocomplete shows `webhook` with `create`, `list`, `delete` children.

---

## Phase 4: Run Finish Auto-Cleanup

**Goal:** When a playbook run finishes, automatically soft-delete all
run-scoped incoming webhooks associated with it.

### Technical Description

**4.1 Hook location**

In `server/app/playbook_run_service.go`, method `FinishPlaybookRun()` (around
line 1210). After the existing cleanup steps (reminder removal at ~line 1270,
retrospective at ~line 1274), add:

```go
if err := s.incomingWebhookStore.DeleteByPlaybookRunID(playbookRunID); err != nil {
    logrus.WithError(err).WithField("playbook_run_id", playbookRunID).
        Error("failed to delete incoming webhooks on run finish")
    // Non-fatal: log and continue. The run still finishes successfully.
}
```

**4.2 Service dependency**

Add `incomingWebhookStore app.IncomingWebhookStore` to the
`PlaybookRunServiceImpl` struct (around line 88 in
`playbook_run_service.go`). Update `NewPlaybookRunService()` to accept and
store it. Update the call site in `plugin.go` `OnActivate()`.

**4.3 Behavior on already-deleted webhooks**

`DeleteByPlaybookRunID` is idempotent — if there are no webhooks for the run,
it's a no-op. If webhooks are already deleted (non-zero `DeleteAt`), the WHERE
clause (`DeleteAt = 0`) skips them.

### Acceptance Criteria

- [ ] Finishing a run with run-scoped webhooks soft-deletes all of them.
- [ ] Finishing a run with no webhooks succeeds without error.
- [ ] Playbook-scoped webhooks are **not** affected by finishing a run.
- [ ] After a run is finished, calling the webhook endpoint returns `404`.
- [ ] A failure in `DeleteByPlaybookRunID` is logged but does not prevent the
      run from finishing.

---

## Phase 5: Integration Testing

**Goal:** End-to-end validation of the full feature across all layers.

### Technical Description

Create `server/api_incoming_webhooks_test.go` (in `package main`, alongside
other integration tests like `property_operations_test.go`) with integration
tests that exercise the full flow through the HTTP endpoint. These tests use
the plugin's test infrastructure to set up a running plugin instance.

**5.1 Test cases**

| Test | Description |
|------|-------------|
| `TestWebhookUpdateProperty_RunScoped` | Create a run-scoped webhook, POST a property update, verify the property value changed. |
| `TestWebhookUpdateProperty_PlaybookScoped` | Create a playbook-scoped webhook, POST with a `playbook_run_id`, verify the property value changed. |
| `TestWebhookUpdateProperty_ByName` | POST using `property_name` instead of `property_field_id`, verify resolution and update. |
| `TestWebhookUpdateProperty_ByNameCaseInsensitive` | POST with different casing in `property_name`, verify it still resolves. |
| `TestWebhook_PlaybookScopedWrongRun` | Playbook-scoped webhook, POST with a run from a different playbook, expect `403`. |
| `TestWebhook_RunScopedIgnoresRunID` | Run-scoped webhook, POST with a different `playbook_run_id`, verify it uses the webhook's run. |
| `TestWebhook_CreatorPermissionRevoked` | Remove creator's permissions, POST, expect `403`. |
| `TestWebhook_DeletedWebhook` | Delete a webhook, POST to it, expect `404`. |
| `TestWebhook_FinishRunCleansUp` | Create run-scoped webhook, finish the run, POST, expect `404`. |
| `TestWebhook_FinishRunKeepsPlaybookScoped` | Create playbook-scoped webhook, finish a run, verify the webhook still works for other runs. |
| `TestWebhookSlashCreate` | Execute `/playbook webhook create`, verify webhook exists in store. |
| `TestWebhookSlashList` | Create webhooks, execute `/playbook webhook list`, verify output. |
| `TestWebhookSlashDelete` | Create a webhook, execute `/playbook webhook delete`, verify it's gone. |
| `TestWebhook_ConditionTriggered` | Set up a condition on a property, POST via webhook, verify condition fires. |

### Acceptance Criteria

- [ ] All test cases listed above pass.
- [ ] Tests cover the full request-response cycle through the HTTP layer.
- [ ] Tests verify that property side effects (conditions, timeline, WebSocket)
      fire as expected.

---

## Implementation Tracker

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Data model and store | Done |
| 2 | HTTP endpoint | Done |
| 3 | Slash commands | Done |
| 4 | Run finish auto-cleanup | Done |
| 5 | Integration testing | Done |
