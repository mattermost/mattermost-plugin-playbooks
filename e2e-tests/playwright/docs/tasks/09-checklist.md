# Task 09: Run checklist (RHS full matrix + RDP smoke, chips, progress)

**Task id**: `checklist` · **Kind**: playwright

## Target

- `tests/runs/checklist.spec.ts`

## What to do

Target ~12 tests. Run the full checklist matrix on the **channel RHS**; add **one RDP smoke** (check a task + hover menu shows Skip/Duplicate).
- Slash-command items: invalid shows ephemeral error, valid posts + becomes "Rerun", state persists after reload, `/playbook check` item checks a task.
- Skip/restore + checked-by chip: one table `{checked, unchecked, skipped, restored, untouched}` -> chip tooltip / no chip.
- Add task (UI and `/playbook checkadd`), add checklist, rename checklist (**verify real behavior first**: the Cypress test expects old+new title concatenated, which is likely a test bug).
- Due dates (hover menu + edit mode), overdue filter count + toggle + auto-disappears, per-run isolation, long-list date-picker scroll regression.
- Progress indicator in runs list: table `{0 done, 2 closed, 2 closed + 1 skipped, mixed closed/skipped, all}` -> `N/4`.
- No `cy.wait`-style sleeps for react-select: wait on the option/listbox role.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/checklist_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_checklist_spec.js` | participant tests only (viewer half goes to rdp-viewer) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_checked_chip_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/task_progress_spec.js` | all tests |

### `channels/rhs/checklist_spec.js`

> Scope: all tests

- **Area**: RHS (channel) > checklist/tasks (slash commands, due dates, skip/restore, overdue filter, multi-checklist CRUD)
- **Setup**: team/user, one playbook with 4 checklists x 12 items (mix of `/invalid`, `/echo VALID`, `/playbook check 0 0`, and plain items); viewport macbook-13; run created fresh per test.
- **Tests**:
  - `rhs stuff > header > has title` — RHS checklist panel shows 'Tasks' heading.
  - `rhs stuff > shows an ephemeral error when running an invalid slash command` — clicking Run on an item with `/invalid` command shows ephemeral error 'Failed to execute slash command /invalid' and button stays 'Run'.
  - `rhs stuff > successfully runs a valid slash command` — clicking Run on `/echo VALID` item posts 'VALID' to channel and button changes to 'Rerun'.
  - `rhs stuff > still shows slash commands as having been run after reload` — after running the valid command and reloading, invalid item still shows 'Run' and valid item still shows 'Rerun' (state persists).
  - `rhs stuff > runs /playbook slash commands` — running `/playbook check 0 0` item checks the first checklist item's checkbox; state (Rerun + checked box) persists across reload.
  - `rhs stuff > can skip and restore task` — skipping task removes `skipped` marker upon 'Restore task' from the dot menu.
  - `rhs stuff > add new task` — adding a new task via RHS 'add task' flow (helper `cy.addNewTaskFromRHS`) shows the new task text.
  - `rhs stuff > add new task slash command` — `/playbook checkadd 0 <text>` slash command posted in channel adds a new task visible in RHS.
  - `rhs stuff > creates a new checklist` — clicking 'add-a-checklist-button', entering a title, and saving creates a new checklist section shown in RHS.
  - `rhs stuff > renames a checklist` — using checklist header dot menu 'Rename section', editing title updates the displayed checklist title (concatenated oldTitle+newTitle per test code, likely a test bug but documents actual behavior).
  - `rhs stuff > can set due date, from hover menu` — hovering a task and using the calendar icon to set due date via date-query text (e.g. 'in 10 minutes') shows a 'Due' info button with that text.
  - `rhs stuff > can set due date, from edit mode` — entering edit mode on a task (hover-menu edit button) and setting due date via the due-date-info-button input shows 'Due in 3 days'.
  - `rhs stuff > filter overdue tasks` — setting multiple overdue due dates, skipping one and completing another, shows 'overdue-tasks-filter' badge with correct count (excludes skipped/completed); clicking the filter shows only overdue tasks; clicking again restores full list (48 items). Has `{retries: {runMode: 3}}`.
  - `rhs stuff > filter overdue automatically disappear if we check all overdue items` — after marking the only overdue task complete, the overdue filter badge disappears and full task list (48) is shown.
  - `rhs stuff > switching between runs with the same checklist` — setting a due date on one run's task and switching (via LHS) to a different run using the same playbook/checklist shows that other run's tasks have no due dates (state isolated per-run).
  - `rhs stuff > scroll 2-3 pages and open due date selector- unexpected scroll issue` — scrolling deep into a long task list and opening the due-date calendar selector on a far-down item renders the date-picker visibly (regression/scroll bug check).
