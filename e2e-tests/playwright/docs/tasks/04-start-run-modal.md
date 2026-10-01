# Task 04: Run creation modal (templates, channel modes, validation, new_channel_only)

**Task id**: `start-run-modal` · **Kind**: playwright

## Target

- `tests/runs/start_run_modal.spec.ts`

## What to do

Target ~16 tests. Consolidate:
- Template prefill / override / channel-mode switching (default, current channel via client-side nav, pre-configured channel, must-fill) as focused tests.
- Validation in a table where natural: empty name disables submit, exactly-max accepted, over-max error + recovers, too-long *resolved* locked template errors, reset on cancel.
- Locked template → readonly + preview; unlocked → editable + preview; freehand `{OWNER}` resolves.
- `new_channel_only=true`: one test asserting link radio disabled + hint + no selector + create radio checked, then submit creates a new channel. `false` regression: one test.
- Many attribute inputs keep Cancel reachable.
- DM/GM excluded from the channel selector: table `{DM, GM}`. DM refetch flood: assert with `page.on('request')` counting, no fixed sleep (use a bounded `expect.poll`/short observation via `waitForResponse` if possible; document why).
- "Create new playbook" link opens the create playbook flow.

## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Rules (non-negotiable)

- Follow `e2e-tests/playwright/AGENTS.md` (POM is mandatory: no `page.getBy*`/`page.locator` in specs; a11y-first locators; API seeding through `tests/helpers`; `@objective` JSDoc; `{tag: '@playbooks'}`; `#`/`*` comments; collision-free names; no fixed waits).
- Apply the consolidation principles P1-P7 from `docs/cypress_migration_plan.md`: modernize, don't copy-paste. Every behavior listed under "Cypress coverage" must be covered by some assertion, unless this doc says it moves elsewhere.
- Reuse and extend existing page objects/helpers before creating new ones. If a webapp component lacks an accessible name needed for a role locator, adding an a11y attribute in `webapp/` is allowed (hard rule 2, nothing else).
- Don't delete Cypress specs (that's the `retire-cypress` task).
- **Stuck on a selector?** You may use the agent-browser skill (`agent-browser skills get core`) to explore the running app and read its accessibility tree (roles + accessible names). Turn what you find into role/label locators in a page object. Artifacts go to /tmp only; never change server config through the System Console. It's an exploration aid only; the Playwright tests must pass on their own.

## Definition of done

1. Target spec(s) exist and pass locally: `cd e2e-tests/playwright && npx playwright test <spec> --reporter=list` (server at `MM_SERVICESETTINGS_SITEURL`, default `http://localhost:8065`, plugin deployed with `make deploy` if you added webapp a11y attributes).
2. Run it a second time to check stability (`--repeat-each=2` is fine).
3. `e2e-tests/playwright/docs/quality.sh` prints `QUALITY: PASS` (log saved as `docs/tasks/reviews/<task-id>.attempt-<n>.quality.log`). If it redeployed the plugin, re-run step 1 afterwards.
4. At the top of the spec, a comment lists the Cypress spec(s) it replaces (and which parts).

## Cypress coverage (sources)

Scope column says which part of each source spec belongs to THIS task. The excerpt below is the full inventory of that spec; ignore the parts outside the scope.

