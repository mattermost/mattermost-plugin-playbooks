# Task 37: Channel RHS run details (name, summary, badge, follow, title)

**Task id**: `rhs-run-details` · **Kind**: playwright

## Target

- `tests/channels/rhs_run_details.spec.ts`

## What to do

Target ~7 tests (`about` and `header` are near-duplicates).
- Name is the run name, not the channel display name; rename updates RHS but not channel header.
- Summary edit persists; finished run: not editable, no "Become a participant" prompt.
- Playbook badge table `{from playbook -> shown and navigates, private playbook without access -> hidden, standalone -> hidden}`.
- Standalone run menu: active has Rename + Finish; finished has Save as playbook + Resume, no Rename.
- Title shows "Checklist", Following -> Follow, click title -> RDP.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/about_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/header_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/title_spec.js` | all tests |

### `channels/rhs/about_spec.js`

> Scope: all tests

- **Area**: RHS (channel) > run header/about section > title, summary, participate icon
- **Setup**: team/user, one playbook; viewport macbook-13; run started per test, navigates directly to run channel.
- **Tests**:
  - `shows name > of active playbook run` — RHS displays the run name.
  - `shows name > of renamed playbook run` — patching channel `display_name` via API does not change the RHS-displayed run name (keeps original run name, not channel name).
  - `edit run name > by clicking on name` — using RHS menu button > 'Rename', editing the run name textarea updates `rendered-run-name` in RHS, while the channel header name (`#channel-header`) remains the original run name.
  - `edit summary > by clicking on placeholder` — clicking the rendered-description placeholder opens an editable textarea; typing + ctrl+enter saves and displays new summary text.
  - `edit summary > [SKIPPED] by clicking on dot menu item` — (MM-63692) intended to verify editing summary via the dot-menu 'Edit run summary' item also works.
  - `participate > icon is not visible if I am a participant` — `rhs-participate-icon` does not exist for a user who is already a participant (e.g. the owner).
- **Notes**: describe block title in-code is `channels > rhs > header` despite file being `about_spec.js` — naming mismatch vs file path, likely historical split between header/about specs.

### `channels/rhs/header_spec.js`

> Scope: all tests

- **Area**: RHS (channel) > run header — name, summary, playbook badge, finished-run restrictions, standalone-run (channel checklist) rename/finish
- **Setup**: team/user, a real playbook, a standalone run with no playbook (`playbookId: ''`, channel checklist, MM-67648), a private playbook + run with a second viewer user added as participant; viewport macbook-13.
- **Tests**:
  - `shows name > of active playbook run` — RHS title shows the run name for an active run.
  - `shows name > of renamed playbook run` — renaming the channel's `display_name` via API does not change RHS-displayed run name.
  - `edit summary > by clicking on placeholder` — editing run summary via placeholder + ctrl+enter persists after page reload.
  - `playbook badge > is shown for runs started from a playbook and navigates to playbook editor when clicked` — RHS shows a 'playbook-badge' with playbook name; clicking it navigates to `/playbooks/{playbookId}` editor.
  - `playbook badge > is hidden for runs started from a playbook I do not have access to` — a viewer participant without access to the source private playbook sees no playbook-badge in that run's RHS.
  - `playbook badge > is hidden for channel checklists` — standalone run (no playbook) shows no playbook-badge.
  - `edit summary of finished run > by clicking on placeholder` — for a finished run, clicking the description placeholder does not show an editable textarea, and no 'Become a participant...' prompt appears.
  - `rename checklist > can rename active checklist from RHS header` — for an active standalone run (channel checklist), RHS header menu shows both 'Rename' and 'Finish' options.
  - `rename checklist > cannot rename finished checklist from RHS header` — after finishing a standalone run, RHS header menu shows 'Save as playbook'/'Resume' but no 'Rename' option.
- **Notes**: significant overlap with `about_spec.js` (both named `channels > rhs > header` in-code, both test run name/summary editing) — likely redundant/split inconsistently; uses raw `cy.wait(TIMEOUTS.TWO_SEC)` once.

### `channels/rhs/title_spec.js`

> Scope: all tests

- **Area**: RHS (channel) > sidebar title bar — title text, follow/unfollow button, click-to-RDP navigation
- **Setup**: team/user, one playbook; run created fresh per test; viewport macbook-13.
- **Tests**:
  - `has title` — RHS sidebar title contains 'Checklist'.
  - `has following button` — RHS title bar shows a 'Following' button (owner auto-follows) and no 'Follow' button.
  - `can stop following` — clicking 'Following' switches it to show a 'Follow' button instead.
  - `can navigate to RDP` — clicking the `rhs-title` test-id element navigates to `/playbooks/runs/{runId}` (RDP).
