# Task 13: Run details page right sidebar (Info, key metrics, timeline, status updates list)

**Task id**: `rdp-sidebar` · **Kind**: playwright

## Target

- `tests/runs/rdp_sidebar.spec.ts`

## What to do

Target ~8 tests.
- Info/Timeline header buttons toggle (one test; no sleep between clicks, wait on title change).
- Overview: playbook link, owner, participants -> list view -> back; channel link navigates and survives finish; deleted channel shows "Channel deleted"; standalone run hides playbook entry.
- Key metrics: table `{no metrics, metrics + retro on, metrics + retro off}` -> section shown/hidden; when shown: View Retrospective link, metric anchors, "Add value..." placeholder, typing values renders formatted results.
- Recent activity contains timeline; View all -> Timeline view.
- Status updates list: hidden with no updates; with 2 updates shows both newest first with author.

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
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_rhs_spec.js` | participant tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_rhs_runinfo_spec.js` | participant overview/key metrics/recent activity (Following toggle -> participants; viewer -> rdp-viewer) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_rhs_statusupdates_spec.js` | participant tests |

### `runs/rdp_rhs_spec.js`

> Scope: participant tests

- **Area**: RDP > RHS header toggle buttons (Info / Timeline)
- **Setup**: Public playbook, testUser (owner) + testViewerUser (non-participant); macbook-13 viewport.
- **Tests**:
  - `as participant > timeline button toggles timeline in the RHS` — RHS header "timeline" button switches RHS title Info→Timeline, clicking again closes the RHS.
  - `as participant > info button toggles info in the RHS` — RHS header "info" button closes RHS from Info state, clicking again reopens Info.
  - `as viewer > timeline button toggles timeline in the RHS` — (shared) same toggle behavior for non-participant viewer.
  - `as viewer > info button toggles info in the RHS` — (shared) same toggle behavior for viewer.
- **Notes**: `commonTests` shared between participant/viewer, duplicate titles. Fixed `cy.wait(500)` between clicks "so we don't double-click" (flaky-prone pattern/workaround comment).

### `runs/rdp_rhs_runinfo_spec.js`

> Scope: participant overview/key metrics/recent activity (Following toggle -> participants; viewer -> rdp-viewer)

- **Area**: RDP > RHS "Info" panel (overview entries, key metrics, recent activity/timeline link)
- **Setup**: Public playbook, testUser (owner), testViewerUser (non-participant), plus a `testChannel` from `apiInitSetup`; separate playbooks with/without metrics and with retrospective enabled/disabled; macbook-13 viewport.
- **Tests**:
  - `> overview > as participant > Playbook entry is visible and links to the playbook` — (shared) RHS overview "playbook" entry links to playbook editor page.
  - `> overview > as participant > Owner entry shows the owner` — (shared) RHS "owner" entry shows username.
  - `> overview > as participant > Participants entry shows the participants` — (shared) RHS "participants" entry renders user avatars.
  - `> overview > as participant > clicking on Participants show the full list of participants` — clicking participants entry switches RHS to "Participants" list view with count and back button returns to "Info".
  - `> overview > as participant > Following button can be toggled` — RHS "following" entry Following/Follow button toggles and updates the follower user-row list.
  - `> overview > as participant > click channel link navigates to run's channel` — RHS "channel" entry link navigates to the run's channel.
  - `> overview > as participant > channel is still there when the run is finished` — after finishing run, channel entry/link still present and functional.
  - `> overview > as participant > indicates when the channel has been deleted` — after deleting channel via API, RHS channel entry shows "Channel deleted".
  - `> overview > as participant > Playbook entry is hidden for standalone run without playbook` — standalone/channel-checklist run (empty playbookId) hides "playbook" entry but keeps owner/participants/channel entries.
  - `> overview > as viewer > Playbook entry is visible.../Owner.../Participants.../clicking on Participants...` — (shared, repeated for viewer).
  - `> overview > as viewer > Playbook entry is hidden when playbook is private` — viewer added as participant to a run from a private playbook does not see "playbook" entry (but sees owner/participants).
  - `> overview > as viewer > Following button can be toggled` — viewer's Follow/Following toggle updates follower count/list.
  - `> overview > as viewer > there is no channel link but can request to join` — viewer sees "Private" channel label, no link/button until becoming participant, then can click request-join button and "Send request" to post a join request.
  - `> key metrics > playbook without metrics > it should not render > as participant` — RHS "Key Metrics" section absent when playbook has no metrics.
  - `> key metrics > playbook without metrics > it should not render > as viewer` — same absence check for viewer.
  - `> key metrics > playbook with metrics (enabled retro) > as participant > key metrics is present` — (shared) Key Metrics section renders.
  - `> key metrics > ... > as participant > link scrolls to retrospective` — (shared) "View Retrospective" link updates URL hash to `#playbook-run-retrospective`.
  - `> key metrics > ... > as participant > metric items scroll to corresponding metric` — (shared) clicking each metric updates URL hash to that metric's anchor.
  - `> key metrics > ... > as participant > metric items show Add value if empty` — empty metrics show "Add value..." placeholder.
  - `> key metrics > ... > as participant > click on metric items, type and see the result in the RHS` — typing duration/currency/integer values in RHS metric inputs renders formatted result (e.g. "12d, 6h, 3m").
  - `> key metrics > ... > as viewer > key metrics is present / link scrolls.../ metric items scroll...` — (shared, repeated for viewer).
  - `> key metrics > ... > as viewer > metric items show - if empty` — empty metric values show "-" placeholder for viewer (read-only).
  - `> key metrics > playbook with metrics (disabled retro) > as participant > key metrics is hidden` — Key Metrics section absent when playbook retro disabled, even with metrics configured.
  - `> key metrics > playbook with metrics (disabled retro) > as viewer > key metrics is hidden` — same for viewer.
  - `> recent activity > as participant > recent activity is present and it contains a timeline` — (shared) RHS "Recent Activity" section contains `rhs-timeline`.
  - `> recent activity > as participant > link switches the RHS to Timeline` — (shared) "View all" link switches RHS to full "Timeline" view with back button.
  - `> recent activity > as viewer > recent activity.../link switches...` — (shared, repeated for viewer).
- **Notes**: Extensive use of shared `commonTests()` helpers across participant/viewer causing duplicated test titles. One `cy.wait(500)` and one `cy.wait(1000)` fixed wait (comment explains re-render/dropped-keystroke workaround).

### `runs/rdp_rhs_statusupdates_spec.js`

> Scope: participant tests

- **Area**: RDP > RHS "Status updates" list view (opened via "View all updates" link)
- **Setup**: Public playbook, testUser (owner) + testViewerUser (non-participant); macbook-13 viewport.
- **Tests**:
  - `as participant > rhs can not be open when there is no updates` — "View all updates" link absent in status-update section when no updates posted yet.
  - `as participant > link opens the RHS when there are updates` — after posting 2 status updates via API, "View all updates" opens RHS with title "Status updates", subtitle = run name, and both messages listed in reverse-chronological order with author username.
  - `as viewer > rhs can not be open when there is no updates` — same absence check for non-participant viewer.
  - `as viewer > link opens the RHS when there are updates` — same RHS open/list-order/content check for viewer.
