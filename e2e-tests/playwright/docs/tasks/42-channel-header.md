# Task 42: Channel header button / App Bar

**Task id**: `channel-header` · **Kind**: playwright

## Target

- `tests/channels/channel_header.spec.ts`

## What to do

Target ~3 tests. Table `{App Bar enabled -> app bar icon + tooltip, no legacy header button; disabled -> legacy button + tooltip + active state}`; run channel header description links to playbook and overview. Restore the App Bar config in `afterAll`.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/channel_header_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/channels/app_bar_spec.js` | DEAD in Cypress (nested it), port the intent |

### `channels/channel_header_spec.js`

> Scope: all tests

- **Area**: channel header > Playbook channel header icon + description text links
- **Setup**: team/user, one playbook + one run; toggles `ExperimentalSettings.DisableAppBar` admin config.
- **Tests**:
  - `App Bar enabled > webapp should hide the Playbook channel header button` — with App Bar enabled, the legacy `#incidentIcon` channel-header button does not exist in a non-run channel.
  - `App Bar disabled > webapp should show the Playbook channel header button` — with App Bar disabled, `#incidentIcon` channel-header button exists.
  - `App Bar disabled > tooltip text should show "Playbooks" for channel header button` — hovering `#incidentIcon` shows 'Playbooks' tooltip.
  - `App Bar disabled > webapp should make the Playbook channel header button active when opened` — clicking `#incidentIcon` adds `channel-header__icon--active-inverted` class to its parent.
  - `description text > should contain a link to the playbook` — in a run channel, the channel header description text contains a link to the playbook ('Playbook' text) pointing to `/playbooks/playbooks/{id}`.
  - `description text > should contain a link to the overview page` — channel header description text link 'the overview page' points to `/playbooks/runs/{runId}` (RDP).
- **Notes**: overlaps with `channels/app_bar_spec.js` (same App Bar enabled/disabled toggle, different UI surface — legacy channel header icon vs App Bar icon).

### `channels/app_bar_spec.js`

> Scope: DEAD in Cypress (nested it), port the intent

- **Area**: channel > App Bar icon visibility/tooltip
- **Setup**: team/user; toggles `ExperimentalSettings.DisableAppBar` admin config.
- **Tests**:
  - `App Bar disabled > should not show the Playbook App Bar icon` — with App Bar disabled config, visiting a non-run channel shows no `.app-bar` element.
  - `App Bar enabled > should show "Playbooks" tooltip for Playbook App Bar icon` — with App Bar enabled config, hovering the Playbooks App Bar icon shows a 'Playbooks' tooltip.
- **Notes**: both `it(...)` assertions are nested inside an outer `it(...)` (e.g. `it('App Bar disabled', ...) { ...; it('should not show...', ...) }`), which is invalid Cypress/Mocha usage — the inner `it` blocks are never actually registered/run as tests, so this spec effectively has two empty outer tests and two dead inner tests.
