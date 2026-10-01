# Task 20: Task conditions (editor authoring + run-time visibility)

**Task id**: `conditions` · **Kind**: playwright

## Target

- `tests/playbooks/conditions.spec.ts`

## What to do

Target ~9 tests, two describes (editor, run).
- Editor: create from task menu, edit operator/value, add OR clause, AND->OR, delete with confirm, assign/remove task to existing condition. All persist after reload.
- Run: table `{is, is_not, AND, OR, text is/is_not}` -> task visible/hidden as property values change live (no reload).
- Checked task whose condition stops matching stays visible with a warning indicator.
- Channel message on property change: 1 task vs 3 tasks (2-row table).
- Finish: hidden conditional tasks are not "outstanding"; a visible incomplete task still warns.

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
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/condition_admin_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/condition_user_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_finish_spec.js` | "finish with conditional hidden tasks" describe |

### `playbooks/edit/condition_admin_spec.js`

> Scope: all tests

- **Area**: playbook editor > outline > checklist task conditions (conditional visibility rules) — create/edit/delete/assign-remove, admin/editor perspective
- **Setup**: single team/user; playbook with 2 property fields ("Priority" select: High/Medium/Low, "Status" select: Active/Inactive) created via API; viewport macbook-16; uses `cy.apiCreatePlaybookCondition` / `cy.apiAttachConditionToTask` API helpers to seed conditions directly.
- **Tests**:
  - `playbooks > edit > conditions > admin > create condition > can create a condition from task menu` — from a task's "More" menu, "Add condition" creates a condition-header UI element that persists after reload (editor surface).
  - `... > edit condition > can edit condition expression` — editing an existing single condition's operator (is→is not) and value (High→Medium) via dropdowns persists after reload, reflected in condition-header text.
  - `... > edit condition > can add second condition with OR operator` — clicking "condition-add-button" adds a 2nd condition clause defaulting to OR, changing its field to "Status" shows both field names in the header; persists after reload.
  - `... > edit condition > can change logical operator from AND to OR` — switching a 2-clause AND condition's selector to OR updates the header text to show "or"; persists after reload.
  - `... > delete condition > can delete condition` — "condition-header-delete-button" + confirm "Remove" removes the condition header entirely and is gone after reload.
  - `... > assign and remove tasks > can assign task to existing condition` — via a second task's "More" menu, "task-menu-assign-condition-*" attaches it to an existing condition, resulting in a shared `condition-header` (length 1) across tasks; persists after reload.
  - `... > assign and remove tasks > can remove task from condition group` — "task-menu-remove-condition" on one of two tasks sharing a condition removes just that task from the condition group while condition-header remains visible for the other task; persists after reload.
- **Notes**: Heavy use of `cy.wait(500)` after nearly every UI interaction — pervasive flaky-timing pattern throughout the file.

### `playbooks/edit/condition_user_spec.js`

> Scope: all tests

- **Area**: run details page (RDP) > conditional task visibility based on run property values — end-user/participant perspective
- **Setup**: single team/user; playbooks built per test with select/text property fields and attached conditions (is/is_not/AND/OR) via API helpers; viewport macbook-13; runs started via API, RDP visited directly; `cy.realType`/`cy.realPress` used for text property input.
- **Tests**:
  - `playbooks > edit > conditions > user > task visibility with simple condition > hides task when condition not met` — RDP hides a conditional task until the bound run-property ("Priority") is set to the matching value ("High"), toggling visibility live as the property changes.
  - `... > task visibility with AND logic > evaluates AND condition correctly` — task with an AND(Priority=High, Status=Active) condition only becomes visible once both properties match; changing either back to non-matching hides it again.
  - `... > task visibility with OR logic > evaluates OR condition correctly` — task with OR(Priority=High, Priority=Medium) condition becomes visible if either value is set, hidden only when set to Low.
  - `... > modified task behavior > shows warning indicator for modified task when condition no longer met` — checking a conditional task then changing the property so its condition no longer matches still shows the (checked) task but displays a `condition-indicator-error` warning icon instead of hiding it.
  - `... > real-time updates > updates task visibility without page reload` — repeated property value toggles (High→Medium→High) update task visibility live on RDP without a page reload.
  - `... > channel messages for conditional tasks > posts channel message when property change adds new tasks` — changing a property that newly satisfies a condition posts a system message in the run channel: "...resulting in the addition of 1 new task to Stage 1 checklist".
  - `... > channel messages for conditional tasks > posts message when multiple tasks are added` — same scenario with 3 conditional tasks added simultaneously posts "...addition of 3 new tasks to Stage 1 checklist".
  - `... > text property conditions > evaluates is and is_not conditions for text fields` — RDP text-type property ("Code") drives visibility of two tasks bound to `is "abc"` and `is_not "abc"` conditions; toggling the text value between "abc" and "xyz" flips which task is visible.
- **Notes**: Uses `cy.wait(500)` after each property-value change (inside `setPropertyValue`/`setTextPropertyValue` helpers) — pervasive flaky-timing pattern; tightly coupled companion to condition_admin_spec.js (admin/editor side) testing the same conditions feature from the run/participant side.

### `runs/rdp_main_finish_spec.js`

> Scope: "finish with conditional hidden tasks" describe

- **Area**: RDP main > finish run section
- **Setup**: Public playbook (no members), run created via API with owner=testUser; second user as non-participant viewer; macbook-13 viewport. Second describe block: playbook with conditional checklist items gated by a `Priority` select property field with a condition.
- **Tests**:
  - `runs > run details page > finish > is hidden as viewer` — RDP finish section (`run-finish-section`) does not exist for a user who is not a participant.
  - `runs > run details page > finish > is visible` — RDP finish section is visible to the run owner.
  - `runs > run details page > finish > has a placeholder visible` — RDP finish section shows placeholder text "Time to wrap up?".
  - `runs > run details page > finish > finish run > can be confirmed` — RDP: clicking finish opens confirm modal, confirming updates header badge from "In Progress" to "Finished", removes finish section, and removes run from LHS navigation.
  - `runs > run details page > finish > finish run > can be canceled` — RDP: clicking finish opens confirm modal, canceling keeps badge "In Progress" and finish section visible.
  - `runs > run details page > finish with conditional hidden tasks > does not count conditionally hidden tasks as outstanding when finishing` — RDP checklist: conditionally-hidden tasks (condition not met) are not counted as outstanding when finishing a run; confirm modal does not mention "outstanding task".
  - `runs > run details page > finish with conditional hidden tasks > still warns about outstanding tasks when a visible task is not complete` — RDP checklist: an incomplete visible (non-conditional) task still triggers "outstanding task" warning in finish confirm modal.
- **Notes**: Comment acknowledges modal title wording varies ("Confirm finish run" vs "Confirm finish").
