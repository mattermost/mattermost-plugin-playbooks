# Task 28: Run retrospective (RDP), toggle, reminders, publishing

**Task id**: `retrospective` · **Kind**: playwright

## Target

- `tests/runs/retrospective.spec.ts`

## What to do

Target ~10 tests.
- Template text prefilled; publish posts to channel, table `{with metrics -> formatted MetricInfo values, no metrics}` (replaces 4/3/2/1/0); can publish once.
- Metrics: render title/target/description in order; null vs 0; autosave persists (wait on save response, no sleeps); invalid values show errors and aren't saved; publish blocked until valid.
- Toggle in RDP menu: role table `{owner ✔, non-owner participant ✘, sysadmin ✔}`; label + section flip immediately; cancel leaves state; timeline entries; RHS menu never shows it; publish after enabling updates UI without reload.
- Finish with retro enabled vs disabled -> reminder post or not (table). Re-enable on finished run posts reminder; "Yes, start retrospective" navigates and publish posts.

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
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_retrospective_spec.js` | participant tests (viewer -> rdp-viewer) |
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_retrospective_toggle_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/channels/retrospective_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/retrospective_toggle_spec.js` | run/channel tests (section shown/hidden, reminder on finish, re-enable on finished run, "Yes, start retrospective" -> publish) |
| `e2e-tests/cypress/tests/integration/playbooks/channels/playbook_run_actions.js` | only "when a playbook run is finished > retrospective is disabled" (finish posts "marked as finished" and no reminder): same as the retro-disabled row of the reminder table |

### `runs/rdp_main_retrospective_spec.js`

> Scope: participant tests (viewer -> rdp-viewer)

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

### `runs/rdp_main_retrospective_toggle_spec.js`

> Scope: all tests

- **Area**: RDP header context menu > enable/disable retrospective toggle
- **Setup**: Requires license. Multiple playbooks created per-test (random IDs), varying `retrospectiveEnabled`; testUser (owner), participantUser (non-owner participant), adminUser (sysadmin non-owner). Public playbook-run channels for permission tests. Playbooks archived in afterEach.
- **Tests**:
  - `context menu shows "Disable retrospective" when retrospective is enabled` — RDP header dropdown shows disable option (not enable) when retro enabled.
  - `context menu shows "Enable retrospective" when retrospective is disabled` — RDP header dropdown shows enable option (not disable) when retro disabled.
  - `disabling retrospective via context menu updates the label to "Enable retrospective" immediately` — disabling via dropdown+confirm modal flips label without reload; backend `retrospective_enabled` becomes false (API-verified).
  - `enabling retrospective via context menu updates the label to "Disable retrospective" immediately` — enabling via dropdown+confirm modal flips label; backend `retrospective_enabled` becomes true.
  - `disabling retrospective via context menu hides the retrospective section immediately` — toggling off hides `run-retrospective-section` without reload.
  - `enabling retrospective via context menu shows the retrospective section immediately` — toggling on shows `run-retrospective-section` without reload.
  - `toggle option is not shown to a non-owner participant` — RDP dropdown hides both enable/disable options for a non-owner participant.
  - `system admin who is not the run owner can toggle retrospective` — sysadmin (non-owner) can see and use the toggle option.
  - `toggle option is not shown in the RHS context menu` — RHS run dropdown (channel sidebar) never shows retro toggle options, even where RDP would.
  - `cancelling the disable modal leaves the label unchanged` — canceling confirm modal leaves label/backend state unchanged.
  - `disabling retrospective creates a timeline entry with the correct description` — RDP timeline shows `retrospective_disabled` entry with "Retrospective disabled by <user>" text.
  - `enabling retrospective creates a timeline entry with the correct description` — RDP timeline shows `retrospective_enabled` entry with "Retrospective enabled by <user>" text.
  - `publishing after enabling retrospective updates the UI immediately without page reload` — enabling retro then publishing updates UI (checkmark icon, disabled Publish button) without reload; backend `retrospective_published_at` set.
- **Notes**: Comment explains confirm modal uses CSS id selectors not data-testid. Good use of `cy.intercept`+`cy.wait('@alias')` instead of fixed waits.

### `channels/retrospective_spec.js`

> Scope: all tests

