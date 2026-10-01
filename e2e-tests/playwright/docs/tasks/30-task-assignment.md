# Task 30: Role-based task assignment on runs

**Task id**: `task-assignment` · **Kind**: playwright

## Target

- `tests/runs/task_assignment.spec.ts`

## What to do

Target ~6 tests.
- Owner-type task follows owner change; creator-type doesn't; manual override sticks.
- Role -> specific user via API clears the role badge in RHS.
- property_user task shows resolved user once value set, survives owner change (WebSocket regression).
- "Run User" option in RHS task editor.

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
| `e2e-tests/cypress/tests/integration/playbooks/runs/role_based_assignment_spec.js` | run/RHS UI tests (creation-time resolution API tests -> not ported (go-coverage-gaps audit); editor parts -> editor-checklists) |

### `runs/role_based_assignment_spec.js`

> Scope: run/RHS UI tests (creation-time resolution API tests -> not ported (go-coverage-gaps audit); editor parts -> editor-checklists)

- **Area**: Checklist task assignment by role (owner/creator/property-user) across playbook editor and RHS checklist
- **Setup**: 3 users (testOwner, testCreator, testNewOwner); playbooks created/archived per test with role-based `assignee_type` set via API patch; property-field-based tests use `apiCreatePlaybookWithProperties` with a user-type "Manager" field. Mostly channel/RHS surface (`playbooksVisitRunChannel`) plus playbook editor outline.
- **Tests**:
  - `task with assignee_type=owner is resolved to the run owner at creation` — API: starting a run resolves an `assignee_type=owner` task's `assignee_id` to the run owner.
  - `task with assignee_type=creator is resolved to the run creator at creation` — API: `assignee_type=creator` task resolves to the run creator (reporter), not the owner.
  - `changing run owner re-resolves owner-type tasks to the new owner` — RHS checklist: changing run owner via RHS profile selector updates an owner-type task's displayed assignee/badge and backend `assignee_id` to new owner.
  - `changing run owner does NOT re-resolve creator-type tasks` — RHS checklist: changing owner leaves creator-type task's assignee (badge "Run Creator") unchanged.
  - `manually assigned task is not re-resolved when owner changes` — RHS checklist: a task manually reassigned (overriding owner-type) via API keeps its manual assignee after an owner change.
  - `editing one task via UI does not wipe assignee_type from sibling tasks` — Playbook editor outline: editing/renaming one checklist task via UI does not clear `assignee_type` on a sibling task (regression for `useProxyState` bug).
  - `task item is accessible in the run checklist section` — RHS/run checklist: a task with role assignment is findable via `playbooksFindTaskItem` helper.
  - `switching from role assignment to a specific user clears the role > switching from role assignment to a specific user clears the role` — API reassigning a role-based task to a specific user clears `assignee_type` and shows user profile (not role badge) in RHS.
  - `switching from role assignment to a specific user clears the role > switching from role to user in the playbook editor clears assignee_type` — Playbook editor: selecting "None" role then picking a specific user via profile selector clears `assignee_type`/`assignee_property_field_id` and sets `assignee_id` (verified via GraphQL `UpdatePlaybook` mutation + API).
  - `assigning a task to a user-type property field shows the resolved user in the checklist` — RHS checklist: task with `assignee_type=property_user` bound to a "Manager" property field shows property-user badge + resolved username once run-level property value is set.
  - `changing owner in RHS preserves property_user task display` — RHS checklist: changing run owner does not affect a separate property_user-assigned task's resolved display (regression where WebSocket update wiped property_values).
  - `playbook editor shows "Run User" role option when playbook has a user-type property field` — Playbook editor task-edit dropdown (`role-options`) includes "Run User" (`property_user`) option when a user-type property field exists.
  - `playbook editor "Add a task" form shows "Run User" role option when playbook has a user-type property field` — same check in the "Add a task" new-item form's role dropdown.
  - `RHS task editor shows "Run User" role option when run has a user-type property field` — RHS checklist task-edit dropdown also includes "Run User" option when run has the property field.
- **Notes**: Several tests are primarily API/state-verification with only partial UI assertions (role resolution at creation tests are pure API checks with no UI visit). Uses custom helper commands (`playbooksVisitRunChannel`, `playbooksChangeRunOwnerViaRHS`, `playbooksFindTaskItem`, `playbooksOpenTaskAssigneeEditor`, `playbooksInterceptGraphQLMutation`) — indicates shared regression-testing utilities. Comments document two prior regressions being guarded against (sibling assignee_type wipe; property_values wiped on owner change via WebSocket).
