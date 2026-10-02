# Task 32: Task actions (keyword/user triggers) - merged editor + run

**Task id**: `task-actions` · **Kind**: playwright

## Target

- `tests/runs/task_actions.spec.ts`

## What to do

Target ~7 tests. Both Cypress specs exercise the same modal with the same 11 cases.
- Config validation table (in editor, verify via API): `{no keywords -> disabled, user without keyword -> disabled, unknown user -> ignored, removing all keywords -> disabled}`.
- Trigger behavior on a run: single keyword checks task + timeline entry; multi-word phrase; removed keyword stops triggering while remaining one works; user restriction (only that user triggers); multiple users; one post triggers in multiple runs in the same channel.
- The modal is reached via a CSS icon (`.icon-lightning-bolt-outline`) in Cypress: find an accessible name or add one in the component.

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
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/task_actions_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_taskactions_spec.js` | all tests |

### `playbooks/edit/task_actions_spec.js`

> Scope: all tests

- **Area**: playbook editor > checklist task > "Task actions" modal (keyword/user trigger → mark-as-done automation)
- **Setup**: 2 team users; one playbook with 1 checklist/1 task per test; uses `editTask()`/`getTaskActionsButton()` helpers; asserts final state via `cy.apiGetPlaybook` parsing `task_actions[0].trigger.payload` / `actions[0].payload` JSON.
- **Tests**:
  - `playbooks > edit > task actions > disallows no keywords` — enabling "Mark the task as done" trigger with zero keywords and saving results in `actions.enabled=false`, empty keywords/user_ids (silently rejected).
  - `... > allows a single keyword` — adding one keyword + enabling trigger persists `keywords: ['keyword1']`, `actions.enabled=true`, shown as "1 action" badge.
  - `... > allows multiple keywords` — two keywords both persist in order.
  - `... > allows multi-word phrases` — a full phrase string is stored as a single keyword entry.
  - `... > allows removing previously configured keywords` — reopening the modal and removing one keyword via its "x" leaves the other persisted.
  - `... > disables when all keywords removed` — removing all keywords (even with trigger previously enabled) reverts to `actions.enabled=false`, empty keywords.
  - `... > disallows a user without keywords` — adding only a user (no keyword) and enabling trigger still saves `user_ids` but `actions.enabled=false` (keyword required to actually enable).
  - `... > allows a single user` — keyword + one user both persist, `actions.enabled=true`.
  - `... > allows configuring multiple users` — keyword + two users persist in order, `actions.enabled=true`.
  - `... > rejects unknown user` — typing an unrecognized `@unknown` username is not added to `user_ids` (stays empty) while keyword and enabled flag still save correctly.
  - `... > allows removing previously configured users` — removing one of two configured users via its "x" leaves the other, keyword/enabled preserved.
- **Notes**: Uses `.wait(TIMEOUTS.ONE_SEC)` repeatedly after typing usernames before pressing enter — flaky-timing pattern; assertions rely on parsing internal JSON payload strings from the API rather than UI state for most of the verification (API-heavy verification style).

### `runs/rdp_main_taskactions_spec.js`

> Scope: all tests

- **Area**: RDP main > checklist > per-task "task actions" (keyword/user trigger → mark task as done)
- **Setup**: Playbook with one checklist/task ("Test Checklist"/"Test Task"); testUser (owner) + testUser2 (same team, added to channel per test). Task-actions configured via lightning-bolt icon modal in checklist item edit mode.
- **Tests**:
  - `keywords trigger - mark task as done > disallows no keywords` — enabling "Mark the task as done" trigger with no keywords/users saves as disabled (actions.enabled=false, verified via API).
  - `keywords trigger - mark task as done > allows a single keyword` — configuring a single keyword trigger; posting message containing keyword in channel checks the checklist item and adds a `task_state_modified` timeline entry.
  - `keywords trigger - mark task as done > allows multiple keywords` — configuring two keywords; message with either keyword activates the trigger (tested with 2nd keyword).
  - `keywords trigger - mark task as done > allows multi-word phrases` — multi-word phrase keyword triggers on matching message.
  - `keywords trigger - mark task as done > allows removing previously configured keywords` — removing one of two keywords via modal persists remaining keyword only; removed keyword no longer triggers, remaining one still does.
  - `keywords trigger - mark task as done > disables when all keywords removed` — removing all keywords disables trigger (actions.enabled=false) and no activation occurs on matching message.
  - `keywords trigger - mark task as done > disallows a user without keywords` — configuring only a user (no keywords) leaves trigger disabled.
  - `keywords trigger - mark task as done > allows a single user` — configuring keyword+user restricts trigger to only activate when THAT user posts the keyword (other users' matching posts don't trigger).
  - `keywords trigger - mark task as done > allows configuring multiple users` — two users configured; either user's matching post triggers the action (checked via reset-uncheck then re-trigger by 2nd user).
  - `keywords trigger - mark task as done > rejects unknown user` — typing `@unknown` user mention is not added to user_ids list; keyword-only trigger still works for any user.
  - `keywords trigger - mark task as done > allows removing previously configured users` — removing one of two configured users leaves other user's trigger active, removed user's post does not trigger.
  - `keywords trigger - mark task as done, multiple runs in a channel > triggers` — two runs in same channel each configured with same keyword; one channel post with the keyword triggers task completion in BOTH runs (verified via API state).
- **Notes**: Heavy use of fixed `cy.wait(1000)`/`cy.wait(TIMEOUTS.ONE_SEC)`/`cy.wait(TIMEOUTS.HALF_SEC)` waits for UI/async state settling (flaky-prone pattern). Uses CSS selectors (`.icon-lightning-bolt-outline`, `.modal-body`) rather than testIds for the task-actions modal.
