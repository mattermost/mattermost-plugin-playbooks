# Task 23: Playbook editor: retrospective toggle, timer/template, metrics

**Task id**: `editor-retrospective` · **Kind**: playwright

## Target

- `tests/playbooks/editor_retrospective.spec.ts`

## What to do

Target ~8 tests. Split the 4 Cypress mega-tests into focused ones:
- Add up to 4 metrics (Duration/Cost/Integer), formatted display, Add disabled at 4, persists.
- Validation table: title required, title unique, duration format, numeric target for currency/integer.
- Only one metric in edit mode; switching saves (and validates) the previous one.
- Delete: unsaved vs saved metric confirmation text; repeated add/delete stable.
- 0 and null targets.
- Retrospective toggle default on, disabling persists (API + reload); timer + template text displayed.

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
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit_metrics_spec.js` | all tests (split the mega-tests) |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/retrospective_toggle_spec.js` | editor tests (toggle shown, default on, clicking persists) |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/actions_spec.js` | "retrospective enable / disable" |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/overview_spec.js` | "shows correct retrospective timer and template text" |

### `playbooks/edit_metrics_spec.js`

> Scope: all tests (split the mega-tests)

- **Area**: playbook editor > outline > retrospective metrics (add/edit/delete, validation)
- **Setup**: one playbook per test; viewport macbook-16; intercepts `PUT .../playbooks/**` as `addMetric`; navigates to playbook outline tab, scrolls to `#retrospective`.
- **Tests**:
  - `playbooks > edit_metrics > actions > adding and editing metrics > can add 4, but not 5 metrics; can save and re-edit with metrics saved` — adds 4 metrics (Duration, Cost, Integer, Duration) with correct formatted display (e.g. duration → "1 minute per run"); "Add Metric" button disables at 4; values persist after `cy.reload()`; edits all 4 and re-verifies after reload; validates title-required and unique-title errors, duration format validation (letters, bad mm:ss, multi-digit ok); verifies only one metric is in edit mode at a time and switching edit saves the previous one.
  - `playbooks > edit_metrics > actions > adding and editing metrics (new playbook) > verifies when clicking "Add Metric", for Currency type, and switches to new edit` — clicking "Add Metric" while another metric is being added/edited auto-saves/validates current edit (title required, unique title, numeric target for Currency/Integer) before switching; verifies blank target/description allowed; checks edit-button triggers same validation and switch-save behavior.
  - `playbooks > edit_metrics > actions > delete metric > verifies when clicking delete button; saved metrics have different confirmation text; deleted metrics are deleted` — clicking delete-metric triggers same inline validation errors first if current edit invalid; confirms deleting unsaved metric shows plain confirm text, deleting a saved metric shows extra "historical data" warning text; deletion removes metric and state remains consistent across repeated add/delete cycles and page reloads.
  - `playbooks > edit_metrics > actions > nullable and 0-able targets > can add 0 targets and no (null) targets` — Duration/Cost/Integer metrics can have target `0` (displayed as "0 seconds per run" / "0") and also be cleared to null (hides target detail row); null persists correctly through edit-reopen and `cy.reload()`.
- **Notes**: Very long, detailed single-`it` tests covering many assertions each (not one-behavior-per-it); heavy use of `cy.getStyledComponent(...)` internal component selectors tied to styled-components class names — fragile to refactors.

### `playbooks/edit/retrospective_toggle_spec.js`

> Scope: editor tests (toggle shown, default on, clicking persists)

- **Area**: playbook editor > retrospective toggle + its effects on RDP sections and channel reminder/publish flow
- **Setup**: requires license (`cy.apiRequireLicense`); single team/user; playbooks created per test (archived in afterEach); viewport macbook-13; uses `cy.playbooksVisitEditor`, `cy.playbooksInterceptGraphQLMutation`, `cy.playbooksVisitRunChannel`, `cy.assertRunDetailsPageRenderComplete`.
- **Tests**:
  - `playbooks > edit > retrospective toggle > shows the retrospective toggle in the playbook editor` — editor outline shows `retrospective-toggle` with an input control.
  - `... > retrospective toggle is enabled by default for new playbooks` — toggle checked by default, persists after reload, API confirms `retrospective_enabled: true`.
  - `... > clicking the toggle in the editor disables retrospective and persists via API` — clicking unchecks toggle, GraphQL `UpdatePlaybook` mutation fires, API/reload confirm `false`.
  - `... > disabling retrospective hides the retrospective section in run details` — RDP for a run from a retro-disabled playbook shows checklist section but no `run-retrospective-section`.
  - `... > enabling retrospective shows the retrospective section in run details` — RDP shows `run-retrospective-section` when playbook has retro enabled.
  - `... > finishing a run with retrospective disabled posts no reminder to the channel` — API-finishing a retro-disabled run's channel shows the finish system post but no retrospective reminder bot message.
  - `... > finishing a run with retrospective enabled posts a reminder to the channel` — API-finishing a retro-enabled run posts a visible `retrospective-reminder` message in channel.
  - `... > re-enabling retrospective on a finished run posts an immediate reminder` — RDP run-header dropdown "enable-retrospective-menu-item" + confirm on a finished run (originally retro-disabled) immediately posts the reminder to the channel.
  - `... > "Yes, start retrospective" navigates to the retro section, and publish posts to channel` — clicking "Yes, start retrospective" button in the channel reminder navigates to RDP retrospective section; typing report text + auto-save + "Publish" + confirm posts "Retrospective for <run> has been published by..." message to the run channel.
