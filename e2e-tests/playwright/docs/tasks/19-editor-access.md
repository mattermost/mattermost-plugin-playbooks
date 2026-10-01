# Task 19: Playbook editor: members, private conversion, admin-only edit, owner/group-only toggle

**Task id**: `editor-access` · **Kind**: playwright

## Target

- `tests/playbooks/editor_access.spec.ts`

## What to do

Target ~8 tests.
- Members modal add/remove updates list + count; convert to private shows lock icon.
- Flags `admin_only_edit` and `owner_group_only_actions`: one table for "visible to playbook admin, hidden for member, disabled when archived" and one for "enable persists (confirm where required) / disable persists".
- Admin-only locked: non-admin sees every edit control disabled (one test with `test.step`s), playbook admin and sysadmin keep edit access (2-row table).
- Duplicate: member gets 403 / admin succeeds; archive disabled for member; import of an admin_only_edit export succeeds for a non-admin.

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
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/access_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/admin_only_edit_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/owner_group_only_actions_toggle_spec.js` | UI tests only (persist enabled/disabled, hidden for non-admin, disabled when archived). Mid-run behavior is covered as a UI check in owner-only-actions; its API half is not ported (go-coverage-gaps audit) |

### `playbooks/access_spec.js`

> Scope: all tests

- **Area**: playbook editor > access/members modal + public/private conversion (RDP info refresh)
- **Setup**: 2 team members; public playbook created per-test; navigates to editor outline page.
- **Tests**:
  - `playbooks > edit > rdp information refresh > add / remove a member` — in playbook editor, opening "playbook-members" modal, adding a user via "add-people-input" shows them in members-list and bumps member count badge to "2"; removing via dropdown "Remove" restores list/badge to "1".
  - `playbooks > edit > rdp information refresh > change to private` — "Convert to private playbook" in members modal + confirm modal converts playbook to private, hides the convert option, and shows a lock icon in the playbook-editor-header.
- **Notes**: Top-level describe title is "playbooks > edit" despite filename being access_spec.js (likely copy-paste); uses `cy.wait(500)` after typing in add-people-input — flaky-timing pattern.

### `playbooks/edit/admin_only_edit_spec.js`

> Scope: all tests

- **Area**: playbook editor > Settings > "Admin only edit" permission lock (toggle visibility, field disabling, duplicate/archive/import gating)
- **Setup**: 1 team with admin owner (playbook admin role via memberIDs), 1 regular playbook member (role `playbook_member`), 1 system sysadmin (non-member); public playbook; `admin_only_edit` reset to false before each test via API; viewport macbook-13.
- **Tests**:
  - `playbooks > edit > admin only edit > shows the admin-only-edit toggle in the Settings section for playbook admins` — editor outline shows `admin-only-edit-toggle`, unchecked by default, for the playbook admin.
  - `... > does not show the admin-only-edit toggle for non-admin playbook members` — regular member's outline view hides the toggle entirely.
  - `... > playbook admin enables admin_only_edit via UI toggle and persists after reload` — clicking toggle saves via intercepted PUT, checkbox becomes checked, API confirms `admin_only_edit: true`, persists after reload.
  - `... > playbook admin disables admin_only_edit via UI toggle` — toggling off from an enabled state saves and persists `admin_only_edit: false` via API.
  - `... > UI: editor fields are disabled for non-admin member when admin_only_edit is enabled` — with flag on, non-admin member sees status-update/retrospective/new-channel-only/auto-archive toggles disabled, no add-checklist button, no hover edit-pencils, and "Rename" dot-menu item renders as non-clickable div.
  - `... > UI: playbook admin retains edit access when admin_only_edit is enabled` — playbook admin still has all toggles enabled, add-checklist button, and summary edit pencil despite the flag.
  - `... > UI: system admin always has edit access and sees the Settings section when admin_only_edit is enabled` — system admin (non-member) sees Settings/toggle and retains full edit access (status-update toggle enabled, add-checklist, summary edit pencil).
  - `... > non-admin member cannot duplicate an admin-locked playbook` — clicking "Duplicate" from backstage list dot menu for a locked playbook results in server 403 (intercepted), no success toast/copy shown.
  - `... > playbook admin can duplicate an admin-locked playbook` — admin duplicating the same locked playbook succeeds (201), success toast and "Copy of ..." entry appear.
  - `... > non-admin member cannot archive an admin-locked playbook via the dot menu` — "Archive" menu item is disabled (force-clicked to confirm no-op); confirm modal never appears.
  - `... > any user with create permission can import an admin_only_edit playbook` — importing a JSON export with `admin_only_edit: true` injected succeeds (201) and opens the editor; backend strips the flag for the importing non-admin user.
- **Notes**: Uses `cy.wait(300)` fixed wait to confirm a disabled-button click truly no-ops — timing-dependent pattern; extensive use of `cy.then()` chaining in `before()` for ordering, called out in comments.

### `playbooks/owner_group_only_actions_toggle_spec.js`

> Scope: UI tests only (persist enabled/disabled, hidden for non-admin, disabled when archived). Mid-run behavior is covered as a UI check in owner-only-actions; its API half is not ported (go-coverage-gaps audit)

- **Area**: playbook editor > outline "owner/group only actions" toggle + run finish permission enforcement
- **Setup**: `apiInitSetup` admin user/team; playbooks created per test with `makePublic: true`; viewport macbook-13; cleanup in `afterEach` finishes/deletes any mid-run playbook/run created.
- **Tests**:
  - `persists the enabled state after a page reload` — playbook editor Outline: toggling `owner-group-only-actions-toggle` on (via confirmation modal) persists via PUT API and remains checked after reload.
  - `persists the disabled state after a page reload` — playbook editor Outline: disabling the toggle (true→false, no confirmation needed) persists via PUT API and remains unchecked after reload.
  - `toggle is not visible to non-admin playbook members` — playbook editor Outline: toggle not rendered in DOM for a `playbook_member` (non-admin) user.
  - `toggle is disabled on an archived playbook` — playbook editor Outline: toggle input is disabled when playbook is archived.
  - `toggling the flag mid-run immediately restricts and re-enables finish access — no per-run grandfathering` — API (`/runs/{id}/finish`): enabling `owner_group_only_actions` on the playbook mid-run immediately blocks (403) a non-owner participant from finishing the run, disabling it immediately restores access (200); no per-run grandfathering of old flag state.
- **Notes**: Last test is API-only (no UI assertions) despite living in a UI-focused spec file; uses custom command `cy.playbooksToggleWithConfirmation`.
