# Cypress → Playwright migration plan

Input: `docs/cypress_inventory.md`, a per-test inventory of all 92 Cypress specs plus the dormant `channels/playbook_run_actions.js`
(~790 `it` blocks, ~29k lines) under `e2e-tests/cypress/tests/integration/playbooks/`.

Goal: keep the **behavioral coverage** of the Cypress suite and drop the
redundancy: about 40 Playwright specs and about 300 tests instead of 92 specs
and about 790 tests. Every new spec follows `e2e-tests/playwright/AGENTS.md`
(POM required, a11y-first locators, API seeding).

**Hard rules for the whole migration** (details in `MIGRATION_RUNBOOK.md`):
1. **No Go file may change.**
2. **The only allowed webapp changes are accessibility attributes** (`aria-*`, `role`, `alt`, label association, plus the i18n string an `aria-label` needs) that enable role/label locators. No `data-testid`, logic, styling or bug fixes.
3. **Product bugs aren't fixed here.** The test is kept as `test.fixme('<bug>')`.
4. **CI quality gates are part of done** (`docs/quality.sh` must print `QUALITY: PASS`).

Already ported: `creation_button_spec` → `playbooks/create_playbook.spec.ts`,
`edit/header_spec` → `playbooks/edit_header.spec.ts`, `navigation_spec` →
`smoke/navigation.spec.ts`.

---

## 1. Consolidation principles (where the reduction comes from)

These patterns account for most of the reduction. Apply them in every target
spec.

### P1. Collapse participant/viewer matrices into a few "affordance" tests
Many RDP specs (`rdp_main_summary`, `rdp_main_checklist`, `rdp_main_retrospective`,
`rdp_main_statusupdate`, `rdp_rhs`, `rdp_rhs_runinfo`, `rdp_rhs_statusupdates`,
`rdp_main_header`) run a shared `commonTests()` twice: once as participant,
once as viewer. That gives about 60 tests whose viewer half only checks
"X is visible / X is not editable".
→ Write **one `runs/rdp_viewer.spec.ts`** test: *"a non-participant sees a
read-only run details page"*. It asserts every section in one pass: summary
has no edit, checklist is readonly with no hover menu, retro text isn't
editable and has no Publish button, metrics are disabled, there's no Manage
participants button, the context menu has no Rename/Finish, the status
section shows its title, placeholder and due date, and Participate is shown.
Participant behavior is then tested once, in the feature spec that owns it.

### P2. Same component on RHS and RDP → test it deeply once, smoke-test the other surface
Checklist items, run attributes, owner selector, and the status update dialog
render the same components in the channel RHS and on the RDP. `run_attributes_spec`
runs every edit case on both surfaces. `checklist_spec` (RHS) and
`rdp_main_checklist_spec` (RDP) overlap the same way.
→ Pick one surface for the full matrix. Add **one smoke test** on the other
surface proving the component is wired there.

### P3. Parametrize near-identical tests with data tables
Playwright makes this cheap: `for (const c of cases) test(\`... ${c.name}\`, ...)`.
Candidates:
- `runs/permissions_spec`: 4 (playbook × channel visibility) × 8 roles, written as 4 copy-pasted blocks → one table.
- `channels/retrospective_spec`: 4/3/2/1/0 metrics → 2 cases (with metrics, no metrics).
- `rhs/dm_checklist` + `rhs/gm_checklist`: identical scenarios → one spec parametrized over `{DM, self-DM, GM}`.
- `rhs/run_actions_dmgm`: DM vs GM → one table.
- `slash_command/owner_spec`: every case run "with @" and "without @" → a table of `{input, expected}`.
- `rhs_spec` auto-open: 13 "opens / does not open via path X" tests → one table of `{entry path, run state, expectOpen}`.
- `rdp_main_header` Participate: {join action on/off} × {private/public channel} × {checkbox} → one table.
- `status_update_spec` reminder memory (15m / 90m / 7d) → one test looping over values, or a 2-case table.
- `overview_spec` "run from editor" cross-team: 4 variants → 2 (own team, other team).
- `playbook_attributes_spec` "create text/select/multiselect/URL" → one table.

