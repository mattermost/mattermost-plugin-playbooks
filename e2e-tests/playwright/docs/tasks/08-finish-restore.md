# Task 08: Finish / restore runs and auto-archive behavior

**Task id**: `finish-restore` · **Kind**: playwright

## Target

- `tests/runs/finish_restore.spec.ts`

## What to do

Target ~8 tests.
- Finish via finish-section and via header menu as a 2-row table, each with confirm and cancel paths; outstanding-task warning shown when a visible task is incomplete.
- Restart from header menu returns badge to In Progress and run to LHS.
- Auto-archive: use `expect.poll` on the channel's `delete_at` via API instead of `cy.waitUntil`. Cover: archive on finish, unarchive on restore, linked pre-existing channel never archived, disabled setting leaves channel alone across finish+restore, `channel_archived`/`channel_unarchived` timeline events, status post "from Finished to In Progress", second finish re-archives after a manual unarchive.

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
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_finish_spec.js` | all except the "finish with conditional hidden tasks" describe (goes to conditions) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_restore_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_header_spec.js` | context menu > finish run (confirm/cancel) |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/auto_archive_spec.js` | run-behavior tests (archive on finish via RHS/RDP, unarchive on restore, linked channel never archived, disabled = untouched, timeline events, status post after restore, re-archive after manual unarchive). Editor toggle tests go to editor-run-settings |

### `runs/rdp_main_finish_spec.js`

> Scope: all except the "finish with conditional hidden tasks" describe (goes to conditions)

- **Area**: RDP main > finish run section
- **Setup**: Public playbook (no members), run created via API with owner=testUser; second user as non-participant viewer; macbook-13 viewport. Second describe block: playbook with conditional checklist items gated by a `Priority` select property field with a condition.
- **Tests**:
  - `runs > run details page > finish > is hidden as viewer` — RDP finish section (`run-finish-section`) does not exist for a user who is not a participant.
  - `runs > run details page > finish > is visible` — RDP finish section is visible to the run owner.
  - `runs > run details page > finish > has a placeholder visible` — RDP finish section shows placeholder text "Time to wrap up?".
  - `runs > run details page > finish > finish run > can be confirmed` — RDP: clicking finish opens confirm modal, confirming updates header badge from "In Progress" to "Finished", removes finish section, and removes run from LHS navigation.
  - `runs > run details page > finish > finish run > can be canceled` — RDP: clicking finish opens confirm modal, canceling keeps badge "In Progress" and finish section visible.
  - `runs > run details page > finish with conditional hidden tasks > does not count conditionally hidden tasks as outstanding when finishing` — RDP checklist: conditionally-hidden tasks (condition not met) are not counted as outstanding when finishing a run; confirm modal does not mention "outstanding task".
  - `runs > run details page > finish with conditional hidden tasks > still warns about outstanding tasks when a visible task is not complete` — RDP checklist: an incomplete visible (non-conditional) task still triggers "outstanding task" warning in finish confirm modal.
- **Notes**: Comment acknowledges modal title wording varies ("Confirm finish run" vs "Confirm finish").

### `runs/rdp_main_restore_spec.js`

> Scope: all tests

- **Area**: RDP main > restart (restore) a finished run
- **Setup**: Public playbook with 2 checklists (2 items each), run created via API with owner=testUser; macbook-13 viewport.
- **Tests**:
  - `runs > run details page > restart run > restart run > can be confirmed` — RDP: finish run (badge → "Finished"), then open run dropdown, click "Restart", confirm modal → badge returns to "In Progress" and run reappears in LHS (asserts PUT `.../finish` and `.../restore` API calls fire).
- **Notes**: Uses `cy.wait('@routeFinish')`/`cy.wait('@routeRestore')` intercepts rather than arbitrary timeouts (good pattern). Commented-out unused `taskIndex` var.

### `runs/rdp_main_header_spec.js`

> Scope: context menu > finish run (confirm/cancel)

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

### `playbooks/edit/auto_archive_spec.js`

> Scope: run-behavior tests (archive on finish via RHS/RDP, unarchive on restore, linked channel never archived, disabled = untouched, timeline events, status post after restore, re-archive after manual unarchive). Editor toggle tests go to editor-run-settings

- **Area**: playbook editor > outline > "Auto-archive channel on finish" toggle, interaction with channel_mode, and run finish/restore archive behavior (editor UI + RDP + API)
- **Setup**: single team/user; playbooks created per test (tracked in `createdPlaybookIds` and archived in `afterEach`); viewport macbook-13; uses `cy.playbooksVisitEditor`, `cy.playbooksVisitRunChannel`, `cy.playbooksConfirmFinishModal`, `cy.playbooksInterceptPlaybookSave`, and `cy.waitUntil` polling helpers.
- **Tests**:
  - `playbooks > edit > auto archive > shows the auto-archive toggle in the playbook editor and defaults to off` — toggle exists and unchecked on a new playbook (editor surface).
  - `... > shows confirmation banner when auto-archive is enabled, persists after reload, and clears when toggled off` — enabling shows a banner warning about auto-archiving; state persists after reload; disabling removes the banner.
  - `... > archives the run channel after finishing via the RHS Finish button` — enabling auto-archive then finishing a run via RHS "Finish" button + confirm archives the run channel (polled via API `delete_at`).
  - `... > disables the auto-archive toggle when channel_mode is link_existing_channel` — toggle is disabled with explanatory tooltip ("cannot be auto-archived") when playbook links to an existing channel.
  - `... > disables and unchecks the auto-archive toggle immediately when switching to link_existing_channel` — switching channel mode radio to "Link to an existing channel" live-disables and unchecks the toggle without reload.
  - `... > resets auto_archive_channel to false in the DB when switching to link_existing_channel` — switching mode auto-saves `auto_archive_channel: false` via API even if it was previously true.
  - `... > re-enables the auto-archive toggle when switching back to create_new_channel` — switching mode back from link-existing to create-new re-enables the toggle live.
  - `... > enables the auto-archive toggle when channel_mode is create_new_channel` — toggle not disabled when mode is explicitly create_new_channel.
  - `... > unarchives the run channel when the run is restored via API` — API finish archives channel; API restore unarchives it (polled).
  - `... > does not archive a linked (pre-existing) channel on finish even when auto_archive_channel is true` — a linked (pre-existing, e.g. town-square) channel is never archived on finish even with the setting enabled.
  - `... > does not unarchive the channel on restore when the run did not auto-archive it` — with auto-archive disabled, finish doesn't archive and restore doesn't unarchive (channel stays `delete_at: 0` throughout).
  - `... > does not archive the run channel when auto-archive is disabled (default)` — finishing via RHS Finish button with the setting off leaves channel unarchived.
  - `... > shows channel_archived timeline event on the run details page after finishing` — finishing via RDP Finish button flips badge to "Finished", archives channel, and shows a `channel_archived` timeline event entry on RDP.
  - `... > unarchives channel and shows channel_unarchived timeline event when restored via run details page UI` — restoring via RDP run-dropdown "restartRun" + confirm flips badge to "In Progress", unarchives channel, shows `channel_unarchived` timeline event.
  - `... > posts a status message in the unarchived channel after restore` — after API finish+restore, the run channel shows a status post containing "from Finished to In Progress".
  - `... > allows next finish to auto-archive channel after manual unarchive and run restore` — after finish archives channel, admin manually unarchives via core API, RDP restore clears the "already auto-archived" marker, and a second RDP finish re-archives the channel.
- **Notes**: Describe block omits `{testIsolation: true}` option (inconsistent with most other specs); heavy use of `cy.waitUntil(...)` polling against API state rather than UI assertions for several tests — more integration/API-flavored than pure UI; good practice overall (no raw `cy.wait(ms)` except none found here).
