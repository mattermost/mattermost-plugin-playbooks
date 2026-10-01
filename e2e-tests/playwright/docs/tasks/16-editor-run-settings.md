# Task 16: Playbook editor: channel mode, new_channel_only, auto-archive, invite, owner, category

**Task id**: `editor-run-settings` · **Kind**: playwright

## Target

- `tests/playbooks/editor_run_settings.spec.ts`

## What to do

Target ~12 tests. Biggest dedup win.
- Treat **channel mode / new_channel_only / auto_archive** as one state machine: (a) defaults, (b) switching to link-existing disables+unchecks auto-archive and persists `auto_archive_channel=false`, back to create-new re-enables, (c) enabling new_channel_only (confirm modal: title/message/button, cancel closes) disables link-existing; disabling needs no confirm, (d) auto-archive banner on/off persists. Verify persistence via reload + API.
- Invite members: default off, selector disabled while off, add/add-more/remove with "N SELECTED", list persists while toggle off; removing a pre-assigned invited user and disabling invitations both ask for confirmation and clear the checklist assignee (2-row table).
- Assign owner: default off, disabled selector, select + change.
- Sidebar category on join: default off, persists category while off, custom category name persists.
- Wait on the save response (`page.waitForResponse`) instead of fixed waits.

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
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/actions_spec.js` | create channel / link existing channel, invite members, assign owner, sidebar category. NOT broadcast/status toggle (editor-status-updates) or retrospective toggle (editor-retrospective). Note `commonActionTests()` runs twice: port it ONCE |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/new_channel_only_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_new_channel_only_spec.js` | "new_channel_only toggle in the playbook editor" describe |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/auto_archive_spec.js` | editor toggle tests (default off, banner, disabled with link-existing, live disable/uncheck, DB reset, re-enable on create-new) |

### `playbooks/edit/actions_spec.js`

> Scope: create channel / link existing channel, invite members, assign owner, sidebar category. NOT broadcast/status toggle (editor-status-updates) or retrospective toggle (editor-retrospective). Note `commonActionTests()` runs twice: port it ONCE

- **Area**: playbook editor > outline > Actions panel (run-start actions, update-posted broadcast, member-joins actions, status update/retrospective toggles)
- **Setup**: testUser + 2 extra users + custom sysadmin; multiple playbooks created per describe block; some scenarios need public/private channels, pre-assigned checklist item + invited user; relies on `cy.openSelector`, `cy.addInvitedUser`, `cy.selectOwner` custom commands; "assumes E20 license is uploaded" per file comment.
- **Tests** (via shared `commonActionTests()` run twice — "actions toggled" and inline in "actions" describes):
  - `playbooks > edit > ... > create channel setting > is enabled by default in a new playbook` — "Create a new channel" toggle (`#create-new-channel`) is checked by default on a new playbook.
  - `... > invite members setting > is disabled in a new playbook` — `#invite-users` toggle unchecked by default.
  - `... > invite members setting > can be enabled` — clicking toggle checks it.
  - `... > invite members setting > does not let add users when disabled` — invite-users selector has `invite-users-selector--is-disabled` class while toggle off.
  - `... > invite members setting > allows adding users when enabled` — enabling toggle + selecting user shows "1 SELECTED" badge and username in selected list.
  - `... > invite members setting > allows adding new users to an already populated list` — adding a second invited user updates badge to "2 SELECTED" and both usernames show.
  - `... > invite members setting > allows removing users` — removing one invited user via "Remove" option drops badge to "1 SELECTED" leaving the other user.
  - `... > invite members setting > persists the list of users even if the toggle is off` — disabling invite toggle keeps the selected-user list intact; re-enabling after reload still shows "2 SELECTED".
  - `... > invite members setting > allow removing pre-assigned users with confirmation > when removing an invited user` — removing a pre-invited user who is also pre-assigned to a checklist task triggers confirm modal ("stop inviting this user..."); confirming un-assigns them from the checklist task and clears invite selection.
  - `... > invite members setting > allow removing pre-assigned users with confirmation > when disabling invitations` — disabling the invite-users toggle entirely (with a pre-assigned invited user) triggers confirm modal ("disable invitations?"); confirming clears both the checklist assignee and invited-user list.
  - `... > assign owner setting > is disabled in a new playbook` — `#assign-owner` toggle off by default.
  - `... > assign owner setting > can be enabled` — toggling `#assign-owner` checks it.
  - `... > assign owner setting > does not allow adding an owner when disabled` — owner selector has `assign-owner-selector--is-disabled` class while off.
  - `... > assign owner setting > allows adding users when enabled` — enabling + selecting owner shows username in control.
  - `... > assign owner setting > allows changing the owner` — selecting a different owner updates the control to the new username.
  - `playbooks > edit > actions toggled > link to an existing channel setting > can be checked` — `#link-existing-channel` radio toggle enables its text input when checked.
  - `playbooks > edit > actions toggled > link to an existing channel setting > create channel choices are disabled when is checked` — selecting "link existing channel" disables the "create new channel" radio/buttons.
  - `playbooks > edit > actions > when an update is posted > broadcast channel setting > none configured in a new playbook` — `#status-updates` broadcast shows "no channels" by default.
  - `... > broadcast channel setting > can change channel and edit is saved immediately` — selecting "off-topic" channel persists across reload, shown as "1 channel".
  - `... > broadcast channel setting > persists selected channels when status update toggle is off` — selected broadcast channel remains configured even after disabling the status-updates toggle; disabled-state text shown; re-enabling toggle still shows "1 channel".
  - `... > broadcast channel setting > removes the channel and disables the setting if the channel no longer exists` — deleting the configured announcement channel resets broadcast setting to "no channels" on reload.
  - `... > broadcast channel setting > shows channel name when private broadcast channel configured and user is a member` — selecting a private channel as broadcast target shows "1 channel" then channel display name when reopened, persists across page reload.
  - `playbooks > edit > actions > when a new member joins the channel > add the channel to a sidebar category > is disabled in a new playbook` — "user-joins-channel-categorize" toggle off by default in the channel-actions modal.
  - `... > add the channel to a sidebar category > can be enabled` — clicking label enables toggle.
  - `... > add the channel to a sidebar category > prevents category selection when disabled` — category creatable selector not rendered while toggle off.
  - `... > add the channel to a sidebar category > persists the category even if the toggle is off` — selecting "Favorites" category, disabling toggle, saving, reload — category selection "Favorites" persists when toggle re-enabled.
  - `... > add the channel to a sidebar category > shows new category name when category was created` — typing a new custom category name, saving, reload — custom category name persists and displays.
  - `playbooks > edit > actions > status updates enable / disabled > is enabled in a new playbook` — `#status-updates` toggle checked by default.
  - `... > status updates enable / disabled > can be disabled` — disabling shows "status updates are not expected" text, persists after reload.
  - `playbooks > edit > actions > retrospective enable / disable > is enabled in a new playbook` — `#retrospective` checkbox checked by default.
  - `... > retrospective enable / disable > can be disabled` — disabling shows "a retrospective is not expected" text.
  - `... > retrospective enable / disable > saves on toggle` — disabling retrospective toggle persists (unchecked) after reload.
