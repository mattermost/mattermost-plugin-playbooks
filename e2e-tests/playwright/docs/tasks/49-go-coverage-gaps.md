# Task 49: Go coverage audit for Cypress API-only tests (report only, no Go changes)

**Task id**: `go-coverage-gaps` · **Kind**: report

## Target

- `e2e-tests/playwright/docs/tasks/go-coverage-gaps.result.md`

## What to do

**Audit only. Hard rule: no Go file may change, and no code changes at all.** The output is one Markdown report.
For each listed Cypress API-only test, find the equivalent assertion in `server/api_*_test.go`, `server/app/*_test.go`, `server/command/*`, etc. Write `e2e-tests/playwright/docs/tasks/go-coverage-gaps.result.md` with a table: `cypress spec > test | covered by (file:TestFunc/subtest) | status: COVERED / PARTIAL / GAP | note`.
- COVERED: the Cypress test can be retired without replacement.
- PARTIAL / GAP: it must NOT be silently dropped. Pick one: (a) a Playwright task in `docs/todo.json` can cover it through the UI; name the task, and add the item to that task's doc under `## Added by go-coverage-gaps`. Or (b) list it under `## Follow-ups (outside the migration)` as a proposed Go test (file + test name + what to assert) for humans to schedule. In that case `retire-cypress` keeps the Cypress spec.
Likely gaps to check carefully: import rejects an unsupported `version` / a payload with `id`; round-trip remaps condition IDs; `channel_name_template_locked` defaults to false and a locked template ignores the client-supplied name; clearing template + prefix in one PATCH; prefix normalization `ABC-` -> `ABC`; `/playbook test` argument validation.

## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Definition of done

1. `git status` shows only the new report file (and appended `## Added by go-coverage-gaps` sections in task docs, if any).
2. Every listed Cypress test appears in the report table with a status.
3. `e2e-tests/playwright/docs/quality.sh` prints `QUALITY: PASS`.

## Cypress coverage (sources)

Scope column says which part of each source spec belongs to THIS task. The excerpt below is the full inventory of that spec; ignore the parts outside the scope.

| Cypress spec | Scope for this task |
|---|---|
| `e2e-tests/cypress/tests/integration/playbooks/api/runs_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/api/graphql_errors_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/api/property_fields_graphql_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/export_import_spec.js` | API export/import tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/new_channel_enforcement_spec.js` | API contract tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/sequential_id_spec.js` | API-only tests |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/run_naming_spec.js` | API-only tests (unlocked default, clearing both fields, prefix normalization) |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_template_spec.js` | backend ignores client-supplied name when locked (x2) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/owner_only_finish_spec.js` | restore via API (x3), direct PUT finish 403 |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/owner_group_only_actions_toggle_spec.js` | mid-run toggle, no grandfathering |
| `e2e-tests/cypress/tests/integration/playbooks/runs/role_based_assignment_spec.js` | owner/creator resolution at creation |
| `e2e-tests/cypress/tests/integration/playbooks/channels/general_actions_spec.js` | MM-58432 ignore-thread IDOR |
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/dm_checklist_spec.js` | rejects run in DM; moving populates team_id |
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/gm_checklist_spec.js` | rejects run in GM; moving populates team_id |
| `e2e-tests/cypress/tests/integration/playbooks/channels/slash_command/test_spec.js` | argument validation matrix |

### `api/runs_spec.js`

> Scope: all tests

- **Area**: REST API > run creation validation + run/channel permission checks
- **Setup**: team/user, one public playbook (`createPublicPlaybookRun: true`); some sub-suites create a second user and a private channel/playbook via API. No UI involved.
- **Tests**:
  - `creating a run > in an existing, public channel > with no team_id specified` — `apiRunPlaybook` into existing public channel without team_id succeeds (201) and returned run has correct owner/reporter/team/channel/playbook ids.
  - `creating a run > in an existing, public channel > with correct team_id specified` — same but with explicit correct team_id, succeeds (201) with correct fields.
  - `creating a run > in an existing, public channel > with wrong team_id specified` — wrong team_id returns 400 with error 'unable to create playbook run'.
  - `creating a run > in an existing, private channel > with no team_id specified` — same as public-channel case but private channel, succeeds (201).
  - `creating a run > in an existing, private channel > with correct team_id specified` — succeeds (201) with correct team_id.
  - `creating a run > in an existing, private channel > with wrong team_id specified` — wrong team_id returns 400.
  - `creating a run > in an existing, private channel, of which the user is not a member` — user removed from private channel gets 403 when trying to run playbook into it.
  - `creating a run > in a channel with an existing playbook run` — running a second playbook into a channel that already has an active run returns 400 'unable to create playbook run'.
  - `channel permission checks > GET /runs/channel/{channel_id} > should return 403 for user without channel access` — non-member user hitting runs-by-channel endpoint on private channel gets 403.
  - `channel permission checks > GET /runs/channel/{channel_id} > should succeed for user with channel access` — member user gets 200.
  - `channel permission checks > GET /runs/channel/{channel_id}/runs > should return 403 for user without channel access` — non-member gets 403 on the `/runs` sub-route variant.
  - `channel permission checks > GET /runs/channel/{channel_id}/runs > should succeed for user with channel access` — member gets 200.
  - `channel permission checks > GET /runs with channel_id filter > should return 403 for user without channel access` — non-member querying `/runs?channel_id=` gets 403.
  - `channel permission checks > GET /runs with channel_id filter > should succeed for user with channel access` — member gets 200.
  - `channel permission checks > unfollow permission check > should return 403 for user without RunView access` — non-member of private playbook/run gets 403 on DELETE `/runs/{id}/followers` (unfollow).
  - `channel permission checks > unfollow permission check > should succeed for user with RunView access` — owner who first follows the run can successfully DELETE followers (unfollow), gets 200.
