# Task 34: Backstage playbooks list

**Task id**: `playbooks-list` · **Kind**: playwright

## Target

- `tests/playbooks/list.spec.ts`

## What to do

Target ~6 tests. Join/leave (LHS updates); duplicate (member, Run button, LHS); duplicate with attributes + conditions is independent; archived hidden by default / shown with filter; search resets pagination.

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
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/list_spec.js` | all except import tests (import-export) |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/pagination_spec.js` | all tests |

### `playbooks/list_spec.js`

> Scope: all except import tests (import-export)

- **Area**: playbooks backstage list
- **Setup**: `apiInitSetup` team/user plus second user added to team; one public playbook and one archived public playbook created via API.
- **Tests**:
  - `has "Playbooks" in heading` — backstage list: heading test id `titlePlaybook` contains "Playbooks".
  - `join/leave playbook` — backstage list: leaving playbook removes it from LHS, joining via `join-playbook` button restores it in LHS.
  - `can duplicate playbook` — backstage list: "Duplicate" menu action creates "Copy of ..." playbook; duplicator becomes member (shows `run-playbook` not `join-playbook`) and appears in LHS.
  - `can duplicate playbook with attributes and conditions` — backstage list + playbook editor (Attributes/Outline): duplicating a playbook copies text/select attributes and AND-condition; editing duplicate's attribute name and condition logic (AND→OR) does not affect original playbook (independence verified).
  - `archived playbooks > does not show them by default` — backstage list: archived playbook hidden unless filter applied.
  - `archived playbooks > shows them upon click on the filter` — backstage list: clicking "With Archived" filter reveals archived playbook and increases count.
  - `can import playbook > triggered by drag and drop` — backstage list: drag-and-drop fixture JSON onto list creates and opens playbook editor with title "Example Playbook".
  - `can import playbook > triggered by using button/input` — backstage list: file-input import of fixture JSON creates playbook "Example Playbook".
  - `can import playbook > fails to import invalid file type` — backstage list: importing an mp3 file shows error "The file must be a valid JSON playbook template."
- **Notes**: Overlaps with export_import_spec.js UI import tests (duplicate coverage of drag-drop/file-input import, one for attributes-specific fixture, one for generic fixture).

### `playbooks/pagination_spec.js`

> Scope: all tests

- **Area**: playbooks backstage list > pagination
- **Setup**: `apiInitSetup` team/user; 1 named playbook + 20 extra playbooks ("Elements before") created to force pagination.
- **Tests**:
  - `reset page to 0 after search for an name with one value` — backstage list: after navigating to next page, typing a search term that matches only 1 result resets pagination to page 1 ("1–1 of 1 total") and hides "Previous" button.
- **Notes**: none