- **Notes**: Very large file (~1100 lines) combining many toggle features in one spec; reuses `commonActionTests()` helper across two different outer describes causing near-duplicate test titles; heavy use of `cy.wait(TIMEOUTS.ONE_SEC)` after selector interactions — flaky-timing pattern; comment notes "assumes that E20 license is uploaded".

### `playbooks/edit/new_channel_only_spec.js`

> Scope: all tests

- **Area**: playbook editor > outline > "Require new channel for all runs" (`new_channel_only`) toggle and its interaction with "Link to existing channel" option
- **Setup**: single team/user; fresh playbook per test (archived in afterEach); viewport macbook-13; uses `cy.visitPlaybookEditor`, `cy.playbooksInterceptPlaybookSave`, `cy.playbooksConfirmModal` helpers.
- **Tests**:
  - `playbooks > edit > new channel only > shows the Require new channel toggle in the playbook editor` — toggle exists, unchecked by default, API confirms `new_channel_only: false` default.
  - `... > disables the "Link to existing channel" radio and selector in the editor when new_channel_only is true` — with flag pre-set true via API, the "link existing channel" radio and its channel selector render disabled.
  - `... > re-enables "Link to existing channel" radio when new_channel_only is turned off` — toggling flag back to false via API re-enables the radio.
  - `... > disables "Link to existing channel" controls after toggling new-channel-only on in the editor` — clicking the toggle in UI (+ confirm modal) live-disables the link-existing-channel radio/selector; clicking again (no confirm needed) re-enables them.
  - `... > toggle persists new_channel_only=true after page reload` — enabling via UI + confirm modal saves (intercepted PUT) and persists `true` after reload, confirmed via API.
- **Notes**: None.

### `playbooks/start_run_new_channel_only_spec.js`

> Scope: "new_channel_only toggle in the playbook editor" describe

- **Area**: run-creation modal > "new channel only" enforcement + playbook editor toggle
- **Setup**: `apiInitSetup` team/user; playbooks created per-context with `new_channel_only` set via API; viewport macbook-13; archives created playbooks in `afterEach`.
- **Tests**:
  - `when new_channel_only is true > "Link to existing channel" radio is disabled` — run modal: radio `link-existing-channel-radio` is disabled when playbook has `new_channel_only=true`.
  - `... > "Create a run channel" radio is checked and enabled` — run modal: `create-channel-radio` checked and enabled under same restriction.
  - `... > enforcement hint message is visible below the disabled radio` — run modal: `new-channel-only-hint` shows text "This playbook requires a new channel for each run".
  - `... > channel selector is not rendered` — run modal: `link-existing-channel-selector` absent.
  - `... > run can be started (modal submits successfully with new channel mode)` — run modal + API: submitting run creates run with a new `channel_id`, verified channel exists via API.
  - `new_channel_only toggle in the playbook editor > persists the flag via the UI toggle` — playbook editor Outline: toggling `new-channel-only-toggle` (with confirmation) persists `new_channel_only=true` via API check.
  - `... > shows a confirmation dialog with the correct title, message and button when enabling` — playbook editor Outline: enabling toggle shows `#confirmModal` with title "Require new channel for all runs", explanatory text, and "Confirm" button; cancel closes modal.
  - `... > disables the flag without a confirmation dialog` — playbook editor Outline: disabling the toggle (already enabled via API) does not show confirmation modal and persists `new_channel_only=false`.
  - `when new_channel_only is false (regression) > "Link to existing channel" radio is enabled` — run modal: radio not disabled when flag is false.
  - `... > enforcement hint message is not shown` — run modal: `new-channel-only-hint` absent when flag is false.
- **Notes**: Uses custom commands `cy.playbooksOpenRunModal`, `cy.playbooksToggleWithConfirmation`, `cy.playbooksGetRunIdFromUrl`, `cy.visitPlaybookEditor`.

### `playbooks/edit/auto_archive_spec.js`

> Scope: editor toggle tests (default off, banner, disabled with link-existing, live disable/uncheck, DB reset, re-enable on create-new)

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