- **Notes**: fully API-only, no UI; could be considered REST permission/authorization regression suite rather than feature behavior.

### `api/graphql_errors_spec.js`

> Scope: all tests

- **Area**: GraphQL API > error handling
- **Setup**: single test user, logged in; direct `cy.request` to GraphQL endpoint (no UI).
- **Tests**:
  - `api > graphql_errors > return a generic error` — POSTing a malformed GraphQL query (`query poc { __typename @a@a@a }`) to `/plugins/playbooks/api/v0/query` returns a single error with generic message "Error while executing your request".
- **Notes**: purely API-only test, no UI interaction.

### `api/property_fields_graphql_spec.js`

> Scope: all tests

- **Area**: GraphQL API > playbook property fields (schema/introspection + CRUD mutation structure validation)
- **Setup**: admin-promoted user + team, one playbook with the user as member; all tests are raw `cy.request` calls to `/plugins/playbooks/api/v0/query`, no UI.
- **Tests**:
  - `GraphQL Schema Introspection > should verify GraphQL schema includes property field operations` — introspection query confirms `playbookProperty` query and `addPlaybookPropertyField`/`updatePlaybookPropertyField`/`deletePlaybookPropertyField` mutations exist in schema.
  - `GraphQL Schema Introspection > should verify PropertyFieldType enum exists and has correct values` — introspects `PropertyFieldType` enum and checks it includes text/select/multiselect/date/user/multiuser.
  - `GraphQL Schema Introspection > should verify PropertyFieldInput type structure` — introspects `PropertyFieldInput` input type and checks it has name/type/attrs fields.
  - `GraphQL Operation Validation > should validate PlaybookProperty query structure` — sends a `playbookProperty` query with a non-existent property id and asserts no syntax/unknown-field errors (data-not-found is acceptable).
  - `GraphQL Operation Validation > should validate AddPlaybookPropertyField mutation structure` — sends `addPlaybookPropertyField` mutation with a select-type field and asserts no syntax/unknown-field/unknown-argument errors.
  - `GraphQL Operation Validation > should validate mutation argument structures` — introspects `Mutation` type fields, filters for PropertyField mutations, and asserts each has `playbookID` arg plus `propertyField`/`propertyFieldID` args as appropriate.
  - `PropertyField Type System > should support all PropertyFieldType enum values` — for each of text/select/multiselect/date/user/multiuser, sends `addPlaybookPropertyField` mutation and asserts no type-validation errors (Invalid value/Expected type/Unknown enum value).
  - `Main Playbook Query with PropertyFields > should validate Playbook query includes propertyFields field` — queries `playbook(id)` with nested `propertyFields` and asserts the field exists (array), fails test if schema reports "Cannot query field"/"Unknown field".
  - `Main Playbook Query with PropertyFields > should verify propertyFields array structure in Playbook query` — introspects `Playbook` type and checks `propertyFields` field type is `NON_NULL` wrapping a `LIST`.
  - `PropertyFields Integration Flow > should test full integration flow: create field -> query playbook -> verify consistency` — end-to-end: creates a select property field via mutation, queries it back via bulk `playbook.propertyFields`, then via individual `playbookProperty` query, and asserts all three representations are consistent (id/name/type/attrs/options).
- **Notes**: entirely API-only (GraphQL), no UI assertions; several tests use soft/conditional assertions (`if (response.body.errors)` branches with only logging) rather than hard failures, so they can silently pass without validating much when introspection is disabled.

### `playbooks/export_import_spec.js`

> Scope: API export/import tests

