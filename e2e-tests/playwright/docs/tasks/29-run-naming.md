# Task 29: Run naming: prefix, templates, tokens, sequential IDs

**Task id**: `run-naming` · **Kind**: playwright

## Target

- `tests/runs/run_naming.spec.ts`

## What to do

Target ~12 tests.
- Editor: fields present; lock checkbox unchecked by default, persists (template and literal); `{` autocomplete lists SEQ/OWNER/CREATOR; insert-variable button appends; unknown field warning; `{SEQ}` without prefix warning; real property field name has no warning; prefix not wiped by later template edit (regression); duplicate prefix shows error toast and reverts.
- Resolution table `{ {OWNER}, {CREATOR}, both, {SEQ}+both }` -> RDP h1 + API name; name frozen after owner reassignment while reporter stays creator.
- Sequential ID displayed in runs list (prefix and bare number), RDP info, and channel RHS: one test visiting all three.

## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Rules (non-negotiable)

- Follow `e2e-tests/playwright/AGENTS.md` (POM is mandatory: no `page.getBy*`/`page.locator` in specs; a11y-first locators; API seeding through `tests/helpers`; `@objective` JSDoc; `{tag: '@playbooks'}`; `#`/`*` comments; collision-free names; no fixed waits).
- Apply the consolidation principles P1-P7 from `docs/cypress_migration_plan.md`: modernize, don't copy-paste. Every behavior listed under "Cypress coverage" must be covered by some assertion, unless this doc says it moves elsewhere.
- Reuse and extend existing page objects/helpers before creating new ones. If a webapp component lacks an accessible name needed for a role locator, adding an a11y attribute in `webapp/` is allowed (hard rule 2, nothing else).
- Don't delete Cypress specs (that's the `retire-cypress` task).

## Definition of done

1. Target spec(s) exist and pass locally: `cd e2e-tests/playwright && npx playwright test <spec> --reporter=list` (server at `MM_SERVICESETTINGS_SITEURL`, default `http://localhost:8065`, plugin deployed with `make deploy` if you added webapp a11y attributes).
2. Run it a second time to check stability (`--repeat-each=2` is fine).
3. `e2e-tests/playwright/docs/quality.sh` prints `QUALITY: PASS` (log saved as `docs/tasks/reviews/<task-id>.attempt-<n>.quality.log`). If it redeployed the plugin, re-run step 1 afterwards.
4. At the top of the spec, a comment lists the Cypress spec(s) it replaces (and which parts).

## Cypress coverage (sources)

Scope column says which part of each source spec belongs to THIS task. The excerpt below is the full inventory of that spec; ignore the parts outside the scope.

| Cypress spec | Scope for this task |
|---|---|
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/run_naming_spec.js` | UI tests (API-only ones -> not ported, go-coverage-gaps audit) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/owner_creator_template_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/sequential_id_spec.js` | UI tests: list/RDP/RHS display, `{SEQ}` resolution, duplicate prefix toast (API-only ones -> not ported, go-coverage-gaps audit) |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_template_spec.js` | none of the modal tests (start-run-modal) - reference only for token resolution |

### `playbooks/edit/run_naming_spec.js`

> Scope: UI tests (API-only ones -> not ported, go-coverage-gaps audit)

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

### `runs/owner_creator_template_spec.js`

> Scope: all tests

- **Area**: run name templating > `{OWNER}` and `{CREATOR}` system tokens
- **Setup**: `apiInitSetup` team/owner user; separate creator user and separate new-owner user added to team; playbooks created per test with `channel_name_template` tokens patched via API; viewport macbook-13; archives created playbooks in `afterEach`.
- **Tests**:
  - `{OWNER} in run name template resolves to the owner display name at creation` — RDP + API: locked template `"Run by {OWNER}"` resolves run name to contain owner's display name, verified in RDP `h1` and via API `run.name`.
  - `{CREATOR} in run name template resolves to the run creator display name` — RDP + API: locked template with `{CREATOR}` resolves to the user who started the run (reporter), not the owner.
  - `{OWNER} and {CREATOR} resolve independently in the same run name template` — RDP + API: combined template with both tokens resolves to distinct owner and creator display names simultaneously.
  - `{SEQ}, {OWNER}, and {CREATOR} all resolve together in the same template` — RDP + API: template with `{SEQ}`, `{OWNER}`, `{CREATOR}` all resolve; `sequential_id` stored with configured `run_number_prefix`.
  - `reporter_user_id is immutable — stays as original creator after owner reassignment` — API + RHS (`playbooksChangeRunOwnerViaRHS`): reassigning owner via RHS profile selector updates `owner_user_id` but leaves `reporter_user_id` (creator) unchanged.
  - `{OWNER} token reflects new owner after reassignment; {CREATOR} reflects original creator` — RDP + RHS + API: run name resolved at creation time is frozen (still shows initial owner's name) even after owner is reassigned via RHS; `reporter_user_id` remains the original creator.
- **Notes**: Uses custom commands `cy.playbooksVisitRun`, `cy.playbooksVisitRunChannel`, `cy.playbooksChangeRunOwnerViaRHS`, `resolvedDisplayName` util. Mix of RDP/RHS UI assertions and API state checks in nearly every test.

### `runs/sequential_id_spec.js`

> Scope: UI tests: list/RDP/RHS display, `{SEQ}` resolution, duplicate prefix toast (API-only ones -> not ported, go-coverage-gaps audit)

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

### `playbooks/start_run_template_spec.js`

> Scope: none of the modal tests (start-run-modal) - reference only for token resolution

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