### P4. Don't port pure API-contract tests; audit their Go coverage instead
About 60 Cypress tests never touch the UI. Playwright's job is user flows, so
these aren't ported. **Go files must not change during the migration** (hard rule 1).
The `go-coverage-gaps` task only *audits* them against the existing
`server/*_test.go`. Uncovered behavior is either picked up by a Playwright task
through the UI, or recorded as a follow-up outside the migration. In the
follow-up case, `retire-cypress` keeps that Cypress spec (see section 4):
- `api/runs_spec` (team_id validation, channel 403s, unfollow 403) → `api_runs_test.go`
- `api/property_fields_graphql_spec`, `api/graphql_errors_spec` → `api_graphql_property_test.go`; retire with the GraphQL→REST migration.
- `api/graphql_request_headers_spec` (single Content-Type on the browser's Apollo request, MM-69322) is the exception: it's browser-level, so Go can't cover it. Until GraphQL is gone, keep it as one `page.waitForRequest` assertion inside an RDP test (e.g. `rdp_header`) rather than as its own spec.
- `export_import_spec` "API export/import" block (round-trips, version 999, id set)
- `new_channel_enforcement_spec` "API contract" tests
- `sequential_id_spec` prefix freeze, same prefix across teams, 409 duplicate
- `role_based_assignment_spec` owner/creator resolution at creation
- `run_naming_spec` "defaults to unlocked via raw REST", "clearing both fields"
- `start_run_template_spec` "backend ignores client-supplied name when locked" (×2)
- `owner_only_finish_spec` restore via API (×3), direct PUT finish 403
- `owner_group_only_actions_toggle_spec` "mid-run toggle, no grandfathering"
- `general_actions_spec` MM-58432 ignore-thread IDOR
- `dm/gm_checklist_spec` "rejects run creation in DM/GM", "moving populates team_id"
- `slash_command/test_spec` argument-validation matrix (13 tests): audit only, no Go changes. Keep at most 1 E2E test.

Keep API calls in Playwright **only as seeding or as a final persistence check**
after a UI action. Never make them the subject of a test.

### P5. Split "mega-tests" and merge "micro-tests"
- Split: `edit_metrics_spec` (4 `it`s with dozens of assertions each),
  `rhs/checklist_spec` "rhs stuff" (16 unrelated behaviors in one describe),
  `edit/actions_spec` (1060 lines; its `commonActionTests()` runs the same 15
  tests twice under two describes, which is pure duplication).
- Merge: tests that only check "section is visible", "has title", or "has placeholder"
  → fold them into the first behavioral test of that section as preconditions.

### P6. Delete dead, stale and core-Mattermost tests
- **Dropped by decision**: `tours_spec_ignore_.js` (onboarding tours; the name doesn't match `specPattern`, so it never ran). Not ported, and removed in `retire-cypress`.
- **Dead code**: `channels/app_bar_spec` (`it` nested inside `it`, never runs),
  the commented-out slash-command block in `edit/checklists_spec`, and the stray `cy.wait;` in `lhs_spec`.
- **Skipped/stale (16 tests)**: all of `rhs/home_spec` (3) and `rhs/template_spec` (2),
  all of `digest_spec` (3), 5 of `rhs/start_run_rhs_spec`, plus single skips in `post_type_components`,
  `rhs/about`, and `rdp_main_header`. Don't port these. Re-spec them against the
  **current** UI (see §3, "Re-spec needed").
- **Core MM behavior**: the "channel categorization" and "welcome message" parts of
  `general_actions_spec` mostly test core channel behavior. Keep one combined "on join"
  test for the Playbooks-owned channel action, not two.

### P7. Replace the flaky patterns, don't port them
Cypress specs rely on `cy.wait(ms)` (≈25 files), `getStyledComponent` and
`.icon-*` CSS selectors, `{force: true}`, and recursive reload loops
(`deactivated_follower`). Replace them in Playwright with web-first `expect`,
`expect.poll` for server-side async state (archive, follower cleanup, reminder
posts), `page.waitForResponse` for autosave, and role-based locators. Where a
component has no accessible name (Task Inbox internals, task-actions modal), fix
the component instead of adding a testid.

---

## 2. Target spec layout

The table maps each target spec to its Cypress sources. "~N" is the estimated
Playwright test count after consolidation, with the source count in parentheses.

### `playbooks/` — playbook list, editor, and playbook-level config

| Target spec | Cypress sources | ~N | Notes |
|---|---|---|---|
| `create_playbook.spec.ts` ✅ | `creation_button` | 6 (6) | done |
| `editor_header.spec.ts` (rename the existing `edit_header`) | `edit/header`, `overview` (copy link, duplicate, duplicate clears prefix, archive UI, usage stats) | 7 (8) | Fold "duplicate clears run_number_prefix" into the duplicate test as an extra assertion. |
| `list.spec.ts` | `list`, `pagination` | 6 (8) | Join/leave, duplicate (+attributes/conditions independence), archived filter, search resets pagination. |
| `import_export.spec.ts` | `list` (import ×3), `export_import` (UI import ×4) | 4 (7) | One table for drag-drop vs file input; one fixture with attributes, conditions, and a colliding prefix covers everything. Invalid-file error. |
| `editor_access.spec.ts` | `access`, `edit/admin_only_edit`, `owner_group_only_actions_toggle` (UI parts) | 8 (17) | Members modal add/remove, convert to private, admin-only toggle (visibility + persistence), locked fields for non-admin (one test asserts all locked controls), duplicate/archive gating. One table for "toggle hidden for non-admin / disabled when archived" across both flags. |
| `editor_checklists.spec.ts` | `edit/checklists`, `overview` (checklist display), `rdp_main_checklist_multiselect` (misplaced: it's editor bulk edit), `role_based_assignment` (editor parts) | 9 (24) | Bulk edit: toggle, select/count, delete, due date, row-click selects (merge the 3 "shows button" tests). Pre-assignee → invite. "Run User" role option (editor + add-task form = 1 test). Sibling assignee_type regression. |
| `editor_run_settings.spec.ts` | `edit/actions` (channel mode, invite, owner, sidebar category), `edit/new_channel_only`, `start_run_new_channel_only` (editor toggle parts), `edit/auto_archive` (toggle UI parts) | 12 (~45) | The main dedup win. Channel mode create/link ↔ `new_channel_only` ↔ `auto_archive` all disable each other; test that interplay as **one state machine** (3–4 tests), not 15 separate checks. Invite: add/remove/persist-when-off + pre-assigned confirm (×2). Owner. Category. |
| `editor_status_updates.spec.ts` | `playbooks/status_update`, `edit/actions` (broadcast + status toggle) | 5 (9) | Default copy, disable, channels + webhooks persist while off, deleted channel resets, private channel name, strikethrough when broadcast is off. |
| `editor_retrospective.spec.ts` | `edit_metrics`, `edit/retrospective_toggle` (editor parts), `edit/actions` (retro toggle), `overview` (retro timer/template) | 8 (13 huge) | Split the mega-tests: add up to limit; validation (title required/unique, duration format, numeric targets); single-edit-at-a-time; delete confirm text (saved vs unsaved); 0/null targets; retro toggle default+persist; timer/template display. |
| `attributes.spec.ts` | `playbook_attributes` | 10 (20) | One table for create-by-type. Options CRUD (add/edit/delete/cannot delete last). Delete with confirm/cancel → empty state. Limit + delete-then-add. Duplicate (+options, independence). |
| `conditions.spec.ts` | `edit/condition_admin`, `edit/condition_user`, `rdp_main_finish` (conditional hidden tasks) | 9 (17) | Editor: create, edit expr, AND/OR, delete, assign/remove task. Run: one table for `is / is_not / AND / OR / text` visibility; warning indicator on modified task; channel message (1 vs 3 tasks as table); hidden tasks are not "outstanding" at finish. |
| `task_requirements.spec.ts` | `edit/task_requirements` | 3 (3) | Beta flag, set via config API in `beforeAll`. |

### `runs/` — run creation, RDP, run lifecycle

| Target spec | Cypress sources | ~N | Notes |
|---|---|---|---|
| `start_run_modal.spec.ts` | `start_run`, `start_run_template`, `start_run_new_channel_only` (modal), `new_channel_enforcement` (UI), `rhs/start_run_rhs` (non-skipped) | 16 (~45) | Prefill from templates; override; channel mode switching (default/current channel/pre-configured/must fill); validation (empty, max length, too-long resolved template, reset on cancel); locked template readonly + preview; unlocked template + freehand token; `new_channel_only` enforcement (radio disabled + hint + no selector = 1 test); many attributes keep Cancel reachable; DM/GM excluded from channel selector (table) + no DM refetch flood; "Create new playbook" link. |
| `start_run_entry_points.spec.ts` | `channels/run`, `channels/run_dialog`, `overview` (run from editor, cross-team), `start_run` ("from playbook list"), `general_actions` (keyword prompt → run) | 8 (17) | One table of entry points `{playbook list, editor, editor-other-team, RHS header dropdown, slash command, post menu}` → modal opens → run starts. Public/private channel only matters for the slash command. Legacy slash dialog validation (required fields, whitespace, cancel). Creator becomes channel admin. |
| `run_start_actions.spec.ts` | `channels/playbook_run_actions.js` (**dormant**: never ran, because the name doesn't match Cypress `specPattern`) | 5 (17) | What happens *when a run starts* with playbook actions configured via API: invited users added (table) + failure post for removed user; default owner resolution (5-row table); broadcast on start enabled/disabled + failure post for a deleted channel; creation webhook failure post (no httpbin dependency). Confirm behavior against the app first, since it was never verified in CI. The retro-disabled finish case is already in `retrospective`. |
| `run_naming.spec.ts` | `edit/run_naming` (UI), `owner_creator_template`, `sequential_id` (UI), `start_run_template` (resolution) | 12 (~45) | Editor: prefix/template fields, lock checkbox persists, `{` autocomplete, insert-variable button, unknown-field/`{SEQ}`-without-prefix warning, property field name valid, prefix-not-wiped regression, duplicate-prefix toast. Resolution: one table `{SEQ, OWNER, CREATOR, combined}` → RDP h1; name frozen after owner change. Sequential ID shown in runs list / RDP info / channel RHS → one test visiting all 3. |
| `rdp_header.spec.ts` | `rdp_main_header` (participant), `rdp_main_summary` (participant), `rdp_general` | 8 (~25) | Title + badge + copy link (icon and menu = 1 test), rename persists, favorite → LHS, summary edit/cancel/locked-when-finished, leave run. Not-found redirects → `navigation/not_found`. |
| `rdp_viewer.spec.ts` | viewer halves of all `rdp_*` specs | 2 (~45) | See P1. One "read-only everywhere" test, plus one for "private playbook hides playbook entry / private channel offers request-to-join". |
| `participants.spec.ts` | `rdp_main_header` (Participate ×6), `rdp_rhs_participants`, `assignee_auto_add_participant`, `deactivated_follower`, `rdp_rhs_runinfo` (following toggle), `lhs` (follow refresh) | 8 (~18) | Participate table (join action × channel type × checkbox). Manage mode: make owner, remove. Add participants (same join-action table, reuse the helper). Assigning a task to a non-participant adds them. Follow/unfollow (RDP + LHS refresh in one test). Deactivated follower removed (`expect.poll`). |
| `rdp_sidebar.spec.ts` | `rdp_rhs`, `rdp_rhs_runinfo` (overview, key metrics, recent activity), `rdp_rhs_statusupdates` | 8 (~35) | Info/Timeline toggles (1 test). Overview entries (playbook link, owner, participants list view, channel link survives finish, deleted channel, standalone hides playbook). Key metrics: one table `{no metrics, metrics+retro, metrics+retro off}` + RHS metric input formatting. Recent activity → Timeline. Status updates list. |
| `checklist.spec.ts` | `rhs/checklist`, `rdp_main_checklist` (participant), `rdp_checked_chip`, `task_progress` | 12 (~30) | Run the full matrix on the **RHS** (P2). Slash-command items (invalid/valid/persist/`/playbook check`); skip/restore + chips (checked/unchecked/skipped/restored/none = 1 table); add task (UI + `checkadd`); add/rename checklist; due dates (hover + edit mode); overdue filter (+auto-disappear); per-run isolation; long-list scroll regression. One RDP smoke (check task + hover menu). Progress indicator: one table `{0, 2 closed, 2 closed+1 skipped, mixed, all}` → list shows `N/4`. |
| `task_assignment.spec.ts` | `role_based_assignment` (UI parts) | 6 (14) | Owner-type follows owner change; creator-type doesn't; manual override sticks; role→user clears role (RHS + editor); property_user resolves and survives owner change; "Run User" in RHS editor. |
| `task_actions.spec.ts` | `edit/task_actions`, `rdp_main_taskactions` | 7 (23) | These two specs test the **same modal** with the same 11 cases. Config validation table (no keyword / user-only / unknown user → disabled or ignored) runs once. Trigger behavior: keyword, phrase, removed keyword stops triggering, user restriction, multiple users, multiple runs in one channel. |
| `finish_restore.spec.ts` | `rdp_main_finish`, `rdp_main_restore`, `rdp_main_header` (finish via menu), `edit/auto_archive` (run behavior) | 8 (~25) | Finish via section and menu (table) confirm/cancel; outstanding-task warning; restart. Auto-archive: archive on finish, unarchive on restore, linked channel never archived, disabled = untouched, timeline events, status post after restore, re-archive after manual unarchive (`expect.poll` on channel `delete_at`). |
| `owner_only_actions.spec.ts` | `owner_only_finish`, `owner_reassignment_restriction`, `owner_group_only_actions_toggle` (mid-run, UI side) | 8 (~22) | One role table for finish visibility `{owner ✔, participant ✘, playbook admin ✘, creator ✘, sysadmin ✔}`. Same idea for reassignment `{owner ✔, participant ✘ + toast, playbook admin ✔, flag off ✔}`. Slash-command errors for finish/owner (table). "Mark as finished" checkbox in the update modal. Restart disabled with tooltip. Admin reassigns to self then finishes. |
| `run_visibility.spec.ts` | `runs/permissions` | ~28 data rows, 1 test body (34) | Same coverage, but as **one data table** `{playbook vis, channel vis, role, inList, inRDP}` driving a single test body. Fix the "should be visible > to run followers" test, which asserts the opposite of its title. |
| `run_actions.spec.ts` | `rdp_main_header` (run actions modal + broadcast), `channels/broadcast`, `rhs/run_actions_dmgm` | 7 (~20) | Modal open/cancel/save, invalid webhook blocks save, inherits playbook settings. Broadcast: one test with 2 public + 2 private channels replaces "public", "private", and "4 channels". Disabled-but-configured doesn't broadcast. Root post deleted, then update again. DM/GM: add/remove toggles disabled with hint (table), broadcast + webhook enabled. |
| `retrospective.spec.ts` | `rdp_main_retrospective` (participant), `rdp_main_retrospective_toggle`, `channels/retrospective`, `edit/retrospective_toggle` (run parts) | 10 (~40) | Template text; publish posts to channel (table: with metrics / none), with the formatted `MetricInfo`; publish once. Metrics: render/order, null & 0, autosave, validation errors, publish blocked until valid. Toggle from RDP menu (owner ✔ / participant ✘ / sysadmin ✔ = table; RHS never shows it), label + section flip, cancel, timeline entries. Reminder post on finish (enabled vs disabled = table). Re-enable on finished run → immediate reminder. "Yes, start retrospective" → publish. |
| `status_updates.spec.ts` | `rdp_main_statusupdate` (participant), `status_update_template`, `rdp_main_statusupdate` (token preview) | 7 (~20) | Post update from RDP (reminder changes due date); post button gone after finish; request update confirm/cancel (+disabled when finished). Tokens: one table `{SEQ, OWNER, CREATOR, property, unknown, plain}` asserting **both** the modal preview and the posted message (merges the two specs). |
| `attributes.spec.ts` (run) | `run_attributes` | 7 (18) | Inheritance (all types); edit/clear per type (table) on the **RDP**; URL renders as link; one RHS smoke (P2); timeline entries (table: set/clear/update); independence from later playbook edits. |
| `runs_list.spec.ts` | `runs/list` | 4 (6) | Click-through to RDP; "my runs" filter (one test, both users); finished filter; LHS sorted by name. |

### `channels/` — channel RHS, posts, channel-level features

| Target spec | Cypress sources | ~N | Notes |
|---|---|---|---|
| `rhs_auto_open.spec.ts` | `channels/rhs`, `slash_command/info` | 3 (16) | One table of ~12 `{entry path, run state, RHS pre-state} → open?` rows. Icon toggles Home. `/playbook info`: error outside a run channel, opens when closed, ephemeral when already open (table). |
| `rhs_run_details.spec.ts` | `rhs/about`, `rhs/header`, `rhs/title` | 7 (19) | `about` and `header` are near-duplicates (both titled `channels > rhs > header`). Name ≠ channel display name; rename (RHS updates, channel header doesn't); summary edit persists / locked when finished; playbook badge (shown → navigates / hidden for no access / hidden for standalone = table); standalone rename/finish menu by state; follow/unfollow; title → RDP. |
| `rhs_run_list.spec.ts` | `rhs/list` | 6 (10) | Filter counts, show more, card info + click-through, dotmenu (overview/playbook/hidden-cases table/move channel), stays in list after move. |
| `rhs_home.spec.ts` | `rhs/home` (all skipped), `rhs/start_run_rhs` (empty state) | 3 (re-spec) | **Re-spec against the current Checklists UI**: empty state, create dropdown contents, no-permission state. |
| `dm_gm_checklists.spec.ts` | `rhs/dm_checklist`, `rhs/gm_checklist`, `rdp_dm_checklist`, `rdp_checked_chip` (DM fixture only) | 7 (25) | Parametrize over `{DM, self-DM, GM}`: create, add/check task, post update, assignee list = channel members, dropdown options. Move-channel modal offers DMs. One RDP test for DM runs: overview entries (+self-DM regression), channel link → DM, timeline, Save as playbook, hard refresh keeps team. |
| `status_update_dialog.spec.ts` | `rhs/status_update`, `owner_only_finish` (checkbox owner/non-owner → table) | 7 (17) | Description copy; whitespace blocked; non-playbook-member can post; finish confirm keeps edits when canceled. Unsaved-changes: table `{cancel, overview link} × {go back+save, discard}` (4 → 1 parametrized). Prefill: template vs last update. Reminder memory (default + a loop over 15m/90m/7d). Disabled updates hide the section. |
| `status_update_posts.spec.ts` | `post_type_components`, `update_post_dm`, `update_request_post` | 5 (9) | Custom post renders in channel + when permalinked; renders in the bot DM (markdown); reminder post has a Post-update button (participant) / text only (channel member) in channel + Threads (table); snooze deletes it. |
| `channel_actions.spec.ts` | `general_actions` | 5 (7) | On-join actions (category + welcome, 1 test); keyword prompt → run; ignore thread; disabled trigger; settings reset per channel. The IDOR API test isn't ported; it's audited in go-coverage-gaps (P4). |
| `channel_header.spec.ts` | `channel_header`, `app_bar` (dead) | 3 (6+2 dead) | App Bar on/off → icon/legacy header button (table) + tooltip; header description links to playbook + overview. Port the app_bar intent properly; its Cypress tests never ran. |

### `slash_commands/`

| Target spec | Cypress sources | ~N | Notes |
|---|---|---|---|
| `run_commands.spec.ts` | `slash_command/commands`, `slash_command/owner` | 8 (25) | Single run: check / checkadd / checkremove / timeline / finish / update (happy paths; could be 1–2 tests). Multi-run: one shared table for disambiguation errors across subcommands (missing args, bad run number, view-only "Become a participant") instead of repeating them per command. Owner: show / change / not in channel still works / already owner / unknown user / too many args; the `@`-prefix variants become a table. Remove the cross-suite import of `switchToChannel` from core Channels tests. |
| `todo_digest.spec.ts` | `slash_command/todo`, `digest` (skipped) | 3 (3+3 skipped) | Runs in progress / assigned tasks / overdue. Un-skip the digest deep-link checks as extra assertions (`?from=digest_*`). Replace the `cy.wait(1100)` with `expect.poll`. |
| *(audit)* | `slash_command/test` | 0–1 (13) | Argument validation isn't ported to E2E; audited in go-coverage-gaps (no Go changes). At most one E2E check: sysadmin + EnableTesting asks for confirmation. |

### `navigation/` and `admin/`

| Target spec | Cypress sources | ~N | Notes |
|---|---|---|---|
| `smoke/navigation.spec.ts` ✅ | `navigation` | 1 (2) | done |
| `navigation/lhs.spec.ts` | `lhs` | 5 (12) | Dot menu `{run, playbook}` × `{copy link, favorite/unfavorite}` as a table; leave run (owner must reassign first); leave run with no permanent access (on RDP → redirect / elsewhere → stay = table); leave playbook. |
| `navigation/not_found.spec.ts` | `overview` (×2), `rdp_general` (×2) | 1 (4) | Table `{unknown playbook, bad playbook url, unknown run, bad run url}` → error route. |
| `navigation/task_inbox.spec.ts` | `taskinbox` | 3 (5) | Icon toggles panel; filters (all-from-owned vs assigned); checking hides the task / "show checked" brings it back. Needs a11y names on the inbox internals (it currently relies on `getStyledComponent`). |
| `admin/site_statistics.spec.ts` | `adminconsole/analytics` | 1 (3) | One test: counters visible, then +1 playbook and +1 run. |

**Totals (approx.)**: ~41 specs, ~305 tests (+28 table rows in `run_visibility`), down from 92 active specs / ~790 tests plus 1 dormant file (17 tests). About 60 API-only tests aren't ported (audited for Go coverage, with no Go changes), and about 21 skipped or dead tests are dropped.

---

## 3. Findings to act on during the rewrite

**Cypress tests that are wrong (don't port them as-is):**
- `channels/app_bar_spec`: `it` nested inside `it`, so the assertions never run.
- `runs/permissions_spec` "should be visible > to run followers" (private playbook + private channel) asserts *not* visible. Port the real expectation under a correct name.
- `rhs/checklist_spec` "renames a checklist" expects `oldTitle + newTitle` (concatenated). Either the test or the product is wrong; check before porting.
- `rdp_main_header` "leave run": a comment says the Participate button doesn't update afterwards (known FE bug). Decide whether to `test.fixme` it.
- `lhs_spec`: the `cy.wait;` no-op (harmless; just don't port it).
- `api/property_fields_graphql_spec`: its assertions are conditional, so it can pass without validating anything.

**Misplaced specs (target location already corrected in §2):**
- `runs/rdp_main_checklist_multiselect_spec` tests **editor** bulk edit, not RDP.
- `channels/rhs/run_actions_dmgm_spec` tests the RDP Run Actions modal, not the channel RHS.
- `channels/retrospective_spec` is RDP retro publishing.
- `playbooks/access_spec` and `rhs/about_spec` have describe titles that don't match their files.

**Re-spec needed (coverage was lost when the UI changed, so there's nothing to port):**
- RHS Home / empty state / starter templates / no-permission (`rhs/home`, `rhs/template`).
- RHS start-run flows (5 skipped tests in `rhs/start_run_rhs`).
- Digest deep links (`digest_spec`, MM-63692).
- Permalinked status update for a non-member (`post_type_components`, MM-63645).
- Editing the summary via the dot menu (`rhs/about`, MM-63692).
- Read-only Run Actions modal for viewers (`rdp_main_header`).

---

## 4. Go coverage audit (no Go changes)

The `go-coverage-gaps` task produces `docs/tasks/go-coverage-gaps.result.md`.
It maps each API-only Cypress test to an existing Go test (COVERED / PARTIAL / GAP).
A quick grep suggests `server/api_*_test.go` already covers `NewChannelOnly`,
`OwnerGroupOnlyActions`, `AdminOnlyEdit`, `ReporterUserID`, `AssigneeType`,
run-number-prefix 409s, ignore-thread, and channel 403s. Likely gaps:
- Import rejects an unsupported `version` / a payload with an `id`; round-trip remaps condition IDs.
- `channel_name_template_locked`: defaults to false via raw REST; when locked, the server ignores a client-supplied name.
- Clearing `channel_name_template` and `run_number_prefix` in a single PATCH.
- Prefix normalization (`ABC-` → `ABC`).
- `/playbook test` argument validation (no `server/command/*_test.go` found).

Gaps aren't fixed in Go during the migration. They are either covered through
the UI by a Playwright task or listed as follow-ups, and the matching Cypress
spec stays until a human schedules the Go work.

---

## 5. Suggested migration order

Start with what unblocks the most page objects, then the highest-value flows.

1. **Foundations**: page objects for RDP (`RunDetailsPage`), channel RHS (`ChannelRhs`), start-run modal (`RunModal`), status update dialog. Add helpers (Playwright only, no Go/webapp changes): `createRun` returning the run, `updateStatus`, `finishRun`, `setConfig`/feature flag, `createChannel`, `createDM/GM`, `addParticipant`, `patchPlaybook`.
2. `start_run_modal`, `start_run_entry_points`, `run_start_actions`, `finish_restore`, `checklist`: core run lifecycle.
3. `rdp_header`, `rdp_viewer`, `participants`, `rdp_sidebar`, `status_updates`, `status_update_dialog`.
4. Editor: `editor_run_settings`, `editor_status_updates`, `editor_checklists`, `editor_access`, `attributes`, `conditions`.
5. Permissions: `owner_only_actions`, `run_visibility` (table-driven; needs a license, so reuse the `ApiError` 501 skip pattern).
6. Remaining channel and slash-command specs, navigation, admin.
7. After each target spec lands, delete its Cypress sources in the same PR so coverage never runs twice.
