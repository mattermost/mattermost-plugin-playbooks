# Task 26: Run visibility permission matrix (table-driven)

**Task id**: `run-visibility` · **Kind**: playwright

## Target

- `tests/runs/run_visibility.spec.ts`

## What to do

One data table `{playbookVisibility, channelVisibility, role, inList, rdpAccess}` driving one test body (Playwright generates one test per row). Seed all users/teams/playbooks/runs once in `beforeAll`.
- Roles: playbook member, run participant, run follower, team member, non-team member, sysadmin in team, sysadmin not in team.
- **Bug**: the Cypress test "private playbook + private channel > should be visible > to run followers" asserts NOT visible. Encode the real expectation with a correct row name (check server behavior).
- Unfollow: no-RunView user gets "Run not found"; playbook member can unfollow from RDP.
- Document the "sysadmin not in team sees overview but not list" inconsistency in a comment as the Cypress spec did.

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
| `e2e-tests/cypress/tests/integration/playbooks/runs/permissions_spec.js` | all tests |

### `runs/permissions_spec.js`

> Scope: all tests

- **Area**: run visibility/access permissions across playbook/channel visibility combinations (public/private playbook x public/private channel), plus unfollow permission
- **Setup**: `apiInitSetup` team/user plus dedicated users: playbookMember, runParticipant, runFollower, teamMember, nonTeamMember, sysadminInTeam (via `apiCreateCustomAdmin`), second team with sysadminNotInTeam; baseline "decoy" playbook+run created in each team so lists aren't empty.
- **Tests** (`run with private channel from a public playbook`):
  - `should be visible > to playbook members` / `to run participants` / `to run followers` / `to team members` / `to admins in the team` — backstage runs list + RDP: each role can find run in `#playbookRunList` and open RDP header showing run name.
  - `should be visible > to admins not in the team (overview only)` — RDP direct visit: sysadmin outside team can open run overview directly even though absent from list (documented inconsistency, marked with XXX comment).
  - `should not be visible > to non-team members` — backstage list + RDP: non-team-member sees neither list entry nor overview (shows "Run not found" error).
  - `should not be visible > to admins not in the team (list only)` — backstage list: sysadmin outside team does not see run in list.
- **Tests** (`run with public channel from a public playbook`): same 7 sub-tests repeated for public-channel run variant.
- **Tests** (`run with private channel from a private playbook`):
  - `should be visible > to playbook members` / `to run participants` / `to admins in the team` — visible as above.
  - `should be visible > to run followers` — **inverted**: run followers cannot see this run (comment: "Followers cannot follow a run with a private channel from a private playbook") — asserts NOT visible.
  - `should be visible > to admins not in the team (run directly)` — sysadmin outside team can view overview directly.
  - `should not be visible > to team members` / `to non-team members` / `to admins not in the team (list only)` — team members (non-playbook-members) and non-team members cannot see private playbook's run at all.
- **Tests** (`unfollow permission check`):
  - `user without RunView cannot reach the run page` — RDP: team member without playbook access sees "Run not found" error page.
  - `playbook member can unfollow via the run details page` — RDP: playbook member follows then clicks "Following" button to unfollow, button changes to "Follow".
- **Tests** (`run with public channel from a private playbook`): repeats the private-playbook visibility matrix (7 sub-tests) for a public-channel variant.
- **Notes**: File has `/* eslint-disable no-only-tests/no-only-tests */` at top (guards against accidental `.only`, not an active skip). Large permission-matrix spec with substantial structural duplication across the four describe blocks (private/public playbook x private/public channel) — good consolidation candidate via parameterization in Playwright rewrite. Helper functions `assertRunIsVisible`/`assertRunIsNotVisible`/`assertRunOverviewIsVisible`/`assertRunIsNotVisibleInList`/`assertRunOverviewIsNotVisible` shared across all blocks.
