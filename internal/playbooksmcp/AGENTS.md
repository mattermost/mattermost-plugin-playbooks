# Agent Instructions (internal/playbooksmcp/)

These are the MCP tools exposed to AI agents (Playbooks MCP server). Tool handlers
live in `tools/`. Read this before adding or changing a tool — the points below are
recurring review findings, not style preferences.

## Don't make the model guess IDs or indexes

Every tool that takes a `run_id`/`playbook_id` plus zero-based `checklist_number` /
`item_number` must assume the model does **not** already know them.

- **Provide a discovery path.** Before shipping an index-based tool, make sure there
  is a tool that lets the model *find* the target and its indexes (for runs:
  `resolve_channel_context`, `find_checklist_item`). If you add index-based tools for
  a new object (e.g. playbook templates) and no listing/inspection tool exists for it,
  add one too — otherwise the model can only guess.
- **Point to it in the description.** Mutating tool descriptions must tell the model
  what to call first when it doesn't know the indexes (see the `check_item` /
  `add_checklist_item` descriptions in `checklist.go`).
- **Fetch-first + actionable errors.** Fetch the object and bounds-check indexes
  before mutating. On an out-of-range index, return an error that **lists the actual
  checklists/items** so the model can self-correct — do not return a bare
  `"index N is out of range"`. For **destructive** tools, never delete before the
  bounds check passes.
  - *Run-based tools* (`run_id`, endpoints under `runs/{id}/...`): reuse the
    `fetchRunForBounds` / `checkChecklistIndex` / `checkItemIndex` / `outOfRangeError`
    helpers in `tools/checklist.go`. These operate on `playbookRunDetail` and are
    **run-only** — do not use them for `playbook_id` or template indexes.
  - *Template tools* (`playbook_id`): there is no shared helper yet — the run helpers
    don't apply because a template is fetched as a raw `map[string]any` (see the
    GET → mutate → PUT section below), not a typed `playbookRunDetail`. Apply the same
    pattern by hand: GET the playbook, read `checklists` (and each checklist's `items`)
    from the map, validate `checklist_number` / `item_number` against their real
    lengths, and on a miss return an error naming the `playbook_id` and listing the
    available checklists/items. If you add more than one template tool, factor these
    checks into template-specific helpers rather than reaching for the run ones.

## `due_date` is relative for templates, absolute for runs

`ChecklistItem.DueDate` means different things by context
(`server/app/playbook.go`: "Playbook can have only relative timestamp, run can have
only absolute timestamp").

- **Run** item due dates: absolute Unix timestamp in ms (epoch). e.g. `1717200000000`.
- **Playbook template** task due dates: a **relative offset** in ms from run start.
  e.g. `86400000` = 1 day after the run begins.

Word each tool's `due_date` jsonschema for its context. Never describe a template
due date as a "Unix timestamp" — the model will send an epoch value and produce a
~50,000-year offset.

## Mutating a playbook template = full GET → mutate → PUT

The Playbooks REST API has no granular per-task endpoint for templates (unlike runs,
which have `/checklists/{i}/item/{j}/...`). To change one task:

1. `GET playbooks/{id}` into a raw `map[string]any` (not the typed struct).
2. Mutate only `checklists`; leave every other key untouched.
3. `PUT playbooks/{id}` with the whole map back.

Keep it a raw-map passthrough — do **not** reconstruct a `Playbook` struct, or you'll
silently drop fields the server round-trips (custom fields, metrics, condition IDs,
task state, etc.). The server re-preserves its own managed fields (`NextRunNumber`,
`AdminOnlyEdit`, `ChannelNameTemplateLocked`) and assigns item IDs itself, so you do
not need to generate item IDs.

Mutate **only the keys the caller asked to change** — `update_playbook` writes `title`
and/or `description` and nothing else. The API offers no optimistic concurrency here,
so an edit landing between the GET and the PUT is lost; the same applies to the
run-side read-modify-write in `edit_checklist_item`, which must re-send
`title`/`description`/`command` together because the server's `itemEdit` replaces all
three unconditionally. Every such tool needs a preservation test.

## Assigning a task requires enabling invites

The server rejects a playbook whose assignees aren't invited
(`ValidatePreAssignment`). When a tool sets an `assignee_id` on a template task, it
must also add that user to `invited_user_ids` and set `invite_users_enabled = true`
(see `ensurePlaybookInvitesUser`). This flips a playbook-wide setting as a side
effect — mention it in the tool's success message so it isn't silent.

## A playbook is a template; a run is an instance of it

Users conflate the two constantly — "start the incident playbook" means "create a run
from the incident playbook template". Every tool name, description, and error message
must make the distinction unambiguous:

- Say "playbook template" and "playbook run" rather than a bare "playbook".
- Template tools point at their run counterpart and vice versa (`add_playbook_task` ↔
  `add_checklist_item`, `add_playbook_section` ↔ `add_section`, `update_playbook` ↔
  `update_run`).
- `run_playbook` is the one tool that crosses the boundary. Anything that could be read
  as "start a playbook" must route the model there — `create_playbook` explicitly says
  it creates a template and does *not* start anything.

## Tool description conventions

- **The description is retrieval text, not just usage text.** Agents defaults
  `MCPDynamicToolLoading` to true, so the model does not see the tool list: it calls
  `search_tools`, which BM25-ranks over `name + bare name + description` and returns the
  description as the result summary (`mcp/dynamic_registry.go`, `mcp/meta_tools.go` in
  mattermost-plugin-agents). A tool whose description omits the words a user would say
  is unfindable no matter how good its schema is. So:
  - Include the user's vocabulary verbatim, including the quoted phrasings — "start the
    X playbook", "mark that task done", "close the incident", "who's on this run".
  - Front-load them in the first sentence, and keep each description a single paragraph
    with no newlines. Nothing truncates today, but the opening words carry the most
    retrieval weight and are what a reader skims.
  - Say what the tool acts on (a run or a template) in that first sentence. Don't open
    with "This tool …" or defer the keywords to a later sentence.
- State that indexes are zero-based.
- Include a concrete JSON example of the arguments.
- For destructive tools, tell the model to confirm indexes first.
- Name the discovery tool to call when an ID or index is unknown.

## Every run/playbook API error goes through the wrapping helpers

The Playbooks API answers **403 "Not authorized" for an object that does not
exist** as well as one the caller may not see. Passed through raw, a model that
mistypes one character of a run_id reads a permission wall and abandons the task
— this was observed in an eval run. So never return a bare API error from a call
that takes a caller-supplied `run_id` or `playbook_id`:

- Wrap with `wrapRunError(err, runID, action, hints...)` or
  `wrapPlaybookError(...)` in `tools/apierror.go`. On 403/404 they name both
  possibilities and the discovery tool to call (`resolve_channel_context` /
  `list_runs`, or `list_playbooks` with `with_archived=true`); on anything else
  they stay terse. `action` is a verb phrase ("finish", "post a status update
  to"), and `hints` carry tool-specific causes worth adding.
- This applies to **mutations that never fetch first** (`finish_run`,
  `follow_run`, `update_run_status`, …) just as much as to the fetch helpers —
  those are exactly where the ambiguity reaches the model unmediated.
- `isUnknownOrForbidden` recovers the status by parsing the error text, because
  `APIClient` passes plain errors. Both implementations format failures as
  `API error (status %d)`; if that ever changes, `apierror_test.go` fails.

## Report the index a mutation just created

A tool that creates an indexed object must say where it landed, or the model
guesses the index for its next call and fails (observed with `add_section` →
`add_checklist_item`). Both run-side add endpoints **append**:
`AddChecklist` and `AddChecklistItem` in `server/app/playbook_run_service.go`.

- `add_checklist_item` reads the pre-add item count from the bounds fetch it
  already does. Capture it *before* the POST, not after.
- `add_section` has no prior fetch and the endpoint returns 201 with no body, so
  it reads the run back afterwards and reports `len(checklists)-1` plus every
  section's index via `writeRunSectionIndexes`. A failed read-back must still
  report success — the section exists by then.
- Tools that create a whole run (`run_playbook`, `create_checklist`) render the
  resulting checklist indexes too, so no follow-up `get_run` is needed.

## Render results, don't dump JSON

Tool output is model input, so it competes for context. Do not `json.MarshalIndent` an
API response into the result (`get_run` used to, and buried the checklist indexes in
several KB of internal fields). Render a compact, structured summary instead:

- Lead with identity (name, ID, and the human-facing run number when present), then
  status, then the fields that enable the next action.
- Render run checklists through the shared `[checklist_number][item_number]` notation
  so indexes match `writeRunChecklists` in `resolve.go` and stay consistent across
  tools; `writeRunChecklistsVerbose` in `runs.go` is the detailed variant.
- Summarize collections that are large and rarely needed — report the count and name
  the tool that reads them (status posts → `get_status_updates`, timeline events → not
  exposed) rather than inlining them.
- Surface fields whose absence would mislead: an item assigned by role or property has
  an empty `assignee_id` and looks unassigned unless `assignee_type` /
  `assignee_property_field_id` are rendered too.

## Client interface additions

`tools.APIClient` (`tools/provider.go`) is implemented three times: `pluginMCPClient`
in `server/mcp.go`, the eval harness client under `server/`, and `fakeAPIClient` in
`tools/checklist_test.go`. Adding a method means updating all three, so keep signatures
stable once added. Current URL helpers mirror the webapp routes:
`GetPlaybookURL` → `/playbooks/playbooks/{id}`, `GetRunURL` → `/playbooks/runs/{id}`
(matching `app.GetRunDetailsRelativeURL`).

`ResolveUserID` is the one method whose semantics live in the implementations rather
than in the tools layer, and all three must agree: `me` → the acting user, a valid
26-character ID → returned unchanged, anything else → a case-folded username lookup with
one optional leading `@` stripped. `pluginMCPClient` takes the lookup itself as a
`usernameResolver` func injected by `newPlaybooksMCPServer` (backed by
`pluginAPI.User.GetByUsername`), which keeps the server constructible in tests; a nil
resolver reports "user lookup unavailable" instead of panicking.

## User references: always `resolveUserRef`, never `validateID`

People are the one kind of object a model usually knows by name rather than by ID:
"add @bob to this run" is the canonical phrasing, and a tool that only takes a
26-character ID leaves the model stuck (Anthropic models invent a user-lookup tool that
does not exist). So **every argument that names a user goes through
`resolveUserRef(ctx, client, ref, field)`** — `tools/users.go` — and none of them is
validated with `validateID`. Lists use `resolveUserRefs`, which also reports the failing
index and deduplicates references that landed on the same user.

`resolveUserRef` delegates to `APIClient.ResolveUserID`, which accepts `me`, a raw ID
(returned as-is, no lookup), or a username with or without a leading `@`. The empty
string stays empty so callers can distinguish "not provided" from a bad reference; where
an empty value means "clear the assignee", pass it through unchanged rather than
special-casing it earlier. Resolve **before** any mutation so an unknown username fails
without half-applying a change, and before `fetchPlaybookForMutation` in the playbook
tools.

Non-user IDs — team, channel, run, playbook — keep strict `validateID`. There is no
name-based lookup for those, so a loose value there is a genuine argument error.

Each user-reference `jsonschema` tag and the tool's description must both say that a
user ID, `me`, or a username (with or without `@`) is accepted; `userRefSchemaHint` in
`tools/users.go` is the canonical wording (struct tags cannot reference it, so it is
spelled out at each site).

`list_runs`' `owner_user_id` and `participant_id` are resolved client-side even though
the list endpoint understands `me` itself (`parsePlaybookRunsFilterOptions`), so
usernames work there too and the convention has no exceptions.

## Run participants

`POST runs/{id}/participants` takes `{"user_ids": [...], "force_add_to_channel": bool}`
and `DELETE runs/{id}/participants/{user_id}` removes one user, who also stops
following the run. A user acting on themselves only needs `RunView` (joining and
leaving), while acting on anyone else needs `RunManageProperties` on an active run. The
run's owner cannot be removed — `remove_run_participant` fetches the run and says to
call `change_run_owner` first rather than letting that surface as a bare 400.

## Testing

- Use `testify` (`require`/`assert`) — never `t.Fatalf`/`t.Errorf` for value checks.
- Drive handlers through the `fakeAPIClient` fake; assert both the GET and PUT
  endpoints and that unrelated fields survive the round-trip (see the
  `*_test.go` preservation tests in `tools/`).
- Cover the out-of-range / no-op / validation-error paths, and assert that no
  mutating call (PUT/POST/DELETE) happens when validation fails.
- Assert the HTTP verb, not just the path: several tools differ only by method
  (`PUT`/`DELETE` on `runs/{id}/followers`, `PATCH` on `runs/{id}`), so a test that only
  checks the endpoint would pass against the wrong call. The fake records each verb in
  its own field, so check `putEndpoint` / `patchEndpoint` / `deleteEndpoint` specifically.
- **Add every new tool to `TestEveryToolIsRegistered`** in `provider_test.go`. The other
  tests call handlers directly, so a tool that is implemented but never wired into
  `addMCPHelper*Tools` is invisible to the model and otherwise passes CI. That test also
  asserts the registered count, so it fails until the new tool is listed.
  `TestToolDescriptionsFollowRetrievalConventions` then enforces the description rules
  above across every tool.