- **Notes**: Comprehensive end-to-end coverage of retrospective flow spanning editor, RDP, and channel surfaces; no raw `cy.wait(ms)` — relies on intercept aliases and `cy.contains(...,{timeout})`.

### `playbooks/edit/actions_spec.js`

> Scope: "retrospective enable / disable"

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

### `playbooks/overview_spec.js`

> Scope: "shows correct retrospective timer and template text"

- **Area**: playbook editor > overview/outline page
- **Setup**: `apiInitSetup` team/user, second user, second team, extra follower user; public playbook with retrospective template/timer, two private playbooks (solo/shared members), two playbooks for team-switch run testing; viewport macbook-13.
- **Tests**:
  - `redirects to not found error if the playbook is unknown` — playbook editor: visiting non-existent playbook ID redirects to `/playbooks/error?type=playbooks`.
  - `redirect to not found if the url is incorrect` — playbook editor: visiting a path-traversal-like malformed playbook URL redirects to `/playbooks/error?type=default`.
  - `should switch to channels and prompt to run when clicking run > for testPlaybookOnTeamForSwitching from its own team` — LHS/backstage list: finding and clicking a playbook then "Run Playbook" opens run-creation dialog at config step, from the playbook's own team.
  - `... > for testPlaybookOnTeamForSwitching from another team` — same flow but navigated from a different team, verifying cross-team switch still opens run dialog.
  - `... > for testPlaybookOnOtherTeamForSwitching from its own team` — same flow for a playbook that lives on the other team, visited from its own team.
  - `... > for testPlaybookOnOtherTeamForSwitchingOnOtherTeam from another team` — same flow for other-team playbook accessed from the first team, verifying switch+run dialog.
  - `... > on direct navigation to a playbook` — playbook editor: direct URL visit + "Run Playbook" click opens run-creation dialog.
  - `should copy playbook link` — playbook editor header: hovering copy-link icon shows tooltip "Copy link to", clicking copies URL to clipboard and tooltip changes to "Copied!".
  - `should duplicate playbook` — playbook editor title menu: "Duplicate" creates "Copy of ..." playbook, duplicator is sole member and can run (not join).
  - `duplicating a playbook clears the run_number_prefix` — playbook editor title menu + API: duplicating a playbook with a `run_number_prefix` set results in duplicate having empty prefix.
  - `checklists > header > has title` — playbook editor Outline `#checklists` section: shows "Tasks" header.
  - `checklists > shows checklists` — playbook editor Outline: checklist title and step titles rendered under `#checklists`.
  - `shows correct retrospective timer and template text` — playbook editor Outline `#retrospective` section: shows "7 days" reminder interval and retro template text.
  - `shows statistics in usage tab` — playbook editor usage/overview tab: "Runs currently in progress", "Participants currently active", "Runs finished in the last 30 days" counts update after starting then finishing a run (via API) + page reload.
  - `start a run` — playbook editor: "Run Playbook" → enter run name → confirm creates run shown in LHS "Runs" section.
  - `archiving > shows intended UI and disallows further updates` — playbook editor: archived playbook shows archive badge, disabled "Run Playbook" button; API update attempt on archived playbook returns 400.
  - `start a run > start a run, create a new channel` — playbook editor + run dialog: default config (create private channel) honored; starting run creates new channel shown via `runinfo-channel-link`.
  - `start a run > start a run in existing channel` — playbook editor Outline actions (`#link-existing-channel`) + run dialog: enabling "link to existing channel" action and selecting "Town" channel makes run dialog default to linking existing channel; run creates no new channel, links to "Town".
- **Notes**: Uses `cy.wait`-style `cy.waitForGraphQLQueries()` custom command for debounced GraphQL save; heavy reliance on `cy.apiCreatePlaybook`/API setup, some tests span both API and UI assertions.
