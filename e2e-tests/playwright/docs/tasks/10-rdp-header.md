# Task 10: Run details page header + summary

**Task id**: `rdp-header` · **Kind**: playwright

## Target

- `tests/runs/rdp_header.spec.ts`

## What to do

Target ~8 tests.
- Title + In Progress badge + copy link (header icon and context menu item as one test; assert clipboard via `page.evaluate(navigator.clipboard.readText)` with granted permissions).
- Rename via context menu persists after reload.
- Favorite toggles the run in the LHS Favorites group.
- Summary: placeholder, edit + "Last edited", cancel discards, no edit once finished.
- Leave run: needs another participant + owner change first. The Cypress comment mentions a known FE bug with the Participate button afterwards; if it reproduces, use `test.fixme` with the reason.

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
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_header_spec.js` | participant: title/badge/copy-link, context menu (show, copy link, rename), favorite, leave run. NOT run-actions/broadcast (run-actions), finish (finish-restore), participate (participants), viewer (rdp-viewer) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_summary_spec.js` | participant tests only |
| `e2e-tests/cypress/tests/integration/playbooks/api/graphql_request_headers_spec.js` | fold in as one `page.waitForRequest` assertion while loading the RDP (single content-type header) as long as the RDP still uses GraphQL |

### `runs/rdp_main_header_spec.js`

> Scope: participant: title/badge/copy-link, context menu (show, copy link, rename), favorite, leave run. NOT run-actions/broadcast (run-actions), finish (finish-restore), participate (participants), viewer (rdp-viewer)

- **Area**: RDP main > run header (title, status badge, run actions modal, context dropdown, participate/favorite)
- **Setup**: Two public playbooks (one with `createPublicPlaybookRun: true`), testUser (owner) and testViewerUser (non-participant); macbook-13 viewport.
- **Tests**:
  - `as participant > title, icons and buttons > shows the title` — RDP header h1 displays run name.
  - `as participant > title, icons and buttons > shows the in-progress status badge` — RDP header badge shows "In Progress".
  - `as participant > title, icons and buttons > has a copy-link icon` — RDP header copy-link icon shows tooltip, copies run URL to clipboard, tooltip updates to "Copied!".
  - `as participant > title, icons and buttons > has not participate button` — RDP header hides "Participate" button for existing participant.
  - `as participant > run actions > modal behaviour > shows and hides as expected` — RDP run-actions modal opens/closes via Cancel and Save.
  - `as participant > run actions > modal behaviour > can not save an invalid form` — RDP run-actions modal: invalid webhook URL shows "Invalid webhook URLs" error and blocks save.
  - `as participant > run actions > modal behaviour > honours the settings from the playbook` — RDP run-actions modal pre-populates broadcast channel and webhook settings inherited from playbook config.
  - `as participant > trigger: when a status update is posted > action: Broadcast update to selected channels > shows channel information on first load` — RDP run-actions modal: broadcast channels persist and display full channel names after reload.
  - `as participant > trigger: when a status update is posted > action: Broadcast update to selected channels > broadcasts to two channels configured when it is enabled` — status update posted via API broadcasts message to both configured channels (channel posts verified).
  - `as participant > trigger: when a status update is posted > action: Broadcast update to selected channels > does not broadcast if it is disabled, even if there are channels configured` — disabling broadcast toggle prevents status update message from appearing in configured channels.
  - `as participant > context menu > shows on click` — RDP header title click opens context dropdown menu.
  - `as participant > context menu > can copy link` — context dropdown "Copy link" copies run URL to clipboard.
  - `as participant > context menu > can rename run` — RDP header rename via dropdown edits h1 title inline, persists after reload.
  - `as participant > context menu > finish run > can be confirmed` — dropdown "Finish" opens confirm modal; confirming removes "Finish" option and sets badge to "Finished".
  - `as participant > context menu > finish run > can be canceled` — dropdown "Finish" + cancel keeps "Finish" option and "In Progress" badge.
  - `as participant > context menu > run actions > modal can be opened` — dropdown "Actions" opens Run Actions modal; cancel closes it.
  - `as participant > context menu > leave run > can leave run` — adding another participant, changing owner, then "Leave and unfollow" + confirm removes run from LHS (note: Participate button assertion noted as currently failing/non-updating).
  - `as viewer > title, icons and buttons > shows the title` — (shared) header title visible for viewer.
  - `as viewer > title, icons and buttons > shows the in-progress status badge` — (shared) badge visible for viewer.
  - `as viewer > title, icons and buttons > has a copy-link icon` — (shared) copy link works for viewer.
  - `as viewer > title, icons and buttons > Favorite > add and remove from LHS` — RDP header star/favorite icon toggles run's presence in LHS.
  - `as viewer > title, icons and buttons > Participate > shows button` — RDP header shows "Participate" button for non-participant viewer.
  - `as viewer > title, icons and buttons > Participate > Join action enabled > click button to show modal and cancel` — Participate modal shown, cancel leaves user not added to channel (verified via last post not mentioning user).
  - `as viewer > title, icons and buttons > Participate > Join action enabled > click button to show modal and confirm when private channel` — confirming Participate modal adds run to LHS and (if accessible) shows channel header.
  - `as viewer > title, icons and buttons > Participate > Join action enabled > click button and confirm to when public channel` — same Participate flow for a public-channel run; verifies LHS and channel header.
  - `as viewer > title, icons and buttons > Participate > Join action disabled > join the run with private channel, request to join the channel` — with `createChannelMemberOnNewParticipant: false`, checking "also add to channel" posts a join-request message in channel.
  - `as viewer > title, icons and buttons > Participate > Join action disabled > join the run with private channel, no request to join the channel` — without checking the box, no join-request message is posted.
  - `as viewer > title, icons and buttons > Participate > Join action disabled > join run with public channel, join the channel` — Participate flow for public channel run when join action disabled still adds to LHS/channel.
  - `as viewer > title, icons and buttons > run actions > modal behaviour > modal can be opened read-only` — `[SKIPPED]` viewer opening read-only Run Actions modal (has no buttons).
  - `as viewer > context menu > shows on click` — (shared) dropdown opens for viewer.
  - `as viewer > context menu > can copy link` — (shared) copy link works for viewer.
  - `as viewer > context menu > can not rename run` — RDP dropdown has no "Rename" option for viewer.
  - `as viewer > context menu > can not finish run` — RDP dropdown has no "Finish" option for viewer.
