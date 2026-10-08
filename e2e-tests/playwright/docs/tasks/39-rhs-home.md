# Task 39: Channel RHS home / empty state (re-spec against current UI)

**Task id**: `rhs-home` · **Kind**: playwright

## Target

- `tests/channels/rhs_home.spec.ts`

## What to do

Re-spec, not a port: the Cypress tests are skipped because the Checklists UI changed.
- First explore the current RHS empty state in the running app (use the browser / Playwright codegen) and describe the actual UI in the spec header comment.
- Cover: empty state for a channel without runs (New checklist), header create dropdown entries (Run a playbook, browse), empty-state button has no dropdown, user without playbook create permission (license-gated -> skip pattern).
- ~3 tests. If the intended behavior is unclear, write the open question in the task notes instead of guessing.

## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Rules (non-negotiable)

- Follow `e2e-tests/playwright/AGENTS.md` (POM is mandatory: no `page.getBy*`/`page.locator` in specs; a11y-first locators; API seeding through `tests/helpers`; `@objective` JSDoc; `{tag: '@playbooks'}`; `#`/`*` comments; collision-free names; no fixed waits).
- Apply the consolidation principles P1-P7 from `docs/cypress_migration_plan.md`: modernize, don't copy-paste. Every behavior listed under "Cypress coverage" must be covered by some assertion, unless this doc says it moves elsewhere.
- Reuse and extend existing page objects/helpers before creating new ones. If a webapp component lacks an accessible name needed for a role locator, adding an a11y attribute in `webapp/` is allowed (hard rule 2, nothing else).
- Don't delete Cypress specs (that's the `retire-cypress` task).
- **Stuck on a selector?** You may use the agent-browser skill (`agent-browser skills get core`) to explore the running app and read its accessibility tree (roles + accessible names). Inspect the DOM only and **do not take screenshots**. Turn what you find into role/label locators in a page object. Any artifacts go to /tmp only; never change server config through the System Console. It's an exploration aid only; the Playwright tests must pass on their own.

- **Mattermost core UI goes through `MattermostCore`** (`tests/pages/mattermost/`, created by the `mattermost-core-pom` task): channels, posts, ephemeral messages, LHS sidebar, app bar/channel header, core RHS/threads, generic modals, interactive dialogs, System Console. Plugin page objects and specs must not locate core UI themselves. Extend `MattermostCore` if something is missing. The reviewer treats core-UI locators outside `tests/pages/mattermost/` as MAJOR.

## Definition of done

1. Target spec(s) exist and pass locally: `cd e2e-tests/playwright && npx playwright test <spec> --reporter=list` (server at `MM_SERVICESETTINGS_SITEURL`, default `http://localhost:8065`, plugin deployed with `make deploy` if you added webapp a11y attributes).
2. Run it a second time to check stability (`--repeat-each=2` is fine).
3. `e2e-tests/playwright/docs/quality.sh` prints `QUALITY: PASS` (log saved as `docs/tasks/reviews/<task-id>.attempt-<n>.quality.log`). If it redeployed the plugin, re-run step 1 afterwards.
4. At the top of the spec, a comment lists the Cypress spec(s) it replaces (and which parts).

## Cypress coverage (sources)

Scope column says which part of each source spec belongs to THIS task. The excerpt below is the full inventory of that spec; ignore the parts outside the scope.

| Cypress spec | Scope for this task |
|---|---|
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/home_spec.js` | ALL SKIPPED, intent only |
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/template_spec.js` | ALL SKIPPED, intent only |
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/start_run_rhs_spec.js` | skipped tests (intent only) + "empty state has no dropdown, only the header does" |

### `channels/rhs/home_spec.js`

> Scope: ALL SKIPPED, intent only

- **Area**: RHS (channel) > Home/empty-state view (starter templates, zero case, permission gating for playbook creation)
- **Setup**: team/user + custom sysadmin; separate restricted team/user with a custom scheme stripping `playbook_private/public_create` permissions.
- **Tests**:
  - `default permission settings > shows available > [SKIPPED] starter templates` — (skipped, UI changed) intended to verify RHS empty state shows 'Get started with a checklist for this channel', and opening 'Run a playbook' from the create dropdown shows playbook template tab with all named starter templates (Blank, Product Release, Incident Resolution, etc.) and their checklist/action counts.
  - `default permission settings > show zero case if there are playbooks > [SKIPPED] without pre-populated channel name template` — (skipped, UI changed) intended to verify RHS shows 'There are no runs in progress linked to this channel' zero-case text with no templates when playbooks exist but no runs in channel.
  - `user is lacking permissions to create playbooks > [SKIPPED] permission notice should be shown and no create button should exist` — (skipped, UI changed) intended to verify RHS shows a permission-denied notice and no 'Create playbook' button for a user without playbook-create permissions.
- **Notes**: ALL THREE tests in this file are skipped with comments "TBD: UI changes for Checklists feature - ... has changed" — entire spec is currently dead/stale and needs rewriting to match current RHS Home UI.

### `channels/rhs/template_spec.js`

> Scope: ALL SKIPPED, intent only

- **Area**: RHS (DM w/ Playbooks bot) > playbook template selection when creating a new playbook
- **Setup**: team/user created per test; viewport macbook-13; visits 'playbooks' DM channel.
- **Tests**:
  - `create playbook > open new playbook creation modal and navigates to playbooks > [SKIPPED] after clicking on Use` — (skipped, deprecated workflow) intended: selecting 'Blank' template via 'Use' in Playbook Templates tab opens playbook creation modal and navigates to the new playbook's outline/editor showing 'Blank' as title.
  - `create playbook > open new playbook creation modal and navigates to playbooks > [SKIPPED] after clicking on title` — (skipped) intended: same flow but clicking the template's title text instead of a 'Use' button.
- **Notes**: both tests in the file are skipped with a TODO noting the workflow was deprecated by the new Checklists UI; effectively the entire spec is stale.

### `channels/rhs/start_run_rhs_spec.js`

> Scope: skipped tests (intent only) + "empty state has no dropdown, only the header does"

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
