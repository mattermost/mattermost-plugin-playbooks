# Task 29: Run attributes (property values on runs)

**Task id**: `run-attributes` · **Kind**: playwright

## Target

- `tests/runs/attributes.spec.ts`

## What to do

Target ~7 tests. Full matrix on the **RDP**, one smoke on channel RHS (principle P2).
- No section without attributes; inheritance of all types as "Empty".
- Edit + clear per type table `{text, url, select, multiselect}`; URL renders as `target=_blank` link.
- Channel RHS smoke: edit a text attribute.
- Timeline entries table `{set, clear, update select}`.
- Independence from later playbook attribute changes.

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
| `e2e-tests/cypress/tests/integration/playbooks/runs/run_attributes_spec.js` | all tests |

### `runs/run_attributes_spec.js`

> Scope: all tests

- **Area**: RDP RHS "Attributes" section (custom property fields inherited from playbook, per-type editing, timeline entries)
- **Setup**: Playbooks created per test with various property field types (text, url valueType, select, multiselect); testUser owner; macbook-13 viewport. Helper functions build playbook/run and manage attribute rows via testId `run-property-<name>`.
- **Tests**:
  - `empty state > does not show attributes section when playbook has no attributes` — RHS Attributes section absent when playbook has no property fields.
  - `attribute inheritance > copies text attribute from playbook to run` — new run shows inherited text attribute, initially "Empty".
  - `attribute inheritance > copies all attribute types from playbook to run` — text/select/multiselect attributes all appear on new run, each "Empty".
  - `edit attribute values > from run details page > can edit text attribute value` — RDP RHS: editing text attribute persists value across page reload.
  - `edit attribute values > from run details page > can edit URL attribute and displays as clickable link` — URL-type attribute renders as clickable `target=_blank` link with correct href, is editable to a new URL, and persists after reload.
  - `edit attribute values > from run details page > can edit select attribute value` — select attribute can be set and re-set to a different option, value updates.
  - `edit attribute values > from run details page > can edit multiselect attribute value` — multiselect attribute supports choosing multiple options incrementally, all shown.
  - `edit attribute values > from run details page > can clear text attribute value` — clearing text attribute value reverts display to "Empty".
  - `edit attribute values > from run details page > can clear select attribute value` — clicking select's clear indicator reverts to "Empty".
  - `edit attribute values > from run details page > can clear multiselect attribute value` — clicking multiselect's clear indicator reverts to "Empty".
  - `edit attribute values > from channel RHS > can edit text attribute value` — same text-attribute edit verified from channel RHS surface (not RDP).
  - `edit attribute values > from channel RHS > can edit URL attribute and displays as clickable link` — URL attribute editable/clickable from channel RHS.
  - `edit attribute values > from channel RHS > can edit select attribute value` — select attribute editable from channel RHS.
  - `edit attribute values > from channel RHS > can edit multiselect attribute value` — multiselect attribute editable from channel RHS.
  - `timeline entries for property changes > creates timeline entry when setting text property` — RDP timeline shows `property_changed` entry "set Environment to Production".
  - `timeline entries for property changes > creates timeline entry when clearing property` — timeline shows a 2nd `property_changed` entry "cleared Environment".
  - `timeline entries for property changes > creates timeline entry when updating select property` — timeline shows entry "updated Severity from Low to High".
  - `attribute independence > run attributes remain independent when playbook attributes change` — setting run attribute values, then deleting/adding attributes on the playbook (via playbook editor "attributes" tab) does not affect existing run's attribute values, and new playbook attributes don't retroactively appear on existing runs.
- **Notes**: Heavy use of fixed `cy.wait(500)`/`cy.wait(100)` after edits throughout (flaky-prone pattern, repeated dozens of times). Covers both RDP and channel-RHS surfaces for the same attribute-editing behaviors (duplication by design to test both surfaces).