| Cypress spec | Scope for this task |
|---|---|
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_spec.js` | all except "from playbook list > defaults" (goes to start-run-entry-points) |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_template_spec.js` | UI tests only; the two "backend ignores client-supplied name" API tests go to Go (go-coverage-gaps) |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_new_channel_only_spec.js` | the "when new_channel_only is true/false" run-modal tests (editor toggle tests belong to editor-run-settings) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/new_channel_enforcement_spec.js` | the 2 "UI run start" tests only; API contract tests are not ported (go-coverage-gaps audit) |
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/start_run_rhs_spec.js` | non-skipped tests: create-new-playbook from modal, DM/GM exclusion, no DM refetch flood |

### `playbooks/start_run_spec.js`

> Scope: all except "from playbook list > defaults" (goes to start-run-entry-points)

- **Area**: run-creation modal (start run dialog) — templates, channel modes, validation
- **Setup**: `apiInitSetup` team/user; public playbook created per test via API with `createPublicPlaybookRun: true`; helper `fillPBE` configures playbook's channel template/mode/summary/default-owner via API then reloads.
- **Tests**:
  - `from playbook list > defaults` — backstage list "Run" button opens run modal; filling run name and confirming lands on RDP with `?from=run_modal` and correct run name heading.
  - `from playbook editor > pbe configured as create new channel > defaults` — playbook editor + run modal: with channel template name/summary configured and default-owner toggle enabled, modal prefills run name/summary; starting run lands on RDP with templated name/summary shown.
  - `... > change title/summary` — run modal: user can override prefilled run name/summary before starting; RDP reflects overridden values.
  - `... > change to link to existing channel does not default to current channel` — run modal: switching radio to "link existing channel" leaves channel selector showing "Select a channel" (not auto-filled) when run modal opened from playbook editor without prior channel context.
  - `... > switching to link existing defaults to current channel when no channel is pre-configured` — run modal: navigating to playbook editor via client-side routing from Town Square (preserving Redux current channel) then switching to link-existing pre-selects "Town Square".
  - `... > change to link to existing channel` — run modal: switching to link-existing, confirm button disabled until channel selected; selecting "Town" enables start; after run creation, clicking `runinfo-channel-link` navigates to town-square channel.
  - `pbe configured as linked to existing channel > defaults` — playbook editor configured with `channelMode: link_to_existing_channel` + pre-linked channel: run modal shows empty run-name, prefilled summary, confirm disabled until name entered; after creation, channel link navigates to town-square.
  - `... > fill initially empty channel` — run modal: with link-existing mode but no pre-configured channel, user must fill both run name and channel selector before confirm enables; verifies resulting run links to town-square.
  - `... > change to create new channel` — run modal: switching from link-existing to create-new-channel radio creates a new channel named after the run (`test-run-name`), verified via channel link navigation.
  - `start run modal > invalid user input > modal resets form fields when cancelled and reopened` — run modal: filled-in name/summary discarded after Cancel + reopen (fields empty since no template configured).
  - `... > exactly max length run name is accepted` — run modal: run name at exactly `RUN_NAME_MAX_LENGTH` (64) chars shows no error and start button enabled.
  - `... > submit button is disabled when run name is empty` — run modal: confirm button disabled with empty run name.
  - `... > error is shown when maximum length of run name is exceeded` — run modal: run name exceeding max length shows `run-name-error` with max length message and disables confirm; removing last char clears error.
- **Notes**: `fillPBE` helper relies on API update + `cy.reload()` to avoid racing the editor's 500ms debounced autosave — a flaky-prevention workaround worth preserving in Playwright rewrite.

### `playbooks/start_run_template_spec.js`

> Scope: UI tests only; the two "backend ignores client-supplied name" API tests go to Go (go-coverage-gaps)

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

### `playbooks/start_run_new_channel_only_spec.js`

> Scope: the "when new_channel_only is true/false" run-modal tests (editor toggle tests belong to editor-run-settings)

- **Area**: run-creation modal > "new channel only" enforcement + playbook editor toggle
- **Setup**: `apiInitSetup` team/user; playbooks created per-context with `new_channel_only` set via API; viewport macbook-13; archives created playbooks in `afterEach`.
- **Tests**:
  - `when new_channel_only is true > "Link to existing channel" radio is disabled` — run modal: radio `link-existing-channel-radio` is disabled when playbook has `new_channel_only=true`.
  - `... > "Create a run channel" radio is checked and enabled` — run modal: `create-channel-radio` checked and enabled under same restriction.
  - `... > enforcement hint message is visible below the disabled radio` — run modal: `new-channel-only-hint` shows text "This playbook requires a new channel for each run".
  - `... > channel selector is not rendered` — run modal: `link-existing-channel-selector` absent.
  - `... > run can be started (modal submits successfully with new channel mode)` — run modal + API: submitting run creates run with a new `channel_id`, verified channel exists via API.
  - `new_channel_only toggle in the playbook editor > persists the flag via the UI toggle` — playbook editor Outline: toggling `new-channel-only-toggle` (with confirmation) persists `new_channel_only=true` via API check.
  - `... > shows a confirmation dialog with the correct title, message and button when enabling` — playbook editor Outline: enabling toggle shows `#confirmModal` with title "Require new channel for all runs", explanatory text, and "Confirm" button; cancel closes modal.
  - `... > disables the flag without a confirmation dialog` — playbook editor Outline: disabling the toggle (already enabled via API) does not show confirmation modal and persists `new_channel_only=false`.
  - `when new_channel_only is false (regression) > "Link to existing channel" radio is enabled` — run modal: radio not disabled when flag is false.
  - `... > enforcement hint message is not shown` — run modal: `new-channel-only-hint` absent when flag is false.
