# Task 06: Run creation entry points (list, editor, cross-team, RHS, slash command, post menu, keyword prompt)

**Task id**: `start-run-entry-points` · **Kind**: playwright

## Target

- `tests/runs/start_run_entry_points.spec.ts`

## What to do

Target ~8 tests.
- One **table of entry points** `{playbook list, playbook editor, editor of a playbook on another team, slash command (public + private channel), post menu (public + private)}` -> run modal/dialog opens -> run starts and is reachable. Cross-team: 2 rows (own team, other team), not 4.
- Legacy slash-command dialog validation: required fields, whitespace name rejected, metadata shown, cancel creates nothing (verify via API).
- Creator becomes channel admin of the created channel (channel settings editable).

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/run_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/channels/run_dialog_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/overview_spec.js` | "should switch to channels and prompt to run" (x5), "start a run", "start a run > create a new channel / in existing channel" |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_spec.js` | "from playbook list > defaults" |
| `e2e-tests/cypress/tests/integration/playbooks/channels/general_actions_spec.js` | only the end of "keyword trigger > prompt to run playbook" where "Yes, run playbook" opens the dialog (full channel-action coverage is channel-actions) |

### `channels/run_spec.js`

> Scope: all tests

- **Area**: channel > starting a playbook run from multiple entry points (slash command, post menu) in public/private channels; also channel-admin permission check after run start
- **Setup**: team/user, one playbook with user as member, one private channel; viewport macbook-13.
- **Tests**:
  - `via slash command > while viewing a public channel` — starting a run via slash command in a public channel succeeds and run shows as active (verified via `verifyPlaybookRunActive`).
  - `via slash command > while viewing a private channel` — same via slash command in a private channel.
  - `via post menu > while viewing a public channel` — starting a run via the post's context menu ("start playbook run") in a public channel succeeds.
  - `via post menu > while viewing a private channel` — same via post menu in a private channel.
  - `always as channel admin` — the user who starts a run becomes channel admin of the created run channel: Channel Settings modal is accessible and the channel header textbox is editable (not disabled).
- **Notes**: overlaps with `run_dialog_spec.js` (dialog field validation) and `rhs_spec.js` (RHS open-on-run-start assertions) — this spec focuses specifically on "where you can trigger a run from" (slash command vs post menu, public vs private) plus the admin-permission side effect.

### `channels/run_dialog_spec.js`

> Scope: all tests

- **Area**: channel > "Start run" interactive dialog (apps modal) validation triggered from slash command
- **Setup**: team/user, two public playbooks (second forces a playbook dropdown to appear); dialog opened fresh each test via `cy.openPlaybookRunDialogFromSlashCommand`.
- **Tests**:
  - `cannot create a playbook run without filling required fields` — submitting with empty playbook/run-name fields keeps modal open and shows 'This field is required.' errors on both `playbookID` and `playbookRunName`.
  - `rejects invalid channel names` — submitting with a whitespace-only run name (after selecting a playbook) keeps modal open and shows error text 'unable to create playbook run'.
  - `shows expected metadata` — dialog shows current user's full name as owner, and 'Playbook'/'Run name' field prompts.
  - `is canceled when cancel is clicked` — clicking cancel closes dialog and verifies (via API) no run with the typed name was created.
- **Notes**: dialog surface here is the legacy interactive-dialog/apps-modal (slash command flow), distinct from the newer RHS 'start run' flow tested in `rhs/start_run_rhs_spec.js`.

### `playbooks/overview_spec.js`

> Scope: "should switch to channels and prompt to run" (x5), "start a run", "start a run > create a new channel / in existing channel"

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

### `playbooks/start_run_spec.js`

> Scope: "from playbook list > defaults"

