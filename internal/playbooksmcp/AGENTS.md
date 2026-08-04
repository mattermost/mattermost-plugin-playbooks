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

## Assigning a task requires enabling invites

The server rejects a playbook whose assignees aren't invited
(`ValidatePreAssignment`). When a tool sets an `assignee_id` on a template task, it
must also add that user to `invited_user_ids` and set `invite_users_enabled = true`
(see `ensurePlaybookInvitesUser`). This flips a playbook-wide setting as a side
effect — mention it in the tool's success message so it isn't silent.

## Tool description conventions

- State that indexes are zero-based.
- Include a concrete JSON example of the arguments.
- For destructive tools, tell the model to confirm indexes first.

## Testing

- Use `testify` (`require`/`assert`) — never `t.Fatalf`/`t.Errorf` for value checks.
- Drive handlers through the `fakeAPIClient` fake; assert both the GET and PUT
  endpoints and that unrelated fields survive the round-trip (see the
  `*_test.go` preservation tests in `tools/`).
- Cover the out-of-range / no-op / validation-error paths, and assert that no
  mutating call (PUT/POST/DELETE) happens when validation fails.
