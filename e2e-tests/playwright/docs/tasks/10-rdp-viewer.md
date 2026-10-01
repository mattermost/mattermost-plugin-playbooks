# Task 10: Run details page as a non-participant (read-only affordances)

**Task id**: `rdp-viewer` · **Kind**: playwright

## Target

- `tests/runs/rdp_viewer.spec.ts`

## What to do

Target 2-3 tests (principle P1). This replaces ~45 duplicated viewer tests.
- **Test 1: "a non-participant sees a read-only run details page"**: in one pass assert: header title/badge visible, context menu has no Rename/Finish, summary has no edit affordance and shows "There's no summary", checklist checkboxes readonly + no hover menu, retrospective text not editable + no Publish, metric inputs disabled, no Manage participants, status section shows title "Recent status update" / placeholder / due date, Participate button shown, Info/Timeline toggles still work. Use `test.step` per section so failures are readable.
- **Test 2**: viewer can still request a status update (confirm posts message; cancel doesn't) and sees the most recent update after a participant posts one.
- **Test 3**: private playbook hides the playbook entry; private channel shows "Private" + request-to-join flow.

## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Rules (non-negotiable)

- Follow `e2e-tests/playwright/AGENTS.md` (POM is mandatory: no `page.getBy*`/`page.locator` in specs; a11y-first locators; API seeding through `tests/helpers`; `@objective` JSDoc; `{tag: '@playbooks'}`; `#`/`*` comments; collision-free names; no fixed waits).
- Apply the consolidation principles P1-P7 from `docs/cypress_migration_plan.md`: modernize, don't copy-paste. Every behavior listed under "Cypress coverage" must be covered by some assertion, unless this doc says it moves elsewhere.
- Reuse and extend existing page objects/helpers before creating new ones. If a webapp component lacks an accessible name needed for a role locator, adding an a11y attribute in `webapp/` is allowed (hard rule 2, nothing else).
- Don't delete Cypress specs (that's the `retire-cypress` task).

## Definition of done

1. Target spec(s) exist and pass locally: `cd e2e-tests/playwright && npx playwright test <spec> --reporter=list` (server at `MM_SERVICESETTINGS_SITEURL`, default `http://localhost:8065`, plugin deployed with `make deploy` if you added webapp a11y attributes).
2. Run it a second time to check stability (`--repeat-each=2` is fine).
3. `e2e-tests/playwright/docs/quality.sh` prints `QUALITY: PASS` (log saved as `docs/tasks/reviews/<task-id>.attempt-<n>.quality.log`). If it redeployed the plugin, re-run step 1 afterwards.
4. At the top of the spec, a comment lists the Cypress spec(s) it replaces (and which parts).

## Cypress coverage (sources)

Scope column says which part of each source spec belongs to THIS task. The excerpt below is the full inventory of that spec; ignore the parts outside the scope.

