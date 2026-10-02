# Task 36: Channel RHS auto-open rules + /playbook info

**Task id**: `rhs-auto-open` · **Kind**: playwright

## Target

- `tests/channels/rhs_auto_open.spec.ts`

## What to do

Target ~3 test bodies.
- One table of `{entry: direct URL | LHS click | slash command start | editor run linked to existing channel | app bar icon, runState: none|ongoing|finished|new, rhsPreOpen: none|saved messages} -> expected (closed | run | no-active-runs | home)`.
- Icon toggles RHS Home open/closed.
- `/playbook info`: table `{non-run channel -> error, RHS closed -> opens, RHS open -> ephemeral}`.
- The Cypress spec used 2-5s sleeps for websocket ordering: wait on observable state instead.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/channels/slash_command/info_spec.js` | all tests |

### `channels/rhs_spec.js`

> Scope: all tests

- **Area**: channel RHS > auto-open/auto-close behavior for the Playbooks RHS
- **Setup**: team/user, one public playbook (no run yet, created per test).
- **Tests**:
  - `does not open > when navigating to a non-playbook run channel` — visiting a channel without a run does not auto-open RHS.
  - `does not open > when navigating to a playbook run channel with the RHS already open` — if another RHS (Saved messages) is open and user navigates via LHS into a run channel, the run RHS is still not auto-opened (existing RHS state doesn't trigger run RHS).
  - `does not open > when navigating directly to a finished playbook run channel` — direct URL visit to a finished run's channel does not auto-open RHS.
  - `does not open > for an existing, finished playbook run channel opened from the lhs` — clicking a finished run channel in LHS (from a different channel) does not auto-open RHS.
  - `does not open > for a new, finished playbook run channel opened from the lhs` — a run started then immediately finished, opened via LHS click, does not auto-open RHS.
  - `does not open > when running a playbook from the editor and linking to an existing channel` — starting a run from the playbook editor/outline and linking to an existing channel (not creating new) navigates to the run's RDP (backstage page), not into the channel with RHS; RHS not open.
  - `opens > when navigating directly to an ongoing playbook run channel` — direct URL visit to an ongoing run's channel auto-opens RHS, showing run name in `menuButton`.
  - `opens > for a new, ongoing playbook run channel opened from the lhs` — starting a run then clicking its channel in LHS (from another channel) opens RHS with run name.
  - `opens > for an existing, ongoing playbook run channel opened from the lhs` — run started before navigation, then opened via LHS click, auto-opens RHS with run name.
  - `opens > when starting a playbook run` — starting a run via slash command auto-opens RHS with run name.
  - `opens > when starting a playbook run when rhs is already open` — even if Saved Messages RHS is already open, starting a run via slash command switches RHS to show the run (overriding other RHS content).
  - `opens > when navigating directly to a finished playbook run channel and clicking on the button` — for a finished run channel, clicking the Playbooks App Bar icon opens RHS showing a 'no-active-runs' empty state (since the run already finished).
  - `is toggled > by icon in channel header` — clicking the Playbooks App Bar icon in a non-run channel opens the RHS Home ('Playbooks' list); clicking again closes the RHS.
- **Notes**: heavy use of `cy.wait(TIMEOUTS.*)` (TWO_SEC/FIVE_SEC) flagged in comments as needed to avoid flakiness/out-of-order websocket events; large suite focused purely on RHS auto-open/close logic across many entry paths (direct visit, LHS click, slash command, editor flow).

### `channels/slash_command/info_spec.js`

> Scope: all tests

- **Area**: channel post > `/playbook info` slash command (RHS open/close behavior)
- **Setup**: team/user + second user, one playbook, one run; viewport macbook-13; resets run owner to testUser before each test.
- **Tests**:
  - `/playbook info > should show an error when not in a playbook run channel` — running `/playbook info` in a non-run channel (town-square) shows ephemeral error 'This command only works when run from a playbook run channel.'.
  - `/playbook info > should open the RHS when it is not open` — with RHS manually closed in a run channel, running `/playbook info` reopens the RHS.
  - `/playbook info > should show an ephemeral post when the RHS is already open` — with RHS already open, running `/playbook info` shows ephemeral message 'Your playbook run details are already open in the right hand side of the channel.' instead of re-triggering anything.
