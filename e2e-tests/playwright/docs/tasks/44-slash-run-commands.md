# Task 44: /playbook run commands (check, checkadd, checkremove, owner, timeline, finish, update)

**Task id**: `slash-run-commands` · **Kind**: playwright

## Target

- `tests/slash_commands/run_commands.spec.ts`

## What to do

Target ~8 tests.
- Single-run happy paths: check (+ autocomplete count), checkadd, checkremove, timeline, finish (confirm), update (dialog -> post).
- Multi-run disambiguation: ONE table across subcommands `{missing args, invalid run number, view-only run -> "Become a participant"}` instead of repeating per command; then valid write-access paths; timeline allowed on view-only.
- Owner: table `{no args -> shows owner, unknown user (with/without @), user not in channel (with/without @) -> changes, already owner, two usernames -> error, valid change}`; error outside a run channel.
- Drop the cross-suite `switchToChannel` import; use page objects.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/slash_command/commands_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/channels/slash_command/owner_spec.js` | all tests |

### `channels/slash_command/commands_spec.js`

> Scope: all tests

- **Area**: channel post > `/playbook` slash commands (check, checkadd, checkremove, owner, timeline, finish, update) in single-run and multi-run channels, including run-number disambiguation and permission gating
- **Setup**: team/user + second user; single-run suite uses one playbook with 2 checklists x 2 items and one run; multi-run suite creates private ('write access' participant added, 'no access' not added) and public (view-access) playbook runs all sharing one channel, with testUser2 as a channel member but only a participant on one run.
- **Tests**:
  - `single run channel > check` — typing `/playbook check ` shows 5 autocomplete suggestions (1 run x 4 tasks + title); running `/playbook check 1 1` checks that task's checkbox.
  - `single run channel > check add` — `/playbook checkadd 1 new-task` adds a new task to checklist 1, visible in RHS.
  - `single run channel > check remove` — `/playbook checkremove 1 1` removes 'Step 2' from checklist 1.
  - `single run channel > owner` — `/playbook owner` reports current owner; `/playbook owner @user2` reassigns, confirmed by re-running `/playbook owner`.
  - `single run channel > timeline` — `/playbook timeline` shows ephemeral message 'Timeline for {runName}'.
  - `single run channel > finish` — `/playbook finish` shows a confirm modal; confirming finishes the run (RHS shows 'Done' button, no errors).
  - `multiple runs in the channel > check` — in a channel with 3 runs (write/view/no access) for testUser2: missing args shows 'expects three arguments' error; wrong run number shows 'Invalid run number'; targeting a view-only run shows 'Become a participant to interact with this run'; autocomplete shows 9 suggestions (2 accessible runs x4 tasks +title); valid command on write-access run (`check 1 1 1`) checks the task and RHS shows 2 run cards (only accessible runs listed).
  - `multiple runs in the channel > check add` — same argument-count/run-number/permission-gating error pattern for checkadd; valid command adds a new task; RHS shows 2 accessible run cards.
  - `multiple runs in the channel > check remove` — same error pattern for checkremove; valid command removes 'Step 2'; RHS shows 2 accessible run cards.
  - `multiple runs in the channel > owner` — argument-count/run-number/permission-gating errors for owner reassignment; view-access run blocks reassignment attempt ('Become a participant...'); write-access run allows reassignment, confirmed by re-query; autocomplete suggestion counts verified (3 = 2 runs + title).
  - `multiple runs in the channel > finish` — argument/run-number/permission errors for finish; view-access run blocks with 'You do not have permission to finish this run.'; write-access run finish succeeds via confirm modal.
  - `multiple runs in the channel > timeline` — argument/run-number errors for timeline; view-access run (`timeline 0`) still shows timeline for that run (timeline viewable without write access).
  - `multiple runs in the channel > update` — argument/run-number errors for update; valid `/playbook update 1` opens status update dialog, submitting posts the update to channel.
- **Notes**: very large, comprehensive slash-command permission/disambiguation test matrix; imports a helper (`switchToChannel`) from the core Channels test suite (`../../../channels/mark_as_unread/helpers`), an unusual cross-suite dependency.

### `channels/slash_command/owner_spec.js`

> Scope: all tests

- **Area**: slash command > `/playbook owner`
- **Setup**: 2 team members (testUser, testUser2), one playbook with 2 checklists, one run owned by testUser; viewport macbook-13; owner reset to testUser before each test.
- **Tests**:
  - `channels > slash command > owner > /playbook owner > should show an error when not in a playbook run channel` — running `/playbook owner` in town-square (non-run channel) shows ephemeral error "This command only works when run from a playbook run channel."
  - `channels > slash command > owner > /playbook owner > should show the current owner` — running `/playbook owner` in the run channel shows ephemeral message naming current owner.
  - `channels > slash command > owner > /playbook owner @username > should show an error when not in a playbook run channel` — same error as above when targeting a specific user outside a run channel.
  - `channels > slash command > owner > /playbook owner @username > should show an error when the user is not found > when the username has no @-prefix` — `/playbook owner unknown` shows "Unable to find user @unknown".
  - `channels > slash command > owner > /playbook owner @username > should show an error when the user is not found > when the username has an @-prefix` — same with `@unknown` prefix, same error.
  - `channels > slash command > owner > /playbook owner @username > should not show an error when the user is not in the channel > when the username has no @-prefix` — after kicking testUser2 from channel, `/playbook owner testUser2` still changes owner (RHS owner-profile-selector shows new owner).
  - `channels > slash command > owner > /playbook owner @username > should not show an error when the user is not in the channel > when the username has an @-prefix` — same with `@`-prefixed username.
  - `channels > slash command > owner > /playbook owner @username > should show a message when the user is already the owner > when the username has no @-prefix` — setting owner to current owner shows "User @x is already owner of this playbook run."
  - `channels > slash command > owner > /playbook owner @username > should show a message when the user is already the owner > when the username has an @-prefix` — same with @-prefix.
  - `channels > slash command > owner > /playbook owner @username > should change the current owner > when the username has no @-prefix` — invites testUser2 then changes owner via slash command; RHS owner-profile-selector reflects new owner.
  - `channels > slash command > owner > /playbook owner @username > should change the current owner > when the username has an @-prefix` — same with @-prefix.
  - `channels > slash command > owner > /playbook owner @username > should show an error when specifying more than one username` — passing two usernames shows ephemeral error "/playbook owner expects at most one argument."
