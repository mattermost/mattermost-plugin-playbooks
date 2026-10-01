# Task 25: Owner/group-only actions: finish, restore, reassignment

**Task id**: `owner-only-actions` · **Kind**: playwright

## Target

- `tests/runs/owner_only_actions.spec.ts`

## What to do

Target ~8 tests. Likely license-gated: reuse the `ApiError` 501 skip pattern.
- Finish visibility role table `{owner ✔, participant ✘, playbook admin ✘, creator ✘, sysadmin ✔}`; end-to-end finish for owner and sysadmin.
- Old owner loses / new owner gains finish after reassignment; playbook admin reassigns to self then finishes.
- Reassignment table `{owner ✔, participant ✘ + toast, playbook admin ✔, flag off ✔}`.
- Slash command errors for `/playbook finish` and `/playbook owner` as non-owner (2-row table).
- Restart disabled with "Only the run owner can restart this run" tooltip.
- Flag toggled mid-run applies immediately (UI).

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
| `e2e-tests/cypress/tests/integration/playbooks/runs/owner_only_finish_spec.js` | UI tests (RHS finish visibility per role, slash command error, admin reassign-then-finish, restart disabled + tooltip). Direct API tests -> not ported (go-coverage-gaps audit); post-update checkbox -> status-update-dialog |
| `e2e-tests/cypress/tests/integration/playbooks/runs/owner_reassignment_restriction_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/owner_group_only_actions_toggle_spec.js` | "toggling the flag mid-run" as a UI check (finish section disappears/appears for participant), API half not ported (go-coverage-gaps audit) |

### `runs/owner_only_finish_spec.js`

> Scope: UI tests (RHS finish visibility per role, slash command error, admin reassign-then-finish, restart disabled + tooltip). Direct API tests -> not ported (go-coverage-gaps audit); post-update checkbox -> status-update-dialog

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

### `runs/owner_reassignment_restriction_spec.js`

> Scope: all tests

- **Area**: run ownership reassignment restriction when `owner_group_only_actions` is enabled — RHS owner selector, slash command, playbook-admin bypass
- **Setup**: `apiInitSetup` team/owner; separate participant and new-owner users; one shared playbook with `owner_group_only_actions: true`; fresh run started per test with participant/new-owner added; viewport macbook-13; `afterEach` finishes run via sysadmin, `after` archives playbook.
- **Tests**:
  - `owner can reassign ownership to another participant` — RHS channel view: owner uses `owner-profile-selector` to reassign to another participant; `owner-profile-selector` text and API `owner_user_id` both reflect new owner.
  - `non-owner participant cannot open the owner selector or change ownership when owner_group_only_actions is enabled` — RHS: clicking owner selector as non-owner shows permission toast "Only the run owner can reassign ownership of this run."; no dropdown options; selector still shows original owner; API confirms unchanged.
  - `slash command /playbook owner returns permission error to non-owner participant` — channel slash command: `/playbook owner @user` as non-owner shows ephemeral error "You do not have permission to change the owner of this run."; API confirms unchanged.
  - `playbook admin (non-owner) can reassign ownership when owner_group_only_actions is enabled` — RHS: playbook admin role (without being run owner) can successfully reassign ownership via selector; API confirms new owner.
  - `non-owner can reassign ownership when owner_group_only_actions is false` — RHS: on a separate playbook with the flag disabled, a plain non-owner participant can reassign ownership successfully.
- **Notes**: Companion spec to `owner_only_finish_spec.js` (same feature flag, different action — reassignment vs finish) and `owner_group_only_actions_toggle_spec.js` (editor toggle). Uses custom commands `cy.playbooksVisitRunChannel`, `cy.playbooksChangeRunOwnerViaRHS`, `cy.uiPostMessageQuickly`, `cy.verifyEphemeralMessage`.

### `playbooks/owner_group_only_actions_toggle_spec.js`

> Scope: "toggling the flag mid-run" as a UI check (finish section disappears/appears for participant), API half not ported (go-coverage-gaps audit)

- **Area**: playbook editor > outline "owner/group only actions" toggle + run finish permission enforcement
- **Setup**: `apiInitSetup` admin user/team; playbooks created per test with `makePublic: true`; viewport macbook-13; cleanup in `afterEach` finishes/deletes any mid-run playbook/run created.
- **Tests**:
  - `persists the enabled state after a page reload` — playbook editor Outline: toggling `owner-group-only-actions-toggle` on (via confirmation modal) persists via PUT API and remains checked after reload.
  - `persists the disabled state after a page reload` — playbook editor Outline: disabling the toggle (true→false, no confirmation needed) persists via PUT API and remains unchecked after reload.
  - `toggle is not visible to non-admin playbook members` — playbook editor Outline: toggle not rendered in DOM for a `playbook_member` (non-admin) user.
  - `toggle is disabled on an archived playbook` — playbook editor Outline: toggle input is disabled when playbook is archived.
  - `toggling the flag mid-run immediately restricts and re-enables finish access — no per-run grandfathering` — API (`/runs/{id}/finish`): enabling `owner_group_only_actions` on the playbook mid-run immediately blocks (403) a non-owner participant from finishing the run, disabling it immediately restores access (200); no per-run grandfathering of old flag state.
- **Notes**: Last test is API-only (no UI assertions) despite living in a UI-focused spec file; uses custom command `cy.playbooksToggleWithConfirmation`.
