# Task 15: Status update dialog from the channel (/playbook update)

**Task id**: `status-update-dialog` · **Kind**: playwright

## Target

- `tests/channels/status_update_dialog.spec.ts`

## What to do

Target ~7 tests.
- Description copy (broadcast count); whitespace-only blocked; non-playbook-member participant can post.
- Mark as finished: confirm modal, cancel keeps message + reminder, confirm posts update + finished system message. Checkbox visibility owner vs non-owner when owner-only actions is on: 2-row table.
- Unsaved changes: table `{cancel button, overview link} x {go back and save, discard}`. Discard via overview link lands on the RDP.
- Prefill: playbook template when no previous update; previous message otherwise.
- Reminder memory: default from playbook, then loop over `[15 minutes, 1 hour 30 minutes, 7 days]`.
- Status updates disabled on playbook: RHS has no post-update section.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/status_update_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/runs/owner_only_finish_spec.js` | "mark as finished" checkbox hidden for non-owner / shown for owner |

### `channels/rhs/status_update_spec.js`

> Scope: all tests

- **Area**: channel > status update dialog (`/playbook update` slash command) — content, validation, broadcast description, unsaved-changes protection, reminder-time memory, finish-run confirmation, disabled-status-updates gating
- **Setup**: team/user/channel; playbook with broadcast enabled to one channel, 1hr default reminder, custom reminder message template, retrospective disabled; run created fresh per test; viewport macbook-13.
- **Tests**:
  - `post update dialog > renders description correctly` — dialog description states update "will be broadcasted to one channel and one direct message".
  - `post update dialog > prevents posting an update message with only whitespace` — whitespace-only textarea content disables submit button; valid text re-enables and submits successfully.
  - `post update dialog > lets users with no access to the playbook post an update` — a user who is a run participant but not a playbook member can still open `/playbook update` dialog and post successfully.
  - `post update dialog > confirms finishing the run, and remembers changes and reminder when canceled` — checking 'mark run as finished' + submit shows 'Confirm finish run' modal; canceling that confirmation preserves typed update message and selected reminder time in the reopened dialog; confirming finish posts the update and a '... marked ... as finished' system message.
  - `post update dialog > prevents user from losing changes > cancel, go back and save` — canceling the update dialog with unsaved text shows unsaved-changes confirm modal; going back from that and submitting succeeds (dialog closes cleanly).
  - `post update dialog > prevents user from losing changes > click overview link, go back and save` — clicking 'run-overview-link' with unsaved changes triggers the same unsaved-changes confirm, and going back + submit succeeds.
  - `post update dialog > prevents user from losing changes > cancel and discard explicitly` — explicitly discarding from the unsaved-changes modal closes both modals without saving.
  - `post update dialog > prevents user from losing changes > click overview link and discard explicitly` — discarding explicitly after clicking overview link navigates to the RDP (`/playbooks/runs/{id}`) and opens the Run Actions modal there.
  - `post update dialog > shows the last update in update message > shows the default when we have not made an update before` — textbox defaults to the playbook's `reminderMessageTemplate` text when no prior update exists.
  - `post update dialog > shows the last update in update message > when we have made a previous update` — after posting one update, the dialog textbox pre-fills with that previous update's message text.
  - `the default reminder > shows the configured default when we have not made a previous update` — reminder selector defaults to the playbook's configured '1 hour'.
  - `the default reminder > shows the last reminder we typed in: 15 minutes` — after posting an update with a 15-minute reminder, reopening the dialog shows '15 minutes' pre-selected.
  - `the default reminder > shows the last reminder we typed in: 90 minutes` — same for 90 minutes, displayed as '1 hour, 30 minutes'.
  - `the default reminder > shows the last reminder we typed in: 7 days` — same for 7 days reminder.
  - `playbook with disabled status updates > omit status update dialog when status updates are disabled > shows the default when we have not made an update before` — for a playbook with `statusUpdateEnabled: false`, RHS shows `#rhs-about` section but omits `#rhs-post-update` section entirely.
