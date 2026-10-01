# Task 42: Channel actions (on-join, keyword prompt)

**Task id**: `channel-actions` · **Kind**: playwright

## Target

- `tests/channels/channel_actions.spec.ts`

## What to do

Target ~5 tests. On-join: category + welcome message in one test; keyword prompt -> run (the dialog part is in start-run-entry-points; here assert the bot prompt); "No, ignore thread" deletes prompt and no re-trigger; disabled trigger does nothing; settings reset when switching channel. Replace the `cy.wait(5000)` (MM-45969 workaround) with a state wait.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/general_actions_spec.js` | all except the IDOR API test (not ported, audited by go-coverage-gaps) |

### `channels/general_actions_spec.js`

> Scope: all except the IDOR API test (not ported, audited by go-coverage-gaps)

- **Area**: channel > Channel Actions modal (built-in Mattermost channel actions as they interact with Playbooks: keyword-triggered "prompt to run a playbook")
- **Setup**: sysadmin-promoted user + separate regular testUser, both with CRT preference off; one action-channel; dynamically created public playbooks per test.
- **Tests**:
  - `on join trigger > channel categorization can be enabled and works` — enabling "sidebar category" channel action with a custom category name causes a joining/reloading user to see the channel under that sidebar category (not a Playbooks-specific feature, baseline for next tests).
  - `on join trigger > welcome message can be enabled and is shown to a joining user` — enabling temporary welcome message channel action shows the ephemeral message to a joining/reloading user (not Playbooks-specific).
  - `keyword trigger > prompt to run playbook can be enabled and works` — setting a keyword trigger + "Prompt to run a playbook" action with a selected playbook causes a bot post prompting to run that playbook when the keyword is posted in channel; clicking 'Yes, run playbook' opens the start-run dialog and starting it shows the run name in the RHS.
  - `keyword trigger > deletes the post and ignores the thread when clicking on No, ignore thread` — clicking 'No, ignore thread' on the bot prompt post deletes that bot post, and replying to the original thread with the same trigger phrase does not re-trigger a new prompt.
  - `keyword trigger > MM-58432 - prevents users from deleting an arbitrary post by crafting a query` — calling the `signal/keywords/ignore-thread` API directly with an arbitrary (non-bot) post_id does not delete that post; same API call with the actual bot prompt post_id does delete it (regression/security test for an IDOR-style vulnerability).
  - `keyword trigger > disabled triggers do not run even with a keyword set` — configuring a keyword but leaving "Prompt to run a playbook" toggled off means posting the keyword produces no bot prompt.
  - `action settings are reset to the default when switching to a channel with no actions configured` — after enabling a channel-categorization action in one channel, switching to a different channel with no configured actions shows the Channel Actions modal with action disabled/default (not leaking state across channels).
- **Notes**: several tests (on join trigger suite) test core Mattermost channel actions unrelated to Playbooks-specific behavior except as setup for the playbook-trigger tests; uses `cy.wait(TIMEOUTS.*)` and a raw `cy.wait(5000)` (flaky-pattern, commented as workaround for MM-45969).