- **Area**: playbook export/import (attributes & conditions)
- **Setup**: API-created playbooks with text/select property fields and conditions; team/user from `apiInitSetup`.
- **Tests**:
  - `API export > exports playbook without attributes or conditions` — API `cy.apiExportPlaybook`: export omits `id`, `team_id`, `properties`, `conditions` when none present.
  - `API export > exports playbook with attributes included` — API: export includes text and select property fields with options.
  - `API export > exports playbook with attributes and conditions` — API: export includes `properties`, `conditions` (with `condition_expr`), and checklist item `condition_id` linkage.
  - `API import > round-trip: export then import preserves attributes` — API: re-import into same team recreates property fields with new IDs, same names/types.
  - `API import > round-trip: export then import preserves conditions and task linkage` — API: re-import remaps condition IDs and checklist item `condition_id` while preserving linkage.
  - `API import > exports new_channel_only=true in the export payload` — API: `new_channel_only` flag included in export.
  - `API import > round-trip: export then import preserves new_channel_only=true` — API: re-import preserves `new_channel_only=true`.
  - `API import > round-trip: reimporting into the same team resolves a colliding run number prefix` — API: colliding `run_number_prefix` resolved to suffixed variant (`API-NUM-2`) on reimport.
  - `API import > rejects import with unsupported version` — API: POST import with `version: 999` returns 400.
  - `API import > rejects import with playbook ID set` — API: POST import payload containing `id` field returns 400.
  - `UI import with attributes > imports playbook with attributes via drag-and-drop` — playbooks list: drag-and-drop JSON export file onto list opens playbook editor with imported attributes (2 property-field-rows).
  - `UI import with attributes > imports playbook with attributes via file input` — playbooks list: file-input import of export JSON shows imported select attribute with its options (P1/P2/P3).
  - `UI import with attributes > imports playbook with conditions and verifies task linkage in UI` — playbooks list + playbook editor Outline: imported condition shown in `condition-header` linked to task.
  - `UI import with run number prefix > resolves a colliding run number prefix on reimport into the same team` — playbooks list + playbook editor channel-access: UI import resolves colliding `run_number_prefix` to suffixed value shown in input field.
- **Notes**: Several "API export/import" tests are pure API tests (no UI). `cy.wait(500)` used elsewhere but not in this file.

### `runs/new_channel_enforcement_spec.js`

> Scope: API contract tests

- **Area**: run creation (UI modal + API + slash-command path) > `new_channel_only` playbook flag enforcement
- **Setup**: `apiInitSetup` team/user; playbooks created per test with `new_channel_only=true/false` via API; viewport macbook-13; cleanup archives created playbooks in `afterEach`.
- **Tests**:
  - `UI run start succeeds when NewChannelOnly=true (modal always creates new channel)` — run modal (`cy.playbooksStartRunViaModal`) + RDP + API: starting a run via UI modal creates a new channel; RDP header shows run name; API confirms channel_id set and playbook still has flag true.
  - `API contract: backend rejects run with existing channel when NewChannelOnly=true` — API: `apiRunPlaybook` with explicit `channelId` on a `new_channel_only=true` playbook returns 400; no run created with that channel.
  - `API contract: flag=true allows run creation without channel_id` — API: run creation without `channelId` succeeds, gets a new real channel.
  - `API contract: flag=false allows run creation with existing channel` — API: playbook with `new_channel_only=false` and `channelMode: link_existing_channel` allows run creation with explicit `channelId`, run's `channel_id` matches.
  - `UI run start also works without specifying a channel (new channel mode) when flag=false` — run modal + RDP + API: starting run via UI without specifying a channel on a flag=false playbook still creates a new channel successfully.
  - `slash command dialog enforcement > API: new_channel_only is set on the slash command playbook` — API: confirms flag persisted true (setup verification only).
  - `slash command dialog enforcement > API rejects run with existing channel_id when new_channel_only=true (slash command playbook)` — API: `apiRunPlaybook` with `channelId` rejected (400) for playbook intended to be driven by slash command dialog.
  - `slash command dialog enforcement > API: run creation without channel_id succeeds for new_channel_only playbook` — API: run creation without channel_id succeeds, mirroring what slash-command dialog would submit.
