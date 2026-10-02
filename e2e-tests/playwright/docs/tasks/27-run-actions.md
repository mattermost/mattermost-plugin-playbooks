# Task 27: Run Actions modal and status-update broadcast

**Task id**: `run-actions` · **Kind**: playwright

## Target

- `tests/runs/run_actions.spec.ts`

## What to do

Target ~7 tests.
- Modal open/cancel/save (from header button and context menu = 1 test); invalid webhook URL blocks save; inherits playbook settings; channel names shown after reload.
- Broadcast: ONE test with 2 public + 2 private channels replaces "public", "private", "4 channels"; announcement + update thread lands in each.
- Broadcast disabled with channels configured posts nothing.
- Root announcement deleted in broadcast channels, further updates still render.
- DM/GM runs: table `{DM, GM}` -> add/remove-from-channel toggles disabled with hint; broadcast + webhook toggles enabled and persist.

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
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_header_spec.js` | "run actions" + "trigger: when a status update is posted" + context menu "run actions > modal can be opened" |
| `e2e-tests/cypress/tests/integration/playbooks/channels/broadcast_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/run_actions_dmgm_spec.js` | all tests |

### `runs/rdp_main_header_spec.js`

> Scope: "run actions" + "trigger: when a status update is posted" + context menu "run actions > modal can be opened"

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

### `channels/broadcast_spec.js`

> Scope: all tests

- **Area**: channel post > status update broadcast to other channels (public/private), including root-post deletion
- **Setup**: team/user + custom admin; 2 public + 2 private channels; playbooks configured with `broadcastEnabled`/`broadcastChannelIds` targeting various channel combos; viewport macbook-13.
- **Tests**:
  - `to public channels` — starting a run from a playbook broadcasting to one public channel and posting a status update results in an announcement post + status update post (with tasks/participants info) appearing as a thread in that broadcast channel's RHS.
  - `does not broadcast when broadcast is disabled, even if broadcastChannelIds contain data` — playbook with `broadcastEnabled: false` but non-empty `broadcastChannelIds` does not post anything to the configured channel; last post there remains the channel-join system message.
  - `to private channels` — same broadcast verification as the public case but targeting a private channel.
  - `to 4 public and private channels` — playbook broadcasting to 4 channels (2 public, 2 private) posts the announcement+update thread to all 4 channels.
  - `to 2 channels, delete the root post, update again` — after broadcasting to 2 channels, admin deletes the announcement root post in each broadcast channel (via RHS post dot menu + delete confirmation modal), then two more status updates are posted; new updates and thread still display correctly as announcement/update pairs in both channels.
- **Notes**: uses `cy.updateStatus` helper (slash-command/dialog) which is also likely exercised in other run-related specs; `deleteLatestPostRoot` helper exercises RHS delete-post confirmation modal UI as a side activity within a broadcast test rather than a dedicated delete-post spec.

### `channels/rhs/run_actions_dmgm_spec.js`

> Scope: all tests

- **Area**: RDP (run details page, backstage) > Run Actions modal behavior for DM/GM-backed (channel-less/standalone) runs
- **Setup**: team/user; DM and GM runs created per test with empty teamId/playbookId (standalone checklist runs); intercepts GraphQL `UpdateRun` mutation; viewport macbook-13.
- **Tests**:
  - `"Add to channel" action toggle is disabled with hint in DM` — in Run Actions modal for a DM-backed run, 'action-add-to-channel' toggle is disabled with hint text 'Not available for direct and group message channels'.
  - `"Remove from channel" action toggle is disabled with hint in DM` — same disabled/hint behavior for 'action-remove-from-channel' in a DM run.
  - `broadcast action is enabled in DM and the setting persists after save` — broadcast-channels action toggle is enabled (not disabled) in a DM run; toggling on and saving sends `statusUpdateBroadcastChannelsEnabled: true` in the GraphQL UpdateRun mutation.
  - `outgoing webhook action is enabled in DM and the setting persists after save` — webhook action toggle is enabled in DM; entering a webhook URL and saving persists `status_update_broadcast_webhooks_enabled: true` and the URL via API.
  - `"Add to channel" action toggle is disabled with hint in GM` — same channel-membership disabling behavior as DM, but for a GM-backed run.
  - `"Remove from channel" action toggle is disabled with hint in GM` — same for remove-from-channel in GM.
- **Notes**: all tests access the Run Actions modal via the RDP/backstage header (`rhs-header-button-run-actions`), not the channel RHS directly, despite file being under `channels/rhs/`; explicit code comment notes DM status-update broadcast end-to-end flow is intentionally NOT covered here and belongs in a separate spec.