- **Notes**: uses `{retries: {runMode: 3}}` on the overdue-filter test (flaky pattern); heavy reliance on `cy.wait(ONE_SEC/HALF_SEC)` in `setTaskDueDate` helper for react-select rendering; large single `describe('rhs stuff')` block covers many distinct behaviors (slash commands, checklist CRUD, due dates, overdue filter, cross-run isolation) that could be split.

### `runs/rdp_main_checklist_spec.js`

> Scope: participant tests only (viewer half goes to rdp-viewer)

- **Area**: RDP (run details page) > checklist section — participant vs viewer permission behavior
- **Setup**: `apiInitSetup` team/user; separate viewer user (team member, not playbook member/participant) added to team; public playbook with 2 checklists x 2 tasks each; fresh run started before each test; viewport macbook-13.
- **Tests** (shared `commonTests()` run under both `as participant` and `as viewer`):
  - `is visible` — RDP: `run-checklist-section` visible.
  - `has title` — RDP: checklist section has "Tasks" h3 title.
  - `can see the tasks` — RDP: 4 tasks shown (2 checklists x 2 items).
  - `as participant > click marks task as done` — RDP: participant can check a task checkbox, becomes checked.
  - `as participant > has hover menu` — RDP: hovering a task as participant shows dot-menu with "Skip task"/"Duplicate task" actions.
  - `as viewer > click does not work` — RDP: viewer's task checkbox has `readonly` attribute (cannot be toggled).
  - `as viewer > has not hover menu` — RDP: viewer hovering a task does not show the dot-menu "More" button.
- **Notes**: Spec comment explicitly states it only covers basic RDP checklist behavior for participant/viewer and defers full checklist behavior coverage to "Channel RHS Checklist" tests (likely overlapping/complementary spec not in this batch).

### `runs/rdp_checked_chip_spec.js`

> Scope: all tests

- **Area**: RHS checklist task metadata > "checked-by" chip (checked/unchecked/skipped/restored)
- **Setup**: `apiInitSetup` team/user; per-test helper `setupRunWithChecklist` creates a fresh DM partner + "teamless" DM-channel run via API (`apiRunPlaybook` with empty teamId/playbookId); viewport macbook-13.
- **Tests**:
  - `shows a checked-by chip after a task is checked, then flips to unchecked` — RHS checklist: checking a new task shows `checklist-item-checked-chip`; hovering shows tooltip "checked off"; unchecking keeps chip visible with tooltip "unchecked".
  - `shows a "skipped" chip after a task is skipped, then "restored" after it is restored` — RHS checklist: skipping task via dot-menu "Skip task" shows chip with tooltip "skipped"; "Restore task" changes tooltip to "restored" (not "unchecked").
  - `shows no chip for an unchecked, never-touched task` — RHS checklist: brand-new untouched task shows no checked-by chip.
- **Notes**: Uses `cy.realHover()` and `cy.uiGetToolTip` custom commands; tests run against DM-channel ("teamless") runs rather than team channel runs.

### `runs/task_progress_spec.js`

> Scope: all tests

- **Area**: Backstage runs list > per-run task progress indicator (`task-progress-indicator`)
- **Setup**: Shared playbook with 4 checklist tasks; fresh run per test; macbook-13 viewport. Uses custom commands `playbooksVisitRun`, `playbooksCompleteTaskAtIndex`, `playbooksGetRunListRow`.
- **Tests**:
  - `shows 0/4 progress in runs list when no tasks completed` — backstage runs list shows "0/4" progress indicator for a fresh run; backend confirms all items uncompleted.
  - `shows 2/4 progress after completing 2 tasks` — completing 2 tasks via RDP checklist updates list indicator to "2/4".
  - `shows 3/4 progress after skipping a task (skipped counts as completed)` — skipping a task via API counts toward progress ("3/4").
  - `shows 4/4 progress when some tasks are closed and some are skipped` — mix of closed+skipped tasks shows full "4/4" progress.
  - `shows 4/4 progress after all tasks are completed` — completing all 4 tasks via UI shows "4/4".
- **Notes**: Good use of `cy.intercept`+`cy.wait('@runsList')` for list navigation reliability. Task completion done via custom command on RDP, skip done via API (no UI skip command available, per comment).
