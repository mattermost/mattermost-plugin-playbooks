# Task 18: Playbook editor: checklists, bulk edit, pre-assignee, role options

**Task id**: `editor-checklists` · **Kind**: playwright

## Target

- `tests/playbooks/editor_checklists.spec.ts`

## What to do

Target ~9 tests.
- Outline shows Tasks + checklist/step titles (fold into the first test as preconditions).
- Bulk edit: toggle on/off; select/deselect updates count; clear selection (accessible label); action bar buttons (Assign, Delete, Due date) in one test; delete one / many / selection cleared; due date presets; clicking a row selects instead of completing.
- Pre-assigning a user enables invite-users and adds them to the invited list; persists.
- "Run User" role option in task edit and add-task form (1 test, 2 steps). Sibling task `assignee_type` preserved when editing another task (regression). Role -> specific user clears role.

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
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/checklists_spec.js` | pre-assignee test (ignore the commented-out slash command block) |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/overview_spec.js` | "checklists > header > has title", "checklists > shows checklists" |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_checklist_multiselect_spec.js` | all tests (misplaced: it is editor bulk edit) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/role_based_assignment_spec.js` | editor parts: "Run User" option in task edit + add-task form, sibling assignee_type not wiped, editor role->user clears assignee_type |

### `playbooks/edit/checklists_spec.js`

> Scope: pre-assignee test (ignore the commented-out slash command block)

- **Area**: playbook editor > outline > checklist task pre-assignment, linkage to invite-users action
- **Setup**: single testUser; creates a fresh "Blank" playbook via UI per test.
- **Tests**:
  - `playbooks > edit > checklists > pre-assignee > user gets pre-assigned, added to invite user list, and invitations become enabled` — assigning testUser to the default "Untitled task" via the checklist assignee-profile-selector automatically checks the Actions > "invite-users" toggle and adds the user to the invited list ("1 SELECTED"); assignment persists after `cy.reload()`.
- **Notes**: Large commented-out `describe('slash command', ...)` block (3 tests: autocompletes after clicking Command, resets when saving with an empty slash command, removes input prompt on blur with invalid command) left disabled in source, not executed at all — dead/disabled code, not even using `.skip`.

### `playbooks/overview_spec.js`

> Scope: "checklists > header > has title", "checklists > shows checklists"

- **Area**: playbook editor > overview/outline page
- **Setup**: `apiInitSetup` team/user, second user, second team, extra follower user; public playbook with retrospective template/timer, two private playbooks (solo/shared members), two playbooks for team-switch run testing; viewport macbook-13.
- **Tests**:
  - `redirects to not found error if the playbook is unknown` — playbook editor: visiting non-existent playbook ID redirects to `/playbooks/error?type=playbooks`.
  - `redirect to not found if the url is incorrect` — playbook editor: visiting a path-traversal-like malformed playbook URL redirects to `/playbooks/error?type=default`.
  - `should switch to channels and prompt to run when clicking run > for testPlaybookOnTeamForSwitching from its own team` — LHS/backstage list: finding and clicking a playbook then "Run Playbook" opens run-creation dialog at config step, from the playbook's own team.
  - `... > for testPlaybookOnTeamForSwitching from another team` — same flow but navigated from a different team, verifying cross-team switch still opens run dialog.
  - `... > for testPlaybookOnOtherTeamForSwitching from its own team` — same flow for a playbook that lives on the other team, visited from its own team.
  - `... > for testPlaybookOnOtherTeamForSwitchingOnOtherTeam from another team` — same flow for other-team playbook accessed from the first team, verifying switch+run dialog.
  - `... > on direct navigation to a playbook` — playbook editor: direct URL visit + "Run Playbook" click opens run-creation dialog.
  - `should copy playbook link` — playbook editor header: hovering copy-link icon shows tooltip "Copy link to", clicking copies URL to clipboard and tooltip changes to "Copied!".
  - `should duplicate playbook` — playbook editor title menu: "Duplicate" creates "Copy of ..." playbook, duplicator is sole member and can run (not join).
  - `duplicating a playbook clears the run_number_prefix` — playbook editor title menu + API: duplicating a playbook with a `run_number_prefix` set results in duplicate having empty prefix.
  - `checklists > header > has title` — playbook editor Outline `#checklists` section: shows "Tasks" header.
  - `checklists > shows checklists` — playbook editor Outline: checklist title and step titles rendered under `#checklists`.
  - `shows correct retrospective timer and template text` — playbook editor Outline `#retrospective` section: shows "7 days" reminder interval and retro template text.
  - `shows statistics in usage tab` — playbook editor usage/overview tab: "Runs currently in progress", "Participants currently active", "Runs finished in the last 30 days" counts update after starting then finishing a run (via API) + page reload.
  - `start a run` — playbook editor: "Run Playbook" → enter run name → confirm creates run shown in LHS "Runs" section.
  - `archiving > shows intended UI and disallows further updates` — playbook editor: archived playbook shows archive badge, disabled "Run Playbook" button; API update attempt on archived playbook returns 400.
  - `start a run > start a run, create a new channel` — playbook editor + run dialog: default config (create private channel) honored; starting run creates new channel shown via `runinfo-channel-link`.
  - `start a run > start a run in existing channel` — playbook editor Outline actions (`#link-existing-channel`) + run dialog: enabling "link to existing channel" action and selecting "Town" channel makes run dialog default to linking existing channel; run creates no new channel, links to "Town".
