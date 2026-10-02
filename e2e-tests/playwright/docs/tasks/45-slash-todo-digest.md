# Task 45: /playbook todo and digest links

**Task id**: `slash-todo-digest` · **Kind**: playwright

## Target

- `tests/slash_commands/todo_digest.spec.ts`

## What to do

Target ~3 tests. Runs in progress (count + order); assigned tasks (count updates after closing); overdue runs first. Add the digest link assertions (`?from=digest_overduestatus|runsinprogress|assignedtask`) to the matching tests; if MM-63692 still breaks it, `test.fixme` with the ticket. Replace `cy.wait(1100)` with `expect.poll`.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/slash_command/todo_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/digest_spec.js` | SKIPPED (MM-63692), intent: digest links go to RDP with ?from=digest_* |

### `channels/slash_command/todo_spec.js`

> Scope: all tests

- **Area**: slash command > `/playbook todo` (cross-team run/task/overdue digest)
- **Setup**: 2 teams, 2 users; team1 has playbook with 2 public runs (run1, run2); team2 has playbook with 1 public run (run3); separate playbook "Playbook Other" with 2 runs (run4 + another) owned by testOtherUser, testUser added as member, both forced overdue via `apiUpdateStatus` reminder=1; viewport macbook-13.
- **Tests**:
  - `channels > slash command > todo > /playbook todo should show > three runs` — from team2 town-square, `/playbook todo` post lists "0 runs overdue", "0 assigned tasks", "4 runs currently in progress" with correct run order in `<li>` items (channel post surface).
  - `channels > slash command > todo > /playbook todo should show > four assigned tasks` — after assigning 4 checklist items to self across 3 runs, `/playbook todo` post shows "4 total assigned tasks" grouped by run with correct checklist/task text; after closing 2 items via API, re-running command shows "2 total assigned tasks" with updated list.
  - `channels > slash command > todo > /playbook todo should show > two overdue status updates` — after setting 2 runs' reminder to 1s and waiting, `/playbook todo` run from Playbooks DM channel shows the two overdue runs first.
- **Notes**: Uses `cy.wait(1100)` to let reminder timers elapse — flaky-timing pattern.

### `digest_spec.js`

> Scope: SKIPPED (MM-63692), intent: digest links go to RDP with ?from=digest_*

- **Area**: `/playbook todo` digest message deep links to run details page (RDP)
- **Setup**: whole `describe.skip` block (entire file skipped, see JIRA MM-63692); one run with overdue reminder (1s), one assigned task.
- **Tests**:
  - `[SKIPPED] digest messages > digest message > > has one run overdue and links to RDP` — clicking the overdue-status link in the `/playbook todo` digest post navigates to RDP URL with `?from=digest_overduestatus`.
  - `[SKIPPED] digest messages > digest message > > has one run in progress and links to RDP` — clicking the in-progress-run link navigates to RDP with `?from=digest_runsinprogress`.
  - `[SKIPPED] digest messages > digest message > > has one run with one assigned task and links to RDP` — clicking the assigned-task link navigates to RDP with `?from=digest_assignedtask`.
- **Notes**: Entire file is `describe.skip` (disabled, linked to MM-63692); uses `cy.wait(FIVE_SEC)` after each click — flaky-timing pattern.
