# Task 24: Task requirements (beta)

**Task id**: `task-requirements` · **Kind**: playwright

## Target

- `tests/playbooks/task_requirements.spec.ts`

## What to do

Target 3 tests. Enable the beta flag via config API in `beforeAll` (helper from foundations) and restore it in `afterAll`.

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
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/task_requirements_spec.js` | all tests |

### `playbooks/edit/task_requirements_spec.js`

> Scope: all tests

- **Area**: playbook editor > checklist task "requirements" (beta feature) — adding a requirement field in editor and filling/saving it on a run (RDP)
- **Setup**: `PluginSettings.Plugins.playbooks.BetaFeatures.task_requirements` enabled via admin config in `beforeEach`; single team/user; viewport macbook-13; one playbook + task created per test.
- **Tests**:
  - `playbooks > task requirements > adds a requirement in the playbook editor and shows it under the task` — via task "More" menu > "Add requirement", filling a label ("Ticket URL") in `playbooks-edit-requirements-modal` creates a `task-requirements-accordion` showing "1 requirement" under the task; persists after reload and via API (`checklists[0].items[0].requirements`).
  - `... > prompts for requirement values when checking off a run task` — on RDP, checking off a task with a requirement opens `playbooks-fill-requirements-modal` instead of completing immediately; filling the value and "Save and complete" closes modal, checks the task, shows value in the accordion, and persists `state: closed` + requirement value via API.
  - `... > can save requirement values as a draft without completing the task` — using "Save requirements" (instead of save-and-complete) in the fill modal saves the value but leaves the task unchecked; persisted via API with item state not closed.
- **Notes**: Feature is gated behind a beta config flag toggled in every test's `beforeEach` — a Playwright migration would need to replicate this feature-flag setup; no flaky `cy.wait(ms)` patterns observed.
