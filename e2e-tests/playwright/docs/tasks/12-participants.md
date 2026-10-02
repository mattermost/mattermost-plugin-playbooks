# Task 12: Participants, participate/join flows, followers

**Task id**: `participants` · **Kind**: playwright

## Target

- `tests/runs/participants.spec.ts`

## What to do

Target ~8 tests.
- Participate: one table `{createChannelMemberOnNewParticipant on/off} x {private, public channel} x {also-add-to-channel checkbox}` with cancel covered once.
- Manage mode: toggle, make owner, remove participant.
- Add participants: reuse the same join-action table helper (enabled; disabled; disabled + checkbox).
- Assigning a task to a non-participant (as non-owner participant, MM-70073) adds them as participant.
- Follow/unfollow from RDP updates followers list and LHS in one test.
- Deactivated follower disappears after reload: `expect.poll` with reloads, not a recursive wait loop.

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
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_header_spec.js` | viewer > Participate (all join-action enabled/disabled variants) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_rhs_participants_spec.js` | participant tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/assignee_auto_add_participant_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/deactivated_follower_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_rhs_runinfo_spec.js` | Following button toggles (participant + viewer) |
| `e2e-tests/cypress/tests/integration/playbooks/lhs_spec.js` | "lhs refresh on follow/unfollow" |

### `runs/rdp_main_header_spec.js`

> Scope: viewer > Participate (all join-action enabled/disabled variants)

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

### `runs/rdp_rhs_participants_spec.js`

> Scope: participant tests

- **Area**: RDP > RHS/sidebar run info panel > participants list (manage, owner change, remove, add)
- **Setup**: Public playbook, testUser (owner), testUser2 (added to run as participant), testViewerUser (non-participant); macbook-13 viewport.
- **Tests**:
  - `as participant > switching between manage modes` — RDP run-info participants panel toggles between normal and "Manage" mode via Manage/Done buttons.
  - `as participant > change owner` — in manage mode, per-participant menu "Make run owner" updates `run-owner` display to new owner.
  - `as participant > remove participant` — in manage mode, "Remove from run" removes participant row from list.
  - `as participant > add participant > join action enabled` — Add button + participant picker modal adds multiple users; confirms modal message about being added to channel; new rows appear.
  - `as participant > add participant > join action disabled` — with `createChannelMemberOnNewParticipant:false`, Add modal shows different message ("Also add people to..."), added participant is NOT added to channel (verified: no @mention in channel's first post).
  - `as participant > add participant > join action disabled, checkbox selected` — same as above but checking "also-add-to-channel" checkbox DOES add the user to the channel (verified by first post content).
  - `as viewer > no manage button` — RDP run-info participants panel has no "Manage" button for non-participant viewer.
- **Notes**: Uses `cy.wait(2000)` fixed wait after changing owner (flaky-prone pattern).

### `runs/assignee_auto_add_participant_spec.js`

> Scope: all tests

- **Area**: run details page (RDP) > checklist task assignee selector (MM-70073 regression)
- **Setup**: `apiInitSetup` team/owner user; separate non-owner participant and separate non-participant target team member created; playbook with one checklist/task; run started by owner, participant added via API; viewport macbook-13.
- **Tests**:
  - `non-owner participant assigning a task to a non-participant adds them as a run participant` — RDP checklist: non-owner participant opens checklist item hover menu, assigns task via `assignee-profile-selector` to a team member who is not yet a run participant; verifies via API that `assignee_id` is set and verifies target user now appears in RDP `runinfo-participants` list.
- **Notes**: Single-test regression spec for a specific bug fix (MM-70073); calls out a testid collision risk (RHS Info panel Owner selector) requiring scoped queries.

### `runs/deactivated_follower_spec.js`

> Scope: all tests

- **Area**: run details page (RDP) > followers list, deactivated-user cleanup
- **Setup**: `apiInitSetup` team/user; separate follower user added to team; public playbook with `createPublicPlaybookRun: true`; viewport macbook-13.
- **Tests**:
  - `removes a deactivated user from a run follower list on refresh` — RDP `runinfo-following` section: a follower shown before deactivation; after admin deactivates the follower (API) and owner reloads RDP (retrying up to 10x with 1s wait since removal is async server-side), the deactivated user's `profile-option-<username>` entry disappears.
- **Notes**: Uses recursive `cy.wait(1000)` + `cy.reload()` polling loop (`refreshUntilFollowerRemoved`) — flaky-pattern-prone retry logic worth replacing with proper polling/assertion retry in Playwright.

### `runs/rdp_rhs_runinfo_spec.js`

> Scope: Following button toggles (participant + viewer)

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

### `lhs_spec.js`

> Scope: "lhs refresh on follow/unfollow"

- **Area**: LHS navigation and run/playbook dot-menu actions
- **Setup**: 2 team members (testUser owner, testViewerUser), public + private playbook; viewport macbook-13; runs created per-test via API.
- **Tests**:
  - `lhs > navigate > click run` — clicking a run entry in LHS "Runs" group navigates/selects it (basic click smoke test).
  - `lhs > run dot menu > shows on click` — clicking the run's LHS dot menu button opens the dropdown menu (RDP page loaded).
  - `lhs > run dot menu > can copy link` — "Copy link" dropdown item copies RDP run URL to clipboard (stubbed clipboard assertion).
  - `lhs > run dot menu > can favorite / unfavorite` — "Favorite" moves run into LHS "Favorite" group testId, "Unfavorite" removes it.
  - `lhs > run dot menu > lhs refresh on follow/unfollow` — on RDP as a non-owner viewer, clicking "Follow" in run header increases profile-option avatars from 1→2 and adds run to LHS; "Unfollow" via dot menu removes it from LHS "Runs" group.
  - `lhs > run dot menu > leave run` — owner cannot leave (confirm modal does not appear) until ownership reassigned to another participant via RDP owner selector; after reassignment, "Leave and unfollow" + confirm succeeds.
  - `lhs > leave run - no permanent access > leave run, when on rdp of the same run` — non-owner participant on RDP of a private-playbook run leaves via dot menu + confirm modal, gets redirected to `/playbooks/runs?sort=` list page.
  - `lhs > leave run - no permanent access > leave run, when not on rdp of the same run` — leaving the same run from LHS dot menu while on Playbooks list page (not RDP) keeps user on `/playbooks/playbooks` page after confirm.
  - `lhs > playbook dot menu > shows on click` — dot menu on a playbook LHS entry (backstage list) opens dropdown.
  - `lhs > playbook dot menu > can copy link` — "Copy link" copies playbook URL to clipboard.
  - `lhs > playbook dot menu > can favorite / unfavorite` — favorite/unfavorite toggles playbook between "Favorite" and "Playbooks" LHS groups.
  - `lhs > playbook dot menu > can leave` — "Leave" removes playbook entry from LHS "Playbooks" group.
- **Notes**: Has stray no-op `cy.wait;` (missing parens, does nothing) in `navigate` beforeEach — likely dead code / bug in the spec itself.
