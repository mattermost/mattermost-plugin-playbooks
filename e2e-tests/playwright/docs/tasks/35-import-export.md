# Task 35: Playbook import (UI)

**Task id**: `import-export` · **Kind**: playwright

## Target

- `tests/playbooks/import_export.spec.ts`

## What to do

Target ~4 tests.
- Table `{drag and drop, file input}` importing ONE fixture that contains attributes, a condition linked to a task, and a run number prefix colliding with an existing playbook -> editor shows attributes/options, condition header on task, suffixed prefix.
- Invalid file type error.
- Put fixtures under `tests/fixtures/`.

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
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/list_spec.js` | can import playbook (drag-drop, file input, invalid type) |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/export_import_spec.js` | UI import tests only (API tests -> go-coverage-gaps) |

### `playbooks/list_spec.js`

> Scope: can import playbook (drag-drop, file input, invalid type)

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

### `playbooks/export_import_spec.js`

> Scope: UI import tests only (API tests -> go-coverage-gaps)

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