- **Notes**: large single spec covering many distinct behaviors (content rendering, validation, permissions, unsaved-changes flows x4, reminder memory x4, disabled-updates gating) that could be split; uses `cy.wait(TIMEOUTS.TWO_SEC)` twice as an explicit animation-timing workaround.

### `runs/owner_only_finish_spec.js`

> Scope: "mark as finished" checkbox hidden for non-owner / shown for owner

- **Area**: run finish/restore permission enforcement when `owner_group_only_actions`/`ownerGroupOnlyActions` is enabled — RHS finish button, slash command, direct API, post-update modal checkbox, restart dropdown
- **Setup**: `apiInitSetup` team/owner; separate participant user; helper `setupOwnerOnlyPlaybookRun` creates playbook with `ownerGroupOnlyActions: true`, starts run with owner, adds participant; viewport macbook-13; thorough `afterEach` cleanup (finish + archive, using sysadmin since ownership may have changed).
- **Tests** (describe `without custom status field`):
  - `shows finish section in RHS to the run owner` — RHS channel view: `rhs-finish-section` visible to owner.
  - `hides finish section in RHS from non-owner participant` — RHS: finish section absent for non-owner participant (after owner-profile-selector visible, confirming RHS loaded).
  - `slash command /playbook finish returns permission error to non-owner participant` — channel slash command: `/playbook finish` as non-owner shows ephemeral error "You do not have permission to finish this run."; run remains active via API.
  - `direct REST PUT /runs/:id/finish returns 403 to non-owner participant` — API: direct PUT finish returns 403 for non-owner; run stays active.
  - `playbook admin can reassign ownership to themselves and finish the run end-to-end` — RHS: playbook admin (non-owner) cannot finish until they reassign ownership to themselves via RHS owner selector, then can finish; verifies full two-step workaround end-to-end via API.
  - `old owner cannot finish the run after ownership is reassigned to another user` — RHS: after reassigning owner via RHS, old owner loses finish section, new owner gains it.
  - `owner can finish the run end-to-end via RHS` — RHS: owner clicks Finish button, confirms modal (`playbooksConfirmFinishModal`), API confirms `current_status='Finished'`, `end_at>0`; associated channel not deleted.
  - `system admin can finish the run end-to-end even when not the owner` — RHS: sysadmin sees finish section (admin bypass) and can finish via UI, confirmed via API.
  - `playbook admin (non-owner) cannot see the finish section` — RHS: playbook admin role alone (without owner reassignment) does not grant finish visibility.
  - `creator who is not the owner cannot finish the run` — RHS: run creator (reporter) who isn't the owner cannot finish; the actual owner can.
  - `hides the "mark as finished" checkbox in the post update modal from a non-owner participant` — post-update modal (`/playbook update`): `mark-run-as-finished` checkbox absent for non-owner.
  - `shows the "mark as finished" checkbox in the post update modal to the run owner` — post-update modal: checkbox present for owner.
- **Tests** (describe `restore is owner-restricted`):
  - `owner can restore the run via API` — API: owner can `apiRestoreRun` a finished run back to `InProgress`.
  - `non-owner participant cannot restore the run` — API: non-owner restore attempt returns 403, run stays `Finished`.
  - `system admin can restore the run even when not the owner` — API: sysadmin can restore regardless of ownership.
  - `non-owner sees Restart as disabled with owner-only tooltip in the run dropdown` — RDP backstage: run header dropdown's "Restart" item is present but disabled for non-owner, with tooltip "Only the run owner can restart this run" (`cy.uiGetToolTip`).
- **Notes**: Very thorough permission-matrix spec combining RHS UI, slash command, direct API (bypassing UI), and post-update-modal checkbox visibility for the same `owner_group_only_actions` feature — complements `owner_group_only_actions_toggle_spec.js` (editor toggle) and `owner_reassignment_restriction_spec.js` (expected next file). No `cy.wait(ms)` usage; relies on custom commands for RHS/channel navigation and finish-modal confirmation.