- **Area**: RDP (run details page) > retrospective tab > publish retrospective with key metrics
- **Setup**: team/user; playbook created per-test with 4 metrics (duration, currency, integer, duration-no-target) and `createPublicPlaybookRun: true`; run created per-test.
- **Tests**:
  - `runs with metrics > publish retrospective > retrospective with 4 key metrics` — RDP retrospective tab shows 4 metric input fields; entering duration/currency/integer/duration values and publishing (via confirm modal) posts a 'Retrospective ... published by' message to the run channel with `MetricInfo` entries showing formatted values (e.g. '11 hours, 10 minutes').
  - `runs with metrics > publish retrospective > retrospective with 3 key metrics` — after removing one metric via API, RDP shows 3 inputs; publish flow produces 3 correctly formatted `MetricInfo` values in channel post.
  - `runs with metrics > publish retrospective > retrospective with 2 key metrics` — same with 2 remaining metrics.
  - `runs with metrics > publish retrospective > retrospective with 1 key metrics` — same with 1 remaining metric, verifies '0 seconds' duration formatting for zero value.
  - `runs with metrics > publish retrospective > retrospective with no metrics` — with all metrics removed, RDP shows no metric input containers; publishing still posts the 'Retrospective ... published by' message with no `MetricInfo` elements.
- **Notes**: `publishRetro` helper exercises the publish confirmation modal (`#confirm-modal-light`) each time; tests are essentially parametrized variants of the same flow (4/3/2/1/0 metrics) — good consolidation candidate.

### `playbooks/edit/retrospective_toggle_spec.js`

> Scope: run/channel tests (section shown/hidden, reminder on finish, re-enable on finished run, "Yes, start retrospective" -> publish)

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

### `channels/playbook_run_actions.js`

> Scope: only "when a playbook run is finished > retrospective is disabled" (finish posts "marked as finished" and no reminder): same as the retro-disabled row of the reminder table

- **Area**: run start side effects of playbook actions (invite members, default owner, broadcast, creation webhook) + finish with retro disabled — observed in the run channel posts, RHS and broadcast channel
- **Setup**: team/user + custom sysadmin + 2 extra team users; a public channel; one playbook per test configured via API (`invitedUserIds`/`inviteUsersEnabled`, `defaultOwnerId`/`defaultOwnerEnabled`, `broadcastChannelIds`/`broadcastEnabled`, `webhookOnCreationURLs`/`webhookOnCreationEnabled`, `retrospectiveEnabled`), run started via API.
- **Tests**:
  - `when a playbook run starts > invite members setting > with no invited users and setting disabled` — run channel first post is only "You were added to the channel by @playbooks." (nobody else invited).
  - `... > invite members setting > with invited users and setting enabled` — first post lists both invited users ("2 others" expands to @user0, @user1) "added to the channel by @playbooks".
  - `... > invite members setting > with invited users and setting disabled` — invited users configured but toggle off: nobody invited.
  - `... > invite members setting > with non-existent users` — invited user removed from the team before the run starts: bot posts "Failed to invite the following users: @<user>".
  - `... > default owner setting > defaults to the creator when no owner is specified` — RHS Owner shows the creator (setting off, no owner).
  - `... > default owner setting > defaults to the creator when no owner is specified, even if the setting is enabled` — setting on but empty owner id → creator is owner.
  - `... > default owner setting > assigns the owner when they are part of the invited members list` — RHS Owner = configured default owner (also invited).
  - `... > default owner setting > assigns the owner even if they are not invited` — RHS Owner = configured default owner (not invited, invite off).
  - `... > default owner setting > assigns the owner when they and the creator are the same` — RHS Owner = creator = configured owner.
  - `... > broadcast channel setting > with channel configured and setting enabled` — broadcast channel's last post contains the run name and "@user ran the <playbook> playbook."
  - `... > broadcast channel setting > with channel configured and setting disabled` — broadcast channel gets no run announcement.
  - `... > broadcast channel setting > with non-existent channel` — broadcast channel deleted before run start: bot posts "Failed to broadcast run creation to the configured channel." in the run channel.
  - `... > creation webhook setting > with webhook correctly configured and setting enabled` — run channel has no "Playbook run creation announcement through the outgoing webhook failed" post (webhook to https://httpbin.org/post).
  - `when a playbook run is finished > retrospective is disabled` — finishing a run of a retro-disabled playbook posts "marked <playbook> as finished" and no retrospective-reminder.
- **Notes**: **Never executed**: the file name doesn't match Cypress `specPattern` (`tests/integration/**/*_spec.{js,ts}`), so this is dormant coverage, not current coverage. Still worth porting: it is the only place run-start side effects of playbook actions are asserted. The webhook test depends on external httpbin.org. The finish/retro-disabled case duplicates `edit/retrospective_toggle_spec` "finishing a run with retrospective disabled posts no reminder".