- **Area**: run-creation modal (start run dialog) — templates, channel modes, validation
- **Setup**: `apiInitSetup` team/user; public playbook created per test via API with `createPublicPlaybookRun: true`; helper `fillPBE` configures playbook's channel template/mode/summary/default-owner via API then reloads.
- **Tests**:
  - `from playbook list > defaults` — backstage list "Run" button opens run modal; filling run name and confirming lands on RDP with `?from=run_modal` and correct run name heading.
  - `from playbook editor > pbe configured as create new channel > defaults` — playbook editor + run modal: with channel template name/summary configured and default-owner toggle enabled, modal prefills run name/summary; starting run lands on RDP with templated name/summary shown.
  - `... > change title/summary` — run modal: user can override prefilled run name/summary before starting; RDP reflects overridden values.
  - `... > change to link to existing channel does not default to current channel` — run modal: switching radio to "link existing channel" leaves channel selector showing "Select a channel" (not auto-filled) when run modal opened from playbook editor without prior channel context.
  - `... > switching to link existing defaults to current channel when no channel is pre-configured` — run modal: navigating to playbook editor via client-side routing from Town Square (preserving Redux current channel) then switching to link-existing pre-selects "Town Square".
  - `... > change to link to existing channel` — run modal: switching to link-existing, confirm button disabled until channel selected; selecting "Town" enables start; after run creation, clicking `runinfo-channel-link` navigates to town-square channel.
  - `pbe configured as linked to existing channel > defaults` — playbook editor configured with `channelMode: link_to_existing_channel` + pre-linked channel: run modal shows empty run-name, prefilled summary, confirm disabled until name entered; after creation, channel link navigates to town-square.
  - `... > fill initially empty channel` — run modal: with link-existing mode but no pre-configured channel, user must fill both run name and channel selector before confirm enables; verifies resulting run links to town-square.
  - `... > change to create new channel` — run modal: switching from link-existing to create-new-channel radio creates a new channel named after the run (`test-run-name`), verified via channel link navigation.
  - `start run modal > invalid user input > modal resets form fields when cancelled and reopened` — run modal: filled-in name/summary discarded after Cancel + reopen (fields empty since no template configured).
  - `... > exactly max length run name is accepted` — run modal: run name at exactly `RUN_NAME_MAX_LENGTH` (64) chars shows no error and start button enabled.
  - `... > submit button is disabled when run name is empty` — run modal: confirm button disabled with empty run name.
  - `... > error is shown when maximum length of run name is exceeded` — run modal: run name exceeding max length shows `run-name-error` with max length message and disables confirm; removing last char clears error.
- **Notes**: `fillPBE` helper relies on API update + `cy.reload()` to avoid racing the editor's 500ms debounced autosave — a flaky-prevention workaround worth preserving in Playwright rewrite.

### `channels/general_actions_spec.js`

> Scope: only the end of "keyword trigger > prompt to run playbook" where "Yes, run playbook" opens the dialog (full channel-action coverage is channel-actions)

- **Area**: channel > Channel Actions modal (built-in Mattermost channel actions as they interact with Playbooks: keyword-triggered "prompt to run a playbook")
- **Setup**: sysadmin-promoted user + separate regular testUser, both with CRT preference off; one action-channel; dynamically created public playbooks per test.
- **Tests**:
  - `on join trigger > channel categorization can be enabled and works` — enabling "sidebar category" channel action with a custom category name causes a joining/reloading user to see the channel under that sidebar category (not a Playbooks-specific feature, baseline for next tests).
  - `on join trigger > welcome message can be enabled and is shown to a joining user` — enabling temporary welcome message channel action shows the ephemeral message to a joining/reloading user (not Playbooks-specific).
  - `keyword trigger > prompt to run playbook can be enabled and works` — setting a keyword trigger + "Prompt to run a playbook" action with a selected playbook causes a bot post prompting to run that playbook when the keyword is posted in channel; clicking 'Yes, run playbook' opens the start-run dialog and starting it shows the run name in the RHS.
  - `keyword trigger > deletes the post and ignores the thread when clicking on No, ignore thread` — clicking 'No, ignore thread' on the bot prompt post deletes that bot post, and replying to the original thread with the same trigger phrase does not re-trigger a new prompt.
  - `keyword trigger > MM-58432 - prevents users from deleting an arbitrary post by crafting a query` — calling the `signal/keywords/ignore-thread` API directly with an arbitrary (non-bot) post_id does not delete that post; same API call with the actual bot prompt post_id does delete it (regression/security test for an IDOR-style vulnerability).
  - `keyword trigger > disabled triggers do not run even with a keyword set` — configuring a keyword but leaving "Prompt to run a playbook" toggled off means posting the keyword produces no bot prompt.
  - `action settings are reset to the default when switching to a channel with no actions configured` — after enabling a channel-categorization action in one channel, switching to a different channel with no configured actions shows the Channel Actions modal with action disabled/default (not leaking state across channels).
- **Notes**: several tests (on join trigger suite) test core Mattermost channel actions unrelated to Playbooks-specific behavior except as setup for the playbook-trigger tests; uses `cy.wait(TIMEOUTS.*)` and a raw `cy.wait(5000)` (flaky-pattern, commented as workaround for MM-45969).