- **Notes**: Most tests are explicitly "API contract" tests (comments note UI slash-command dialog isn't driven in this spec, only its equivalent API behavior is verified) — heavy overlap potential with `start_run_new_channel_only_spec.js` which covers the same flag's UI modal radio/toggle behavior from the playbook editor side.

### `runs/sequential_id_spec.js`

> Scope: API-only tests

- **Area**: Run sequential ID / configurable prefix (`run_number_prefix`) — backstage list, RDP RHS info, channel RHS, playbook editor, `{SEQ}` template token
- **Setup**: Playbooks created/archived per test with varying `run_number_prefix`; some tests create a 2nd team. Uses helper utils `formatSequentialID`, custom commands `playbooksAssertSequentialIdInList`, `playbooksGetRunListRow`, `playbooksVisitRun`, `playbooksVisitRunChannel`, `playbooksVisitEditor`, `playbooksInterceptPatchPlaybook`, `assertRunNameResolved`.
- **Tests**:
  - `shows sequential IDs with configured prefix for runs in the list` — backstage runs list (`playbookRunList`) shows each run's sequential ID (e.g. "INC-00001") next to its name; backend `sequential_id` verified via API too.
  - `shows sequential ID badge as bare number when no prefix is configured` — backstage list shows bare zero-padded number badge (`run-sequential-id`) when playbook has no prefix.
  - `changing the prefix after runs exist keeps existing run IDs frozen` — API: changing playbook's `run_number_prefix` after a run exists doesn't alter that run's already-assigned `sequential_id`; next new run continues the counter with new prefix.
  - `prefix can be changed before any runs exist and affects all subsequent runs` — API: prefix mutable with no runs yet; run created picks up latest prefix at creation time; backstage list (`run-sequential-id`) shows the frozen prefix even after a later prefix change.
  - `{SEQ} token in run name template resolves using the current prefix` — `channel_name_template` with locked `{SEQ}` token resolves using prefix active at run creation time; later prefix change doesn't retroactively affect first run's resolved name, new run uses new prefix.
  - `shows sequential ID in run details info panel` — RDP RHS info panel shows `run-sequential-id` testid with formatted ID.
  - `allows the same prefix on different teams` — API: same `run_number_prefix` can be set on playbooks in two different teams without conflict.
  - `rejects a duplicate run_number_prefix on the same team` — API: setting a duplicate prefix on a 2nd playbook in the same team returns 409.
  - `shows an error toast when a duplicate prefix is entered in the editor` — Playbook editor "outline" tab: typing a duplicate prefix into `channel-access-run-number-prefix` input triggers debounced PATCH, backend 409 shown as a specific error toast text, and input reverts to empty.
  - `shows sequential ID next to playbook name in channel RHS` — channel RHS shows `run-sequential-id` testid with formatted ID next to playbook/run name.
- **Notes**: Good practice overall (random IDs/prefixes to avoid collisions, cleanup in afterEach, `cy.intercept`/`cy.wait('@alias')` for the toast test). Several tests are pure API-level sequential-id logic validation with only a final UI assertion.

### `playbooks/edit/run_naming_spec.js`

> Scope: API-only tests (unlocked default, clearing both fields, prefix normalization)

- **Area**: playbook editor > outline > Actions > run naming (run number prefix, channel/run name template, lock checkbox, SEQ/OWNER/CREATOR tokens, sequential ID resolution)
- **Setup**: single shared playbook reset via `cy.apiPatchPlaybook` before each test (`run_number_prefix`, `channel_name_template`, `channel_name_template_locked` cleared); viewport macbook-13; uses `cy.playbooksVisitEditor`, `cy.playbooksInterceptPatchPlaybook`, `cy.assertRunNameResolved`, `cy.playbooksGetRunIdFromUrl`.
- **Tests**:
  - `playbooks > edit > run naming > shows run naming fields inside the Actions section` — run-number-prefix input and run-name-template input both exist in Actions.
  - `... > shows the "Lock run name" checkbox, unchecked by default` — with a valid template set, "channel-access-run-name-template-locked" checkbox exists, enabled, unchecked.
  - `... > checking the lock checkbox persists after reload` — checking the lock box saves (intercepted PATCH), persists `channel_name_template_locked: true` via API and after reload.
  - `... > defaults a template playbook to unlocked when created via raw REST without the flag` — a playbook created via raw API without the lock flag defaults to `channel_name_template_locked: false`.
  - `... > allows locking a literal template and persists after reload` — same lock-persistence check using a literal (non-token) template string.
  - `... > saves prefix and template values and shows preview` — setting prefix via API + typing template shows live preview (`INC-...Incident-Report`), both persist after reload.
  - `... > preserves UI-typed prefix after a later template edit triggers a GraphQL refetch` — regression test: typing prefix via UI then editing template (triggering GraphQL `updatePlaybook` refetch) must not wipe the previously-saved prefix value.
  - `... > shows a warning when template references an unknown field` — typing an unrecognized `{UnknownField}` token shows a `channel-access-run-name-template-warning` containing "UnknownField"; server would reject it on save (not persisted).
  - `... > persists prefix and template values set via API and shows them in editor` — prefix/template set via API load correctly into editor inputs.
  - `... > run started from a locked playbook with SEQ template gets the resolved sequential ID in its name` — with locked SEQ-prefixed template, the "Run playbook" modal's run-name input is read-only and shows raw template with a resolved preview; starting the run yields RDP h1 and backend `run.name`/`sequential_id` reflecting resolved "SEQ-N - Convention".
  - `... > typing { in the template input opens autocomplete with SEQ, OWNER, and CREATOR tokens` — typing `{` opens suggestions list showing the three built-in tokens.
  - `... > shows an insert variable button next to the template input` — "insert-variable" button exists with tooltip "Insert variable".
  - `... > clicking insert variable button and selecting a token inserts it into the template` — clicking the button + selecting `{OWNER}` appends token to existing template text and persists via API.
  - `... > insert variable appends token at end when template already has content` — duplicate/confirmation of append-at-end behavior and persistence.
  - `... > handles prefix with special characters gracefully` — prefix `'ABC-'` gets normalized server-side to `'ABC'` (trailing dash trimmed); run creation succeeds with `sequential_id` containing "ABC-".
  - `... > uses prefix-only template when no run name template is set` — with prefix set but no name template, run keeps the explicitly provided run name (`assertRunNameResolved`).
  - `... > template using {SEQ} shows a warning when no run number prefix is set` — typing `{SEQ}` with empty prefix field shows the unknown/invalid warning.
  - `... > template editor shows property field names as valid (no unknown-field warning)` — regression test: a template referencing a real custom property field name ("Zone") shows no unknown-field warning.
  - `... > clearing both channel_name_template and run_number_prefix in a single update succeeds` — API-only test: PATCH clearing both fields together persists empty values for both (not a UI assertion).
- **Notes**: Several tests are effectively API/regression tests embedded in a UI spec (e.g. "defaults a template playbook to unlocked...", "handles prefix with special characters...", "clearing both ... in a single update succeeds") with minimal/no UI interaction; extensive inline comments documenting specific regressions being guarded against (stale REST cache vs GraphQL refetch, property-field name resolution).

### `playbooks/start_run_template_spec.js`

> Scope: backend ignores client-supplied name when locked (x2)

- **Area**: run-creation modal > run name templating (locked/unlocked `channel_name_template`) with `{TOKEN}` resolution
- **Setup**: `apiInitSetup` team/user; various playbooks per describe block configured via `apiPatchPlaybook` with `channel_name_template` / `channel_name_template_locked`, some with property fields; viewport macbook-13; archives playbooks in `afterEach`.
- **Tests**:
  - `name field is not required when template is locked > submit button is enabled even when name input shows template (no required fields)` — run modal: locked `{OWNER}` template makes run-name input readonly and prefilled; submit enabled with no required fields.
  - `... > creates the run using the template's resolved value, since the field is read-only` — run modal + API: submitting resolves `{OWNER}` token server-side, run name has no literal token and is non-empty.
  - `... > backend ignores a client-supplied name and uses the template when locked` — API only (`apiRunPlaybook`): posting a differing `playbookRunName` is ignored server-side when template is locked; resolved name used instead.
  - `name field is required when template exists but override is allowed (default) > shows an editable name field prefilled with the template and its resolved preview` — run modal: unlocked template shows editable input prefilled with raw template text and a `run-name-preview` showing resolved value; submit enabled.
  - `... > requires an explicit name and disables submit when the prefilled name is cleared` — run modal: clearing prefilled name disables submit.
  - `... > creates the run with the typed name, not the template` — run modal + RDP + API: typed custom run name overrides template; RDP heading and stored `run.name` match typed value.
  - `... > resolves a token typed freehand into the name, not just tokens from the template` — run modal: freehand-typed `{OWNER}` token in run-name input resolves in live preview and in stored run name.
  - `literal template locked > shows a read-only name field when locked, even for a literal template` — run modal: literal (non-token) locked template still makes name field readonly, no preview shown, submit enabled.
  - `... > creates the run using the locked template, not a client-supplied name` — API only: client-supplied run name is ignored; run created with literal locked template text.
  - `many property fields — Cancel button remains reachable > Cancel button is visible and clickable when modal shows many attribute inputs` — run modal: with 4 property-field "Attributes" inputs rendered, Cancel button remains visible/clickable and closes modal without creating a run.
  - `no-template free-text mode > shows free-text name input without "(optional)" label` — run modal: playbook without template shows plain name input, no "(optional)" label, no Attributes section, no preview.
  - `... > submit button is disabled when name is empty (no template)` — run modal: empty name disables submit when no template configured.
  - `... > submit enables and run is created when name is typed` — run modal + RDP + API: typed name enables submit; RDP and stored run both reflect typed name.
  - `template name too long > shows inline error and disables submit when resolved run name exceeds 64 characters` — run modal: 65+-char locked template produces `run-name-preview-error` mentioning "64" and disables submit.
- **Notes**: Mixes UI run-modal assertions with direct API-only assertions (`apiRunPlaybook`) within same describe blocks to validate backend enforcement independent of UI. No `cy.wait(ms)` usage; uses custom commands `cy.playbooksOpenRunModal`, `cy.playbooksGetRunIdFromUrl`.

### `runs/owner_only_finish_spec.js`

> Scope: restore via API (x3), direct PUT finish 403

- **Area**: run finish/restore permission enforcement when `owner_group_only_actions`/`ownerGroupOnlyActions` is enabled — RHS finish button, slash command, direct API, post-update modal checkbox, restart dropdown
- **Setup**: `apiInitSetup` team/owner; separate participant user; helper `setupOwnerOnlyPlaybookRun` creates playbook with `ownerGroupOnlyActions: true`, starts run with owner, adds participant; viewport macbook-13; thorough `afterEach` cleanup (finish + archive, using sysadmin since ownership may have changed).
- **Tests** (describe `without custom status field`):
  - `shows finish section in RHS to the run owner` — RHS channel view: `rhs-finish-section` visible to owner.
  - `hides finish section in RHS from non-owner participant` — RHS: finish section absent for non-owner participant (after owner-profile-selector visible, confirming RHS loaded).
  - `slash command /playbook finish returns permission error to non-owner participant` — channel slash command: `/playbook finish` as non-owner shows ephemeral error "You do not have permission to finish this run."; run remains active via API.
  - `direct REST PUT /runs/:id/finish returns 403 to non-owner participant` — API: direct PUT finish returns 403 for non-owner; run stays active.
  - `playbook admin can reassign ownership to themselves and finish the run end-to-end` — RHS: playbook admin (non-owner) cannot finish until they reassign ownership to themselves via RHS owner selector, then can finish; verifies full two-step workaround end-to-end via API.
  - `old owner cannot finish the run after ownership is reassigned to another user` — RHS: after reassigning owner via RHS, old owner loses finish section, new owner gains it.
  - `owner can finish the run end-to-end via RHS` — RHS: owner clicks Finish button, confirms modal (`playbooksConfirmFinishModal`), API confirms `current_status='Finished'`, `end_at>0`; associated channel not deleted.
  - `system admin can finish the run end-to-end even when not the owner` — RHS: sysadmin sees finish section (admin bypass) and can finish via UI, confirmed via API.
  - `playbook admin (non-owner) cannot see the finish section` — RHS: playbook admin role alone (without owner reassignment) does not grant finish visibility.
  - `creator who is not the owner cannot finish the run` — RHS: run creator (reporter) who isn't the owner cannot finish; the actual owner can.
  - `hides the "mark as finished" checkbox in the post update modal from a non-owner participant` — post-update modal (`/playbook update`): `mark-run-as-finished` checkbox absent for non-owner.
  - `shows the "mark as finished" checkbox in the post update modal to the run owner` — post-update modal: checkbox present for owner.
- **Tests** (describe `restore is owner-restricted`):
  - `owner can restore the run via API` — API: owner can `apiRestoreRun` a finished run back to `InProgress`.
  - `non-owner participant cannot restore the run` — API: non-owner restore attempt returns 403, run stays `Finished`.
  - `system admin can restore the run even when not the owner` — API: sysadmin can restore regardless of ownership.
  - `non-owner sees Restart as disabled with owner-only tooltip in the run dropdown` — RDP backstage: run header dropdown's "Restart" item is present but disabled for non-owner, with tooltip "Only the run owner can restart this run" (`cy.uiGetToolTip`).
- **Notes**: Very thorough permission-matrix spec combining RHS UI, slash command, direct API (bypassing UI), and post-update-modal checkbox visibility for the same `owner_group_only_actions` feature — complements `owner_group_only_actions_toggle_spec.js` (editor toggle) and `owner_reassignment_restriction_spec.js` (expected next file). No `cy.wait(ms)` usage; relies on custom commands for RHS/channel navigation and finish-modal confirmation.

### `playbooks/owner_group_only_actions_toggle_spec.js`

> Scope: mid-run toggle, no grandfathering

- **Area**: playbook editor > outline "owner/group only actions" toggle + run finish permission enforcement
- **Setup**: `apiInitSetup` admin user/team; playbooks created per test with `makePublic: true`; viewport macbook-13; cleanup in `afterEach` finishes/deletes any mid-run playbook/run created.
- **Tests**:
  - `persists the enabled state after a page reload` — playbook editor Outline: toggling `owner-group-only-actions-toggle` on (via confirmation modal) persists via PUT API and remains checked after reload.
  - `persists the disabled state after a page reload` — playbook editor Outline: disabling the toggle (true→false, no confirmation needed) persists via PUT API and remains unchecked after reload.
  - `toggle is not visible to non-admin playbook members` — playbook editor Outline: toggle not rendered in DOM for a `playbook_member` (non-admin) user.
  - `toggle is disabled on an archived playbook` — playbook editor Outline: toggle input is disabled when playbook is archived.
  - `toggling the flag mid-run immediately restricts and re-enables finish access — no per-run grandfathering` — API (`/runs/{id}/finish`): enabling `owner_group_only_actions` on the playbook mid-run immediately blocks (403) a non-owner participant from finishing the run, disabling it immediately restores access (200); no per-run grandfathering of old flag state.
- **Notes**: Last test is API-only (no UI assertions) despite living in a UI-focused spec file; uses custom command `cy.playbooksToggleWithConfirmation`.

### `runs/role_based_assignment_spec.js`

> Scope: owner/creator resolution at creation

- **Area**: Checklist task assignment by role (owner/creator/property-user) across playbook editor and RHS checklist
- **Setup**: 3 users (testOwner, testCreator, testNewOwner); playbooks created/archived per test with role-based `assignee_type` set via API patch; property-field-based tests use `apiCreatePlaybookWithProperties` with a user-type "Manager" field. Mostly channel/RHS surface (`playbooksVisitRunChannel`) plus playbook editor outline.
- **Tests**:
  - `task with assignee_type=owner is resolved to the run owner at creation` — API: starting a run resolves an `assignee_type=owner` task's `assignee_id` to the run owner.
  - `task with assignee_type=creator is resolved to the run creator at creation` — API: `assignee_type=creator` task resolves to the run creator (reporter), not the owner.
  - `changing run owner re-resolves owner-type tasks to the new owner` — RHS checklist: changing run owner via RHS profile selector updates an owner-type task's displayed assignee/badge and backend `assignee_id` to new owner.
  - `changing run owner does NOT re-resolve creator-type tasks` — RHS checklist: changing owner leaves creator-type task's assignee (badge "Run Creator") unchanged.
  - `manually assigned task is not re-resolved when owner changes` — RHS checklist: a task manually reassigned (overriding owner-type) via API keeps its manual assignee after an owner change.
  - `editing one task via UI does not wipe assignee_type from sibling tasks` — Playbook editor outline: editing/renaming one checklist task via UI does not clear `assignee_type` on a sibling task (regression for `useProxyState` bug).
  - `task item is accessible in the run checklist section` — RHS/run checklist: a task with role assignment is findable via `playbooksFindTaskItem` helper.
  - `switching from role assignment to a specific user clears the role > switching from role assignment to a specific user clears the role` — API reassigning a role-based task to a specific user clears `assignee_type` and shows user profile (not role badge) in RHS.
  - `switching from role assignment to a specific user clears the role > switching from role to user in the playbook editor clears assignee_type` — Playbook editor: selecting "None" role then picking a specific user via profile selector clears `assignee_type`/`assignee_property_field_id` and sets `assignee_id` (verified via GraphQL `UpdatePlaybook` mutation + API).
  - `assigning a task to a user-type property field shows the resolved user in the checklist` — RHS checklist: task with `assignee_type=property_user` bound to a "Manager" property field shows property-user badge + resolved username once run-level property value is set.
  - `changing owner in RHS preserves property_user task display` — RHS checklist: changing run owner does not affect a separate property_user-assigned task's resolved display (regression where WebSocket update wiped property_values).
  - `playbook editor shows "Run User" role option when playbook has a user-type property field` — Playbook editor task-edit dropdown (`role-options`) includes "Run User" (`property_user`) option when a user-type property field exists.
  - `playbook editor "Add a task" form shows "Run User" role option when playbook has a user-type property field` — same check in the "Add a task" new-item form's role dropdown.
  - `RHS task editor shows "Run User" role option when run has a user-type property field` — RHS checklist task-edit dropdown also includes "Run User" option when run has the property field.
- **Notes**: Several tests are primarily API/state-verification with only partial UI assertions (role resolution at creation tests are pure API checks with no UI visit). Uses custom helper commands (`playbooksVisitRunChannel`, `playbooksChangeRunOwnerViaRHS`, `playbooksFindTaskItem`, `playbooksOpenTaskAssigneeEditor`, `playbooksInterceptGraphQLMutation`) — indicates shared regression-testing utilities. Comments document two prior regressions being guarded against (sibling assignee_type wipe; property_values wiped on owner change via WebSocket).

### `channels/general_actions_spec.js`

> Scope: MM-58432 ignore-thread IDOR

- **Area**: channel > Channel Actions modal (built-in Mattermost channel actions as they interact with Playbooks: keyword-triggered "prompt to run a playbook")
- **Setup**: sysadmin-promoted user + separate regular testUser, both with CRT preference off; one action-channel; dynamically created public playbooks per test.
- **Tests**:
  - `on join trigger > channel categorization can be enabled and works` — enabling "sidebar category" channel action with a custom category name causes a joining/reloading user to see the channel under that sidebar category (not a Playbooks-specific feature, baseline for next tests).
  - `on join trigger > welcome message can be enabled and is shown to a joining user` — enabling temporary welcome message channel action shows the ephemeral message to a joining/reloading user (not Playbooks-specific).
  - `keyword trigger > prompt to run playbook can be enabled and works` — setting a keyword trigger + "Prompt to run a playbook" action with a selected playbook causes a bot post prompting to run that playbook when the keyword is posted in channel; clicking 'Yes, run playbook' opens the start-run dialog and starting it shows the run name in the RHS.
  - `keyword trigger > deletes the post and ignores the thread when clicking on No, ignore thread` — clicking 'No, ignore thread' on the bot prompt post deletes that bot post, and replying to the original thread with the same trigger phrase does not re-trigger a new prompt.
  - `keyword trigger > MM-58432 - prevents users from deleting an arbitrary post by crafting a query` — calling the `signal/keywords/ignore-thread` API directly with an arbitrary (non-bot) post_id does not delete that post; same API call with the actual bot prompt post_id does delete it (regression/security test for an IDOR-style vulnerability).
  - `keyword trigger > disabled triggers do not run even with a keyword set` — configuring a keyword but leaving "Prompt to run a playbook" toggled off means posting the keyword produces no bot prompt.
  - `action settings are reset to the default when switching to a channel with no actions configured` — after enabling a channel-categorization action in one channel, switching to a different channel with no configured actions shows the Channel Actions modal with action disabled/default (not leaking state across channels).
- **Notes**: several tests (on join trigger suite) test core Mattermost channel actions unrelated to Playbooks-specific behavior except as setup for the playbook-trigger tests; uses `cy.wait(TIMEOUTS.*)` and a raw `cy.wait(5000)` (flaky-pattern, commented as workaround for MM-45969).

### `channels/rhs/dm_checklist_spec.js`

> Scope: rejects run in DM; moving populates team_id

- **Area**: RHS (DM channel) > blank checklists in direct messages (no playbook run)
- **Setup**: team/user, a DM partner, a gating playbook with 1 checklist/item; viewport macbook-13.
- **Tests**:
  - `can create a checklist in a DM via the RHS` — in a fresh 1:1 DM with no runs, clicking 'New checklist' from the 'no-active-runs' empty state creates an 'Untitled checklist' with 'Tasks' section shown in RHS.
  - `can create a checklist in a self-DM via the RHS` — same flow works in a self-DM (DM with oneself).
  - `can add a task and check it off in a DM checklist` — adding a task via RHS and checking its checkbox marks it checked.
  - `can post a status update in a DM checklist` — posting a status update (via `cy.updateStatus` helper with a 60 min reminder) on a DM checklist posts the update message visibly in the DM channel.
  - `shows channel members in task assignee selector` — opening a task's assignee selector in a DM checklist shows the DM partner as an assignable user.
  - `rejects playbook run creation in a DM via API` — API call to run an actual playbook (not blank checklist) into a DM channel returns 400 (gated/rejected).
  - `"Run a playbook" is available in the DM channel dropdown` — with 2 existing blank-checklist runs in a DM (list view), opening the create-dropdown chevron next to 'New checklist' shows both 'create-from-playbook' and 'go-to-playbooks' options (gating happens elsewhere, not in this dropdown).
  - `move-channel modal offers DM channels for checklists` — from the run list's dot menu > 'Move to a different channel', typing a target DM partner's username in the channel selector shows a matching DM channel option.
  - `moving a DM checklist to a public channel populates team_id` — via API, updating a DM-created run's channel to a public channel populates `team_id` correctly on the run (verified via `apiGetPlaybookRun`).
- **Notes**: last test is really an API-only test despite being in a UI-oriented spec file; heavy duplication of structure with `gm_checklist_spec.js` (same scenarios, DM vs GM) — strong consolidation candidate.

### `channels/rhs/gm_checklist_spec.js`

> Scope: rejects run in GM; moving populates team_id

- **Area**: RHS (GM channel) > blank checklists in group messages (no playbook run)
- **Setup**: team/user, 2 GM partners + a shared GM channel, plus a gating playbook; viewport macbook-13.
- **Tests**:
  - `can create a checklist in a GM via the RHS` — in a fresh GM with no runs, clicking 'New checklist' from empty state creates 'Untitled checklist' in RHS.
  - `can add a task and check it off in a GM checklist` — adding a task and checking it off works in a GM checklist.
  - `can post a status update in a GM checklist` — posting a status update via `cy.updateStatus` shows the update message in the GM channel.
  - `shows channel members in task assignee selector` — task assignee selector in a GM checklist lists both GM partner usernames.
  - `rejects playbook run creation in a GM via API` — API call to run a real playbook into a GM channel returns 400.
  - `"Run a playbook" is available in the GM channel dropdown` — with 2 existing blank-checklist runs in a GM (list view), the create-dropdown shows 'create-from-playbook' and 'go-to-playbooks' options.
  - `moving a GM checklist to a public channel populates team_id` — via API, moving a GM-created run's channel to a public channel sets `team_id` correctly on the run.
- **Notes**: near-duplicate of `dm_checklist_spec.js` (same test scenarios applied to GM instead of DM, minus the "move-channel modal offers ... channels" UI test); last test is API-only despite UI-focused file; strong consolidation candidate with the DM spec.

### `channels/slash_command/test_spec.js`

> Scope: argument validation matrix

- **Area**: slash command > `/playbook test` (admin-only testing subcommands)
- **Setup**: regular user + sysadmin; playbook with 2 checklists, one run; `ServiceSettings.EnableTesting` toggled true/false via `cy.apiUpdateConfig`; viewport macbook-13.
- **Tests**:
  - `channels > slash command > test > as a regular user > fails to run subcommand bulk-data` — non-admin running `/playbook test bulk-data` gets "Running the test command is restricted to system administrators."
  - `channels > slash command > test > as a regular user > fails to run subcommand create-playbook-run` — same restriction message for `create-playbook-run`.
  - `channels > slash command > test > as a regular user > fails to run subcommand self` — same restriction message for `self`.
  - `channels > slash command > test > as an admin > with EnableTesting set to false > fails to run subcommand bulk-data` — admin with EnableTesting=false gets "Setting EnableTesting must be set to true to run the test command."
  - `channels > slash command > test > as an admin > with EnableTesting set to false > fails to run subcommand create-playbook-run` — same message for `create-playbook-run`.
  - `channels > slash command > test > as an admin > with EnableTesting set to false > fails to run subcommand self` — same message for `self`.
  - `channels > slash command > test > as an admin > with EnableTesting set to true > with subcommand self > asks for confirmation` — `/playbook test self` prompts confirmation phrase requiring `CONFIRM TEST SELF`.
  - `channels > slash command > test > as an admin > with EnableTesting set to true > with subcommand create > fails to run with no arguments` — missing args shows "The command expects three parameters: <playbook_id> <timestamp> <name>".
  - `channels > slash command > test > as an admin > with EnableTesting set to true > with subcommand create > fails to run with one argument` — same parameter-count error with 1 arg.
  - `channels > slash command > test > as an admin > with EnableTesting set to true > with subcommand create > fails to run with two arguments` — same parameter-count error with 2 args.
  - `channels > slash command > test > as an admin > with EnableTesting set to true > with subcommand create > fails to run with a malformed playbook ID` — non-ID string yields "The first parameter, <playbook_id>, must be a valid ID."
  - `channels > slash command > test > as an admin > with EnableTesting set to true > with subcommand create > fails to run with a valid, but unknown playbook ID` — well-formed but unknown ID yields "The playbook with ID '...' does not exist."
  - `channels > slash command > test > as an admin > with EnableTesting set to true > with subcommand create > fails to run with a malformed date` — bad date format yields parse-error message with example format.
- **Notes**: Entirely admin/testing-command surface; no RHS/RDP assertions beyond ephemeral messages — effectively API-level behavior exercised through chat command.