| Cypress spec | Scope for this task |
|---|---|
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_header_spec.js` | viewer: title/badge/copy-link, cannot rename, cannot finish, participate button shown |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_summary_spec.js` | viewer tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_checklist_spec.js` | viewer tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_retrospective_spec.js` | viewer tests (retro + metrics) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_statusupdate_spec.js` | viewer tests (title, placeholder, due date, most recent update, request update) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_rhs_participants_spec.js` | viewer: no manage button |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_rhs_runinfo_spec.js` | viewer tests (playbook hidden when private, request to join private channel, metrics show "-") |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_rhs_spec.js` | viewer tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_rhs_statusupdates_spec.js` | viewer tests |

### `runs/rdp_main_header_spec.js`

> Scope: viewer: title/badge/copy-link, cannot rename, cannot finish, participate button shown

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

> Scope: viewer tests

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

### `runs/rdp_main_checklist_spec.js`

> Scope: viewer tests

- **Area**: RDP (run details page) > checklist section — participant vs viewer permission behavior
- **Setup**: `apiInitSetup` team/user; separate viewer user (team member, not playbook member/participant) added to team; public playbook with 2 checklists x 2 tasks each; fresh run started before each test; viewport macbook-13.
- **Tests** (shared `commonTests()` run under both `as participant` and `as viewer`):
  - `is visible` — RDP: `run-checklist-section` visible.
  - `has title` — RDP: checklist section has "Tasks" h3 title.
  - `can see the tasks` — RDP: 4 tasks shown (2 checklists x 2 items).
  - `as participant > click marks task as done` — RDP: participant can check a task checkbox, becomes checked.
  - `as participant > has hover menu` — RDP: hovering a task as participant shows dot-menu with "Skip task"/"Duplicate task" actions.
  - `as viewer > click does not work` — RDP: viewer's task checkbox has `readonly` attribute (cannot be toggled).
  - `as viewer > has not hover menu` — RDP: viewer hovering a task does not show the dot-menu "More" button.
- **Notes**: Spec comment explicitly states it only covers basic RDP checklist behavior for participant/viewer and defers full checklist behavior coverage to "Channel RHS Checklist" tests (likely overlapping/complementary spec not in this batch).

### `runs/rdp_main_retrospective_spec.js`

> Scope: viewer tests (retro + metrics)

- **Area**: RDP main > retrospective section (report text + metrics)
- **Setup**: Public playbook with `retrospectiveTemplate` text; separate public playbook (public channel) with 3 metrics (duration, currency, integer) each with target; testUser (owner/participant) + testViewerUser (non-participant); macbook-13 viewport.
- **Tests**:
  - `retrospective > as participant > is visible` — RDP retrospective section (`run-retrospective-section`) visible to participant.
  - `retrospective > as participant > has title` — section has "Retrospective" h3 title.
  - `retrospective > as participant > has template text` — retro report text pre-filled with playbook's retrospective template.
  - `retrospective > as participant > has no metrics` — no metric input containers when playbook has none.
  - `retrospective > as participant > publishing posts to run channel` — editing + publishing retro posts the published text as a custom post in the run channel.
  - `retrospective > as participant > can be published once` — after publishing, Publish button becomes disabled.
  - `retrospective > as viewer > is visible/has title/has template text/has no metrics` — same 4 commonTests repeated for non-participant viewer.
  - `retrospective > as viewer > text is not clickable` — viewer clicking retro text does not reveal an editable textarea.
  - `retrospective > as viewer > there is no publish button` — Publish button absent for viewer.
  - `metrics > as participant > inputs info(title, target, description) and order` — metric inputs render title/target/description/placeholder correctly and in defined order for duration/currency/integer metrics.
  - `metrics > as participant > inputs, null and zero values` — metric with null target shows empty value; metric with target 0 shows "0".
  - `metrics > as participant > auto save` — entering metric values and clicking outside auto-saves; reloading page shows persisted values.
  - `metrics > as participant > save empty and zero values` — entering "00:00:00"/7/0 then clearing first two persists empty + zero appropriately.
  - `metrics > as participant > only valid values are saved. check error messages` — invalid duration/number inputs show inline error text ("Please enter a duration...", "Please enter a number.") and are not persisted after reload; valid third value (125) is kept.
  - `metrics > as participant > publish retro` — publishing with invalid metric values blocks publish (no confirm modal); empty required metric values show "Please fill in the metric value." for 2 fields; once valid, publish confirm modal appears, confirming publishes retro and disables all metric inputs.
  - `metrics > as viewer > inputs info(title, target, description) and order` — (shared) same metric rendering check for viewer.
  - `metrics > as viewer > are not editable` — metric inputs disabled for non-participant viewer.
- **Notes**: Uses `cy.wait(2000)` fixed waits for auto-save in two tests (flaky pattern). `commonTests` helper reused across participant/viewer describes causing duplicated titles.

### `runs/rdp_main_statusupdate_spec.js`

> Scope: viewer tests (title, placeholder, due date, most recent update, request update)

- **Area**: RDP main > status update section (post update, request update, template token preview)
- **Setup**: Public playbook, testUser (owner/participant) + testViewerUser (non-participant); macbook-13 viewport. Second describe: fresh playbook per test with `run_number_prefix` and a `Zone` select property field, for status update message template token preview.
- **Tests**:
  - `as participant > is visible` — RDP status-update section visible.
  - `as participant > has no title` — section has no h3 title for participant.
  - `as participant > post update > button disappears if we finish the run` — finishing the run via finish-section button+confirm removes the post-update button.
  - `as participant > post update > button triggers post update modal` — clicking post-update opens status update dialog; posting message with reminder "15 minutes" updates due-date display and posts message to run channel.
  - `as participant > request an update > is disabled if the run is finished` — after finishing run, kebab "Request update..." option is force-clickable but disabled (no confirm modal opens).
  - `as participant > request an update > requests and confirm` — kebab menu "Request update..." + confirm posts "<user> requested a status update for <run>." to channel.
  - `as participant > request an update > requests and cancel` — kebab menu "Request update..." + cancel does not post the request message.
  - `as viewer > is visible` — status-update section visible to non-participant viewer.
  - `as viewer > has a title` — viewer sees h3 title "Recent status update".
  - `as viewer > has placeholder` — viewer sees placeholder "No updates have been posted yet".
  - `as viewer > has a due date` — viewer sees "Update due" / "in 24 hours".
  - `as viewer > shows the most recent update` — after participant posts an update (15 min reminder), viewer's due date and `status-update-card` reflect new update text.
  - `as viewer > requests an update and confirm` — viewer's "Request update..." + confirm posts request message to channel.
  - `as viewer > requests an update and cancel` — viewer's "Request update..." + cancel does not post message.
  - `status update > template token preview > shows "Resolves to:" line when message contains {SEQ}` — status update modal preview resolves `{SEQ}` token to run's sequential_id.
  - `status update > template token preview > shows "Resolves to:" line when message contains {OWNER}` — preview resolves `{OWNER}` token to owner display text.
  - `status update > template token preview > shows "Resolves to:" line for mixed system + unknown tokens — unknown token passed through` — preview resolves known `{SEQ}` but leaves unknown `{unknownfoo}` token literal.
  - `status update > template token preview > hides "Resolves to:" line when message has only unknown tokens` — no preview line shown when only unresolvable tokens present.
  - `status update > template token preview > hides "Resolves to:" line for plain text with no tokens` — no preview line for plain text.
  - `status update > template token preview > shows "Resolves to:" for property field token after value is set` — after setting a custom property field value via GraphQL mutation, message token `{Zone}` resolves to the field's value in preview.
- **Notes**: File has `/* eslint-disable no-only-tests/no-only-tests */` at top (odd, no `.only` present though). Property-field preview test uses direct GraphQL mutation via `cy.request` (API-level setup, not UI).

### `runs/rdp_rhs_participants_spec.js`

> Scope: viewer: no manage button

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

### `runs/rdp_rhs_runinfo_spec.js`

> Scope: viewer tests (playbook hidden when private, request to join private channel, metrics show "-")

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

### `runs/rdp_rhs_spec.js`

> Scope: viewer tests

- **Area**: RDP > RHS header toggle buttons (Info / Timeline)
- **Setup**: Public playbook, testUser (owner) + testViewerUser (non-participant); macbook-13 viewport.
- **Tests**:
  - `as participant > timeline button toggles timeline in the RHS` — RHS header "timeline" button switches RHS title Info→Timeline, clicking again closes the RHS.
  - `as participant > info button toggles info in the RHS` — RHS header "info" button closes RHS from Info state, clicking again reopens Info.
  - `as viewer > timeline button toggles timeline in the RHS` — (shared) same toggle behavior for non-participant viewer.
  - `as viewer > info button toggles info in the RHS` — (shared) same toggle behavior for viewer.
- **Notes**: `commonTests` shared between participant/viewer, duplicate titles. Fixed `cy.wait(500)` between clicks "so we don't double-click" (flaky-prone pattern/workaround comment).

### `runs/rdp_rhs_statusupdates_spec.js`

> Scope: viewer tests

- **Area**: RDP > RHS "Status updates" list view (opened via "View all updates" link)
- **Setup**: Public playbook, testUser (owner) + testViewerUser (non-participant); macbook-13 viewport.
- **Tests**:
  - `as participant > rhs can not be open when there is no updates` — "View all updates" link absent in status-update section when no updates posted yet.
  - `as participant > link opens the RHS when there are updates` — after posting 2 status updates via API, "View all updates" opens RHS with title "Status updates", subtitle = run name, and both messages listed in reverse-chronological order with author username.
  - `as viewer > rhs can not be open when there is no updates` — same absence check for non-participant viewer.
  - `as viewer > link opens the RHS when there are updates` — same RHS open/list-order/content check for viewer.
