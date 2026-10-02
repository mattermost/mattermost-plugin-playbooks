# Task 40: Checklists in DMs / GMs (RHS + RDP)

**Task id**: `dm-gm-checklists` · **Kind**: playwright

## Target

- `tests/channels/dm_gm_checklists.spec.ts`

## What to do

Target ~7 tests.
- Parametrize over `{DM, self-DM, GM}`: create from empty state, add + check task, post status update, assignee selector lists channel members, create dropdown has run-a-playbook + go-to-playbooks.
- Move-channel modal offers DM channels.
- RDP for a DM checklist: direct load, overview entries (incl. self-DM regression 397d5d3f), channel link label + navigates, recent activity after checking a task, View all -> Timeline (no force click), Save as playbook -> outline, hard refresh keeps team in channel link.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/dm_checklist_spec.js` | UI tests (API ones -> not ported, go-coverage-gaps audit) |
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/gm_checklist_spec.js` | UI tests (API ones -> not ported, go-coverage-gaps audit) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_dm_checklist_spec.js` | all tests |

### `channels/rhs/dm_checklist_spec.js`

> Scope: UI tests (API ones -> not ported, go-coverage-gaps audit)

- **Area**: RHS (DM channel) > blank checklists in direct messages (no playbook run)
- **Setup**: team/user, a DM partner, a gating playbook with 1 checklist/item; viewport macbook-13.
- **Tests**:
  - `can create a checklist in a DM via the RHS` — in a fresh 1:1 DM with no runs, clicking 'New checklist' from the 'no-active-runs' empty state creates an 'Untitled checklist' with 'Tasks' section shown in RHS.
  - `can create a checklist in a self-DM via the RHS` — same flow works in a self-DM (DM with oneself).
  - `can add a task and check it off in a DM checklist` — adding a task via RHS and checking its checkbox marks it checked.
  - `can post a status update in a DM checklist` — posting a status update (via `cy.updateStatus` helper with a 60 min reminder) on a DM checklist posts the update message visibly in the DM channel.
  - `shows channel members in task assignee selector` — opening a task's assignee selector in a DM checklist shows the DM partner as an assignable user.
  - `rejects playbook run creation in a DM via API` — API call to run an actual playbook (not blank checklist) into a DM channel returns 400 (gated/rejected).
  - `"Run a playbook" is available in the DM channel dropdown` — with 2 existing blank-checklist runs in a DM (list view), opening the create-dropdown chevron next to 'New checklist' shows both 'create-from-playbook' and 'go-to-playbooks' options (gating happens elsewhere, not in this dropdown).
  - `move-channel modal offers DM channels for checklists` — from the run list's dot menu > 'Move to a different channel', typing a target DM partner's username in the channel selector shows a matching DM channel option.
  - `moving a DM checklist to a public channel populates team_id` — via API, updating a DM-created run's channel to a public channel populates `team_id` correctly on the run (verified via `apiGetPlaybookRun`).
- **Notes**: last test is really an API-only test despite being in a UI-oriented spec file; heavy duplication of structure with `gm_checklist_spec.js` (same scenarios, DM vs GM) — strong consolidation candidate.

### `channels/rhs/gm_checklist_spec.js`

> Scope: UI tests (API ones -> not ported, go-coverage-gaps audit)

- **Area**: RHS (GM channel) > blank checklists in group messages (no playbook run)
- **Setup**: team/user, 2 GM partners + a shared GM channel, plus a gating playbook; viewport macbook-13.
- **Tests**:
  - `can create a checklist in a GM via the RHS` — in a fresh GM with no runs, clicking 'New checklist' from empty state creates 'Untitled checklist' in RHS.
  - `can add a task and check it off in a GM checklist` — adding a task and checking it off works in a GM checklist.
  - `can post a status update in a GM checklist` — posting a status update via `cy.updateStatus` shows the update message in the GM channel.
  - `shows channel members in task assignee selector` — task assignee selector in a GM checklist lists both GM partner usernames.
  - `rejects playbook run creation in a GM via API` — API call to run a real playbook into a GM channel returns 400.
  - `"Run a playbook" is available in the GM channel dropdown` — with 2 existing blank-checklist runs in a GM (list view), the create-dropdown shows 'create-from-playbook' and 'go-to-playbooks' options.
  - `moving a GM checklist to a public channel populates team_id` — via API, moving a GM-created run's channel to a public channel sets `team_id` correctly on the run.
- **Notes**: near-duplicate of `dm_checklist_spec.js` (same test scenarios applied to GM instead of DM, minus the "move-channel modal offers ... channels" UI test); last test is API-only despite UI-focused file; strong consolidation candidate with the DM spec.

### `runs/rdp_dm_checklist_spec.js`

> Scope: all tests

- **Area**: RDP (backstage run details page) for DM/GM "teamless" checklist runs
- **Setup**: `apiInitSetup` team/user; per-test DM partner(s) created; checklist runs created either via RHS empty-state "create-blank-checklist" flow or directly via `apiRunPlaybook` with empty teamId/playbookId + DM `channelId`; viewport macbook-13.
- **Tests**:
  - `direct fetch loads backstage detail page for DM/GM checklist` — RHS (DM channel) + RDP: creating blank checklist via RHS, then navigating directly to `/playbooks/runs/:id` renders header with run name "Untitled checklist" and summary section.
  - `overview panel shows Owner, Participants, and Followers entries` — RDP: overview panel shows `runinfo-owner` (contains testUser), `runinfo-participants`, `runinfo-following` for a DM checklist run.
  - `channel link in RHS Info shows DM partner display name` — RDP: `runinfo-channel-link` shows DM partner's username and links to `/team/messages/@partner`.
  - `clicking channel link navigates to DM conversation` — RDP: clicking channel link navigates to the DM channel URL and loads post textbox.
  - `Recent Activity panel has entries after checking a task` — RHS + RDP: checking a task in RHS creates a timeline event; RDP `rhs-timeline` shows at least 1 `li` entry.
  - `Timeline panel shows entries when opened from backstage detail` — RDP: clicking "View all" in Recent Activity switches RHS title to "Timeline", shows back button and `timeline-view`.
  - `Save as playbook from DM checklist navigates to new playbook outline` — RDP: run header kebab menu "Save as playbook" navigates to new playbook's `/outline` URL.
  - `hard refresh keeps team context after navigating to DM checklist detail` — RDP: after `cy.reload()`, `runinfo-channel-link` href still correctly includes team name prefix (regression test for team-context fallback on hard refresh).
  - `overview panel renders Owner, Participants, and Followers for self-DM checklist (regression 397d5d3f)` — RDP: self-DM (user DMing themselves) checklist run shows Owner/Participants/Followers sections (previously hidden by incorrect isSelfDM check); channel link resolves to self-DM URL with own username.
- **Notes**: Explicitly references regression commit `397d5d3f` in comments. Heavy use of `{force: true}` click on "View all" link (flagged inline with eslint-disable comment) due to opacity-transition animation — a flaky-pattern risk noted by the spec author itself.