- **Notes**: Uses `cy.wait`-style `cy.waitForGraphQLQueries()` custom command for debounced GraphQL save; heavy reliance on `cy.apiCreatePlaybook`/API setup, some tests span both API and UI assertions.

### `runs/rdp_main_checklist_multiselect_spec.js`

> Scope: all tests (misplaced: it is editor bulk edit)

- **Area**: playbook editor > Outline > checklist bulk edit (multi-select action bar) — NOTE: despite file path/name, this spec tests the **playbook editor outline**, not the run details page.
- **Setup**: `apiInitSetup` team/user; fresh playbook created before each test with 2 checklists (Setup: 3 tasks, Investigation: 2 tasks); viewport macbook-13.
- **Tests**:
  - `bulk edit mode toggle > shows the Bulk edit button` — playbook editor Outline: "Bulk edit" button visible by default.
  - `... > clicking Bulk edit toggles to Exit bulk edit` — clicking toggles label to "Exit bulk edit".
  - `... > clicking Exit bulk edit returns to normal mode` — clicking again reverts to "Bulk edit".
  - `selecting tasks > selecting one task shows the action bar` — selecting a task shows "1 task selected" floating action bar.
  - `... > selecting multiple tasks updates the count in the action bar` — selecting 3 tasks shows "3 tasks selected".
  - `... > deselecting a task updates the count` — deselecting one of two selected tasks drops count to "1 task selected".
  - `... > clicking × in the action bar clears the selection and hides the bar` — "Clear selection" button clears selection and hides action bar.
  - `action bar buttons > shows Assign button` — multi-select action bar shows "Assign" button.
  - `... > shows Delete button` — action bar shows "Delete selected tasks" button.
  - `... > shows the correct selected count` — action bar shows "2 tasks selected" for 2 selected tasks.
  - `bulk delete > deletes a single selected task` — selecting 1 task and confirming delete reduces task count by 1 and clears action bar.
  - `... > deletes multiple selected tasks within the same section` — selecting 2 tasks in same checklist section and deleting removes both.
  - `... > clears the selection after bulk delete` — selection/action bar cleared after delete.
  - `bulk due date > opens a date picker when Due date is clicked` — clicking "Due date" in action bar (no run context) shows relative-duration presets (4h/1d/7d), 3 options.
  - `... > sets a due date on selected tasks via the date picker` — selecting the "1 day" preset applies due date, closes picker, selection preserved ("1 task selected").
  - `bulk edit mode behavior > clicking a task row in bulk edit mode selects it instead of toggling completion` — clicking a task row while in bulk edit mode selects it rather than toggling checkbox completion.
  - `accessibility > clear-selection button has an accessible aria-label` — "Clear selection" button is accessible via `findByLabelText`.
- **Notes**: File location/name under `runs/` and `rdp_*` naming is misleading — content is entirely playbook editor Outline bulk-edit UI, not the run details page. Several `.click({force: true})` calls on action-bar buttons/presets.

### `runs/role_based_assignment_spec.js`

> Scope: editor parts: "Run User" option in task edit + add-task form, sibling assignee_type not wiped, editor role->user clears assignee_type

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