- **Notes**: `commonHeaderTests`/`commonContextDropdownTests` helpers shared between participant/viewer describes, producing duplicate titled tests across both. One skipped test (`it.skip`). Comment flags a known front-end bug where Participate button assertion after leaving run doesn't reflect updated state yet.

### `runs/rdp_main_summary_spec.js`

> Scope: participant tests only

- **Area**: RDP main > summary section
- **Setup**: Public playbook, testUser (owner/participant) + testViewerUser (non-participant); macbook-13 viewport.
- **Tests**:
  - `as participant > is visible` — (shared) RDP summary section (`run-summary-section`) visible.
  - `as participant > has title` — (shared) summary section h3 title "Summary".
  - `as participant > has a placeholder` — participant sees placeholder "Add a run summary".
  - `as participant > can be edited` — hover reveals edit icon; editing + saving updates rendered text and shows "Last edited" timestamp.
  - `as participant > can be canceled` — editing then clicking Cancel discards changes, no "Last edited" shown.
  - `as participant > can not be edited once run is finished` — after finishing run via API, edit button is absent on hover.
  - `as viewer > is visible` — (shared) summary section visible to viewer.
  - `as viewer > has title` — (shared) title visible to viewer.
  - `as viewer > has a placeholder` — viewer sees placeholder "There's no summary".
  - `as viewer > can not be edited` — edit button absent for viewer on hover.
- **Notes**: `commonTests` helper shared across participant/viewer, producing duplicate-titled tests.

### `api/graphql_request_headers_spec.js`

> Scope: fold in as one `page.waitForRequest` assertion while loading the RDP (single content-type header) as long as the RDP still uses GraphQL

- **Area**: GraphQL API > request headers (regression test for duplicated Content-Type header, RDP = run details page)
- **Setup**: test user/team, one public playbook; viewport set to macbook-13; intercepts network request to GraphQL `/query` endpoint.
- **Tests**:
  - `api > graphql_request_headers > sends a single Content-Type header on the browser GraphQL /query request` — creating a run via API then visiting its RDP triggers a browser GraphQL request (Apollo) whose intercepted request has exactly one `content-type: application/json` header (regression for MM-69322 where Apollo + Client4 duplicated the header).