- **Notes**: Uses custom commands `cy.playbooksOpenRunModal`, `cy.playbooksToggleWithConfirmation`, `cy.playbooksGetRunIdFromUrl`, `cy.visitPlaybookEditor`.

### `runs/new_channel_enforcement_spec.js`

> Scope: the 2 "UI run start" tests only; API contract tests are not ported (go-coverage-gaps audit)

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

### `channels/rhs/start_run_rhs_spec.js`

> Scope: non-skipped tests: create-new-playbook from modal, DM/GM exclusion, no DM refetch flood

- **Area**: RHS (channel) > starting a run from RHS run list / empty state (playbook templates, channel linking modes, create-new-playbook shortcut, DM/GM channel exclusion from run modal's channel selector)
- **Setup**: team/user, one extra 'Existing Channel'; playbooks created per test with varying `channelMode`/`channelNameTemplate`/`runSummaryTemplate`.
- **Tests**:
  - `From RHS run list > playbook configured as create new channel > [SKIPPED] defaults` — (skipped, UI changed) intended: creating a blank checklist from RHS empty state shows checklist details view.
  - `From RHS run list > playbook configured as create new channel > [SKIPPED] change title/summary` — (skipped) intended: selecting a playbook via 'Run a playbook' dropdown pre-fills run name/summary from templates; editing and starting navigates to new channel with correct RHS content.
  - `From RHS run list > playbook configured as create new channel > [SKIPPED] change to link to existing channel defaults to current channel` — (skipped) intended: switching to 'link existing channel' radio defaults channel selector to current channel (Town Square).
  - `From RHS run list > playbook configured as create new channel > [SKIPPED] change to link to existing channel with already selected channel` — (skipped) intended: if playbook predefines a `channelId`, linking shows that channel pre-selected instead of current channel.
  - `From RHS run list > playbook configured as create new channel > [SKIPPED] change to link to existing channel` — (skipped) intended: manually picking a different existing channel in the link flow starts the run there with correct name/summary/RHS content.
  - `create new playbook from run modal > empty state has no dropdown — only the header does` — the 'no-active-runs' empty-state widget's 'create-blank-checklist' button has no chevron/dropdown, while the RHS header's equivalent button does have the dropdown.
  - `create new playbook from run modal > opens the playbook editor when clicking Create new playbook` — from header dropdown > 'Run a playbook' > 'Create new playbook' opens the Create Playbook modal/page.
  - `DM/GM channel exclusion in run modal > does not offer DM channels when linking an existing channel` — in the run-playbook modal's 'link existing channel' selector, searching by a DM partner's username does not surface that DM channel as an option (DM/GM excluded).
  - `does not pre-select current DM and does not flood channel fetches` — opening the run modal from within a DM does not pre-select/pill the current DM channel ('Unknown Channel' not shown) and does not cause excessive (`<4`) repeated GET requests for that DM channel (regression test, observes network over a 2s window).
  - `does not offer GM channels when linking an existing channel` — same DM/GM exclusion behavior verified for GM channels via GM member username search.
- **Notes**: 5 of 10 tests are skipped (TBD comments: "UI changes for Checklists feature - RHS workflow has changed") — roughly half the spec is currently stale; uses raw `cy.wait(ms)` extensively (500/1000/2000/5000) including one explicitly commented as an "observation window" for a negative assertion (flaky-prone pattern) with an eslint-disable for `cypress/no-unnecessary-waiting`.
