#!/usr/bin/env python3
"""Generate docs/tasks/*.md (and todo.json if missing) for the Cypress -> Playwright migration.
Edit the task definitions below and re-run: python3 e2e-tests/playwright/docs/gen_tasks.py
Existing todo.json state is never overwritten."""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # e2e-tests/playwright
DOCS = os.path.join(ROOT, 'docs')
TASKS_DIR = os.path.join(DOCS, 'tasks')
CY_PREFIX = 'e2e-tests/cypress/tests/integration/playbooks/'

# ---- parse inventory into {relpath: section_text}
inv = open(os.path.join(DOCS, 'cypress_inventory.md')).read()
sections = {}
for m in re.finditer(r'^## (\S+)\n(.*?)(?=^## |\Z)', inv, re.S | re.M):
    sections[m.group(1)] = m.group(2).strip()

# Each task: id, name, target(s), sources [(path, scope)], guidance (markdown), kind
T = []


def task(id, name, targets, sources, guidance, kind='playwright', extra=''):
    T.append(dict(id=id, name=name, targets=targets, sources=sources, guidance=guidance, kind=kind, extra=extra))


ALL = 'all tests'

DONE_AT = '2026-10-01T00:00:00Z'
task('ported-create-playbook', 'Playbook creation (already ported)', ['tests/playbooks/create_playbook.spec.ts'],
     [('playbooks/creation_button_spec.js', ALL)], 'Already ported before task tracking started. Nothing to do.', kind='done')
task('ported-navigation', 'Backstage navigation smoke (already ported)', ['tests/smoke/navigation.spec.ts'],
     [('navigation_spec.js', ALL)], 'Already ported before task tracking started. Nothing to do.', kind='done')

task('foundations', 'Foundations: shared page objects and seeding helpers',
     ['tests/pages/run_details_page.ts', 'tests/pages/channel_rhs.ts', 'tests/pages/run_modal.ts',
      'tests/pages/status_update_dialog.ts', 'tests/helpers/*.ts', 'tests/smoke/run_details.spec.ts'],
     [],
     """Build the building blocks every later task needs, so later tasks don't each reinvent them.

**Helpers** (`tests/helpers/`, same style as existing: `requestedWith`, `readJsonOrThrow`, typed returns):
- `run.ts`: make `createRun` **return the run** (id, channel_id, name); add `finishRun`, `restoreRun`, `updateStatus(runId, message, reminderSeconds)`, `addParticipants(runId, userIds)`, `getRun(runId)`.
- `playbook.ts`: `patchPlaybook(id, partial)` / `updatePlaybook`, `archivePlaybook`, `getPlaybook`; `createPlaybook` options for `members`, `public`, checklists with items.
- `channel.ts` (new): `createChannel(teamId, {type: 'O'|'P'})`, `createDirectChannel(a, b)`, `createGroupChannel(ids)`, `getChannel`.
- `config.ts` (new): `patchConfig(partial)` (admin) for feature flags like App Bar / beta features / EnableTesting.
- `user.ts`/`team.ts`: anything missing to seed a viewer user that is a team member but not a participant.

**Page objects** (`tests/pages/`), a11y-first locators, `expect*` methods:
- `RunDetailsPage` (`/playbooks/runs/:id`): `goto(teamName, runId)`, header (title, status badge, context menu), sections (summary, status update, checklist, retrospective, finish), right sidebar (Info/Timeline).
- `ChannelRhs`: `gotoRunChannel(teamName, channelName)`, run title, checklist, run list, menu.
- `RunModal` (start-run modal): run name, summary, channel-mode radios, channel selector, submit/cancel.
- `StatusUpdateDialog`: message, reminder, "mark as finished", submit/cancel.
Only implement what you can exercise in the smoke spec; later tasks extend these classes.

**Smoke spec** `tests/smoke/run_details.spec.ts`: seed playbook + run via API, open the RDP and the run channel RHS, assert the run name is visible on both. This proves the helpers + POs work end-to-end.""",
     )

task('start-run-modal', 'Run creation modal (templates, channel modes, validation, new_channel_only)',
     ['tests/runs/start_run_modal.spec.ts'],
     [('playbooks/start_run_spec.js', 'all except "from playbook list > defaults" (goes to start-run-entry-points)'),
      ('playbooks/start_run_template_spec.js', 'UI tests only; the two "backend ignores client-supplied name" API tests go to Go (go-coverage-gaps)'),
      ('playbooks/start_run_new_channel_only_spec.js', 'the "when new_channel_only is true/false" run-modal tests (editor toggle tests belong to editor-run-settings)'),
      ('runs/new_channel_enforcement_spec.js', 'the 2 "UI run start" tests only; API contract tests are not ported (go-coverage-gaps audit)'),
      ('channels/rhs/start_run_rhs_spec.js', 'non-skipped tests: create-new-playbook from modal, DM/GM exclusion, no DM refetch flood')],
     """Target ~16 tests. Consolidate:
- Template prefill / override / channel-mode switching (default, current channel via client-side nav, pre-configured channel, must-fill) as focused tests.
- Validation in a table where natural: empty name disables submit, exactly-max accepted, over-max error + recovers, too-long *resolved* locked template errors, reset on cancel.
- Locked template → readonly + preview; unlocked → editable + preview; freehand `{OWNER}` resolves.
- `new_channel_only=true`: one test asserting link radio disabled + hint + no selector + create radio checked, then submit creates a new channel. `false` regression: one test.
- Many attribute inputs keep Cancel reachable.
- DM/GM excluded from the channel selector: table `{DM, GM}`. DM refetch flood: assert with `page.on('request')` counting, no fixed sleep (use a bounded `expect.poll`/short observation via `waitForResponse` if possible; document why).
- "Create new playbook" link opens the create playbook flow.""")

task('mattermost-core-pom', 'MattermostCore page object: everything that belongs to Mattermost, not the plugin',
     ['tests/pages/mattermost/*.ts', 'tests/pages/mattermost/index.ts (MattermostCore facade)', 'tests/smoke/mattermost_core.spec.ts'],
     [],
     """Create one page-object layer for **Mattermost core UI** (anything the Playbooks plugin doesn't render), so plugin page objects and specs never locate core UI themselves. This is a prerequisite for all later tasks.

**Shape**
- `tests/pages/mattermost/` holds one class per core area, plus a facade `MattermostCore` (`tests/pages/mattermost/index.ts`) that composes them: `const mm = new MattermostCore(page); await mm.channels.goto(team, 'town-square'); await mm.postList.expectLastPostContains('...')`. Keep the API small and typed; add only what is used now or clearly needed by the remaining tasks (listed below).
- Suggested areas, based on the Cypress usage counts:
  - **channels** (center channel): `goto(teamName, channelName)` that waits until the team/channel is ready (it replaces the "visit town-square + wait for sidebar link" code duplicated in 4 page objects), `gotoDirectMessage(teamName, username)`, post textbox, `postMessage(text)` (= `uiPostMessageQuickly`, 99 uses), `runSlashCommand(cmd)`, slash-command autocomplete suggestions.
  - **postList**: last/first/nth post (`getLastPostId` etc.), `expectEphemeral(text)` (= `verifyEphemeralMessage`, 52 uses), system messages, post by id, post dot menu (`clickPostDotMenu`: delete, permalink), and interactive post buttons/selects as seen by core (attachments).
  - **sidebar** (LHS): channel links, switch channel, categories, DM/GM entries, Threads entry.
  - **channelHeader / appBar**: app bar icons (incl. the plugin's icon, located by its accessible name), legacy channel-header plugin button, tooltips (`uiGetToolTip`).
  - **rhs (core)**: thread view (`postMessageReplyInRHS`), Saved messages, close RHS. Only the generic RHS container; the Playbooks RHS content stays in `ChannelRhs`.
  - **threads**: global Threads view (CRT) items.
  - **modals**: generic confirm modal and interactive dialog (apps/legacy dialog used by `/playbook run`): fields, errors, submit/cancel.
  - **systemConsole**: navigate to a page (Site Statistics for the analytics task).
- API-level core actions that aren't UI (config patch, post as another user) stay in `tests/helpers/` (e.g. `postMessageAs` in a `post.ts` helper); don't put API calls in page objects.

**Refactor**
- Move every core-UI locator currently in plugin page objects (`playbooks_page.ts`, `playbook_editor_page.ts`, `run_details_page.ts`, `channel_rhs.ts`, `run_modal.ts`, `status_update_dialog.ts`, and anything added by the tasks done before this one) into the new classes. Plugin page objects keep only plugin UI and use `MattermostCore` for the rest (constructor composition: `this.mm = new MattermostCore(page)`).
- Existing specs must keep passing unchanged in behavior. Re-run all specs touched by the refactor.

**Rules**
- a11y-first locators. Core Mattermost markup isn't ours: hard rule 2 (webapp a11y attributes only) applies to *this* repo's webapp only. If core UI has no accessible name, use the most stable core hook available (ids/testids Mattermost itself uses, such as `#post_textbox` or `postMessageText_<id>`), wrapped and documented inside the core page object, never in plugin page objects or specs.
- Document the layering in `e2e-tests/playwright/AGENTS.md` (new short section "Mattermost core vs plugin page objects"): core UI only through `tests/pages/mattermost/`; plugin page objects must not locate core UI.
- Use the agent-browser skill if needed to read the real core accessibility tree.

**Smoke spec** `tests/smoke/mattermost_core.spec.ts` (~3 tests) exercising each public method once: navigate to a channel and a DM, post a message and assert it's the last post, run a slash command that produces an ephemeral post (e.g. `/playbook info` outside a run channel), open a thread reply in the RHS, open the app bar Playbooks icon, open System Console > Site Statistics.""")

task('start-run-entry-points', 'Run creation entry points (list, editor, cross-team, RHS, slash command, post menu, keyword prompt)',
     ['tests/runs/start_run_entry_points.spec.ts'],
     [('channels/run_spec.js', ALL),
      ('channels/run_dialog_spec.js', ALL),
      ('playbooks/overview_spec.js', '"should switch to channels and prompt to run" (x5), "start a run", "start a run > create a new channel / in existing channel"'),
      ('playbooks/start_run_spec.js', '"from playbook list > defaults"'),
      ('channels/general_actions_spec.js', 'only the end of "keyword trigger > prompt to run playbook" where "Yes, run playbook" opens the dialog (full channel-action coverage is channel-actions)')],
     """Target ~8 tests.
- One **table of entry points** `{playbook list, playbook editor, editor of a playbook on another team, slash command (public + private channel), post menu (public + private)}` -> run modal/dialog opens -> run starts and is reachable. Cross-team: 2 rows (own team, other team), not 4.
- Legacy slash-command dialog validation: required fields, whitespace name rejected, metadata shown, cancel creates nothing (verify via API).
- Creator becomes channel admin of the created channel (channel settings editable).""")

task('run-start-actions', 'Run start side effects of playbook actions (invite, default owner, broadcast, webhook)',
     ['tests/runs/run_start_actions.spec.ts'],
     [('channels/playbook_run_actions.js', 'all tests except "when a playbook run is finished > retrospective is disabled" (already covered by the retrospective task)')],
     """Target ~5 tests. The Cypress file never ran (its name doesn't match `specPattern`), so first confirm each behavior against the running app. A confirmed product bug becomes `test.fixme` (hard rule 3).
Here, playbook config is seeded via API (the editor UI for these settings is covered by editor-run-settings); this task asserts what happens **when a run starts**.
- Invite members: table `{off + none, on + 2 invited, off + 2 invited}` -> run channel first post shows who was added. Invited user removed from the team -> bot posts "Failed to invite the following users".
- Default owner: table `{off/no owner -> creator, on/no owner -> creator, on/invited owner -> owner, on/uninvited owner -> owner, on/owner = creator -> creator}` -> RHS owner. One test body over the table.
- Broadcast on start: `{enabled -> announcement "ran the <playbook> playbook" in broadcast channel, disabled -> nothing}`; deleted broadcast channel -> "Failed to broadcast run creation" bot post.
- Creation webhook: don't depend on httpbin.org. Assert the failure post appears for an unreachable URL (e.g. `http://127.0.0.1:9/`). Only assert the success path (no failure post) if a reachable endpoint is available from the Mattermost server; otherwise document why it's omitted.""")

task('finish-restore', 'Finish / restore runs and auto-archive behavior',
     ['tests/runs/finish_restore.spec.ts'],
     [('runs/rdp_main_finish_spec.js', 'all except the "finish with conditional hidden tasks" describe (goes to conditions)'),
      ('runs/rdp_main_restore_spec.js', ALL),
      ('runs/rdp_main_header_spec.js', 'context menu > finish run (confirm/cancel)'),
      ('playbooks/edit/auto_archive_spec.js', 'run-behavior tests (archive on finish via RHS/RDP, unarchive on restore, linked channel never archived, disabled = untouched, timeline events, status post after restore, re-archive after manual unarchive). Editor toggle tests go to editor-run-settings')],
     """Target ~8 tests.
- Finish via finish-section and via header menu as a 2-row table, each with confirm and cancel paths; outstanding-task warning shown when a visible task is incomplete.
- Restart from header menu returns badge to In Progress and run to LHS.
- Auto-archive: use `expect.poll` on the channel's `delete_at` via API instead of `cy.waitUntil`. Cover: archive on finish, unarchive on restore, linked pre-existing channel never archived, disabled setting leaves channel alone across finish+restore, `channel_archived`/`channel_unarchived` timeline events, status post "from Finished to In Progress", second finish re-archives after a manual unarchive.""")

task('checklist', 'Run checklist (RHS full matrix + RDP smoke, chips, progress)',
     ['tests/runs/checklist.spec.ts'],
     [('channels/rhs/checklist_spec.js', ALL),
      ('runs/rdp_main_checklist_spec.js', 'participant tests only (viewer half goes to rdp-viewer)'),
      ('runs/rdp_checked_chip_spec.js', ALL),
      ('runs/task_progress_spec.js', ALL)],
     """Target ~12 tests. Run the full checklist matrix on the **channel RHS**; add **one RDP smoke** (check a task + hover menu shows Skip/Duplicate).
- Slash-command items: invalid shows ephemeral error, valid posts + becomes "Rerun", state persists after reload, `/playbook check` item checks a task.
- Skip/restore + checked-by chip: one table `{checked, unchecked, skipped, restored, untouched}` -> chip tooltip / no chip.
- Add task (UI and `/playbook checkadd`), add checklist, rename checklist (**verify real behavior first**: the Cypress test expects old+new title concatenated, which is likely a test bug).
- Due dates (hover menu + edit mode), overdue filter count + toggle + auto-disappears, per-run isolation, long-list date-picker scroll regression.
- Progress indicator in runs list: table `{0 done, 2 closed, 2 closed + 1 skipped, mixed closed/skipped, all}` -> `N/4`.
- No `cy.wait`-style sleeps for react-select: wait on the option/listbox role.""")

task('rdp-header', 'Run details page header + summary',
     ['tests/runs/rdp_header.spec.ts'],
     [('runs/rdp_main_header_spec.js', 'participant: title/badge/copy-link, context menu (show, copy link, rename), favorite, leave run. NOT run-actions/broadcast (run-actions), finish (finish-restore), participate (participants), viewer (rdp-viewer)'),
      ('runs/rdp_main_summary_spec.js', 'participant tests only'),
      ('api/graphql_request_headers_spec.js', 'fold in as one `page.waitForRequest` assertion while loading the RDP (single content-type header) as long as the RDP still uses GraphQL')],
     """Target ~8 tests.
- Title + In Progress badge + copy link (header icon and context menu item as one test; assert clipboard via `page.evaluate(navigator.clipboard.readText)` with granted permissions).
- Rename via context menu persists after reload.
- Favorite toggles the run in the LHS Favorites group.
- Summary: placeholder, edit + "Last edited", cancel discards, no edit once finished.
- Leave run: needs another participant + owner change first. The Cypress comment mentions a known FE bug with the Participate button afterwards; if it reproduces, use `test.fixme` with the reason.""")

task('rdp-viewer', 'Run details page as a non-participant (read-only affordances)',
     ['tests/runs/rdp_viewer.spec.ts'],
     [('runs/rdp_main_header_spec.js', 'viewer: title/badge/copy-link, cannot rename, cannot finish, participate button shown'),
      ('runs/rdp_main_summary_spec.js', 'viewer tests'),
      ('runs/rdp_main_checklist_spec.js', 'viewer tests'),
      ('runs/rdp_main_retrospective_spec.js', 'viewer tests (retro + metrics)'),
      ('runs/rdp_main_statusupdate_spec.js', 'viewer tests (title, placeholder, due date, most recent update, request update)'),
      ('runs/rdp_rhs_participants_spec.js', 'viewer: no manage button'),
      ('runs/rdp_rhs_runinfo_spec.js', 'viewer tests (playbook hidden when private, request to join private channel, metrics show "-")'),
      ('runs/rdp_rhs_spec.js', 'viewer tests'),
      ('runs/rdp_rhs_statusupdates_spec.js', 'viewer tests')],
     """Target 2-3 tests (principle P1). This replaces ~45 duplicated viewer tests.
- **Test 1: "a non-participant sees a read-only run details page"**: in one pass assert: header title/badge visible, context menu has no Rename/Finish, summary has no edit affordance and shows "There's no summary", checklist checkboxes readonly + no hover menu, retrospective text not editable + no Publish, metric inputs disabled, no Manage participants, status section shows title "Recent status update" / placeholder / due date, Participate button shown, Info/Timeline toggles still work. Use `test.step` per section so failures are readable.
- **Test 2**: viewer can still request a status update (confirm posts message; cancel doesn't) and sees the most recent update after a participant posts one.
- **Test 3**: private playbook hides the playbook entry; private channel shows "Private" + request-to-join flow.""")

task('participants', 'Participants, participate/join flows, followers',
     ['tests/runs/participants.spec.ts'],
     [('runs/rdp_main_header_spec.js', 'viewer > Participate (all join-action enabled/disabled variants)'),
      ('runs/rdp_rhs_participants_spec.js', 'participant tests'),
      ('runs/assignee_auto_add_participant_spec.js', ALL),
      ('runs/deactivated_follower_spec.js', ALL),
      ('runs/rdp_rhs_runinfo_spec.js', 'Following button toggles (participant + viewer)'),
      ('lhs_spec.js', '"lhs refresh on follow/unfollow"')],
     """Target ~8 tests.
- Participate: one table `{createChannelMemberOnNewParticipant on/off} x {private, public channel} x {also-add-to-channel checkbox}` with cancel covered once.
- Manage mode: toggle, make owner, remove participant.
- Add participants: reuse the same join-action table helper (enabled; disabled; disabled + checkbox).
- Assigning a task to a non-participant (as non-owner participant, MM-70073) adds them as participant.
- Follow/unfollow from RDP updates followers list and LHS in one test.
- Deactivated follower disappears after reload: `expect.poll` with reloads, not a recursive wait loop.""")

task('rdp-sidebar', 'Run details page right sidebar (Info, key metrics, timeline, status updates list)',
     ['tests/runs/rdp_sidebar.spec.ts'],
     [('runs/rdp_rhs_spec.js', 'participant tests'),
      ('runs/rdp_rhs_runinfo_spec.js', 'participant overview/key metrics/recent activity (Following toggle -> participants; viewer -> rdp-viewer)'),
      ('runs/rdp_rhs_statusupdates_spec.js', 'participant tests')],
     """Target ~8 tests.
- Info/Timeline header buttons toggle (one test; no sleep between clicks, wait on title change).
- Overview: playbook link, owner, participants -> list view -> back; channel link navigates and survives finish; deleted channel shows "Channel deleted"; standalone run hides playbook entry.
- Key metrics: table `{no metrics, metrics + retro on, metrics + retro off}` -> section shown/hidden; when shown: View Retrospective link, metric anchors, "Add value..." placeholder, typing values renders formatted results.
- Recent activity contains timeline; View all -> Timeline view.
- Status updates list: hidden with no updates; with 2 updates shows both newest first with author.""")

task('run-status-updates', 'Status updates from the run details page + token resolution',
     ['tests/runs/status_updates.spec.ts'],
     [('runs/rdp_main_statusupdate_spec.js', 'participant tests + "template token preview" describe'),
      ('runs/status_update_template_spec.js', ALL)],
     """Target ~7 tests.
- Post update from RDP (reminder changes due date, message lands in channel); post button gone once finished.
- Request update: confirm posts message, cancel doesn't, disabled once finished.
- Tokens: **one table** `{ {SEQ}, {OWNER}, {CREATOR}, {Zone} property, unknown token, plain text, mixed known+unknown }`. For each row assert BOTH the modal "Resolves to:" preview (or its absence) AND the posted message content. This merges the preview spec and the posted-message spec.""")

task('status-update-dialog', 'Status update dialog from the channel (/playbook update)',
     ['tests/channels/status_update_dialog.spec.ts'],
     [('channels/rhs/status_update_spec.js', ALL),
      ('runs/owner_only_finish_spec.js', '"mark as finished" checkbox hidden for non-owner / shown for owner')],
     """Target ~7 tests.
- Description copy (broadcast count); whitespace-only blocked; non-playbook-member participant can post.
- Mark as finished: confirm modal, cancel keeps message + reminder, confirm posts update + finished system message. Checkbox visibility owner vs non-owner when owner-only actions is on: 2-row table.
- Unsaved changes: table `{cancel button, overview link} x {go back and save, discard}`. Discard via overview link lands on the RDP.
- Prefill: playbook template when no previous update; previous message otherwise.
- Reminder memory: default from playbook, then loop over `[15 minutes, 1 hour 30 minutes, 7 days]`.
- Status updates disabled on playbook: RHS has no post-update section.""")

task('editor-run-settings', 'Playbook editor: channel mode, new_channel_only, auto-archive, invite, owner, category',
     ['tests/playbooks/editor_run_settings.spec.ts'],
     [('playbooks/edit/actions_spec.js', 'create channel / link existing channel, invite members, assign owner, sidebar category. NOT broadcast/status toggle (editor-status-updates) or retrospective toggle (editor-retrospective). Note `commonActionTests()` runs twice: port it ONCE'),
      ('playbooks/edit/new_channel_only_spec.js', ALL),
      ('playbooks/start_run_new_channel_only_spec.js', '"new_channel_only toggle in the playbook editor" describe'),
      ('playbooks/edit/auto_archive_spec.js', 'editor toggle tests (default off, banner, disabled with link-existing, live disable/uncheck, DB reset, re-enable on create-new)'),
      ],
     """Target ~12 tests. Biggest dedup win.
- Treat **channel mode / new_channel_only / auto_archive** as one state machine: (a) defaults, (b) switching to link-existing disables+unchecks auto-archive and persists `auto_archive_channel=false`, back to create-new re-enables, (c) enabling new_channel_only (confirm modal: title/message/button, cancel closes) disables link-existing; disabling needs no confirm, (d) auto-archive banner on/off persists. Verify persistence via reload + API.
- Invite members: default off, selector disabled while off, add/add-more/remove with "N SELECTED", list persists while toggle off; removing a pre-assigned invited user and disabling invitations both ask for confirmation and clear the checklist assignee (2-row table).
- Assign owner: default off, disabled selector, select + change.
- Sidebar category on join: default off, persists category while off, custom category name persists.
- Wait on the save response (`page.waitForResponse`) instead of fixed waits.""")

task('editor-status-updates', 'Playbook editor: status updates, broadcast channels, webhooks',
     ['tests/playbooks/editor_status_updates.spec.ts'],
     [('playbooks/status_update_spec.js', ALL),
      ('playbooks/edit/actions_spec.js', '"when an update is posted > broadcast channel setting" and "status updates enable / disabled"')],
     """Target ~5 tests.
- Default copy ("every 1 day / no channels / no outgoing webhooks") + disable shows "not expected" and persists.
- Channel + webhook configured, persist across reload, preserved while updates are off.
- Pre-configured channels/webhooks with broadcast disabled show strikethrough; adding more updates counts.
- Deleted broadcast channel resets to "no channels"; private channel shows its display name.""")

task('editor-checklists', 'Playbook editor: checklists, bulk edit, pre-assignee, role options',
     ['tests/playbooks/editor_checklists.spec.ts'],
     [('playbooks/edit/checklists_spec.js', 'pre-assignee test (ignore the commented-out slash command block)'),
      ('playbooks/overview_spec.js', '"checklists > header > has title", "checklists > shows checklists"'),
      ('runs/rdp_main_checklist_multiselect_spec.js', ALL + ' (misplaced: it is editor bulk edit)'),
      ('runs/role_based_assignment_spec.js', 'editor parts: "Run User" option in task edit + add-task form, sibling assignee_type not wiped, editor role->user clears assignee_type')],
     """Target ~9 tests.
- Outline shows Tasks + checklist/step titles (fold into the first test as preconditions).
- Bulk edit: toggle on/off; select/deselect updates count; clear selection (accessible label); action bar buttons (Assign, Delete, Due date) in one test; delete one / many / selection cleared; due date presets; clicking a row selects instead of completing.
- Pre-assigning a user enables invite-users and adds them to the invited list; persists.
- "Run User" role option in task edit and add-task form (1 test, 2 steps). Sibling task `assignee_type` preserved when editing another task (regression). Role -> specific user clears role.""")

task('editor-access', 'Playbook editor: members, private conversion, admin-only edit, owner/group-only toggle',
     ['tests/playbooks/editor_access.spec.ts'],
     [('playbooks/access_spec.js', ALL),
      ('playbooks/edit/admin_only_edit_spec.js', ALL),
      ('playbooks/owner_group_only_actions_toggle_spec.js', 'UI tests only (persist enabled/disabled, hidden for non-admin, disabled when archived). Mid-run behavior is covered as a UI check in owner-only-actions; its API half is not ported (go-coverage-gaps audit)')],
     """Target ~8 tests.
- Members modal add/remove updates list + count; convert to private shows lock icon.
- Flags `admin_only_edit` and `owner_group_only_actions`: one table for "visible to playbook admin, hidden for member, disabled when archived" and one for "enable persists (confirm where required) / disable persists".
- Admin-only locked: non-admin sees every edit control disabled (one test with `test.step`s), playbook admin and sysadmin keep edit access (2-row table).
- Duplicate: member gets 403 / admin succeeds; archive disabled for member; import of an admin_only_edit export succeeds for a non-admin.""",
     )

task('playbook-attributes', 'Playbook attributes (custom property fields)',
     ['tests/playbooks/attributes.spec.ts'],
     [('playbooks/playbook_attributes_spec.js', ALL)],
     """Target ~10 tests.
- Empty state + add first attribute.
- Create by type: table `{text, select + options, multiselect + options, URL}` persists after reload.
- Rename, change type, options CRUD (add, edit, delete, cannot delete last).
- Delete: confirm/cancel, then empty state after last.
- Limit: seed 19 via API, add 20th, button disabled + message; delete re-enables.
- Duplicate text / select (with options) / independent edits.
- Replace `cy.wait(500)` with waits on the save response or visible state.""")

task('conditions', 'Task conditions (editor authoring + run-time visibility)',
     ['tests/playbooks/conditions.spec.ts'],
     [('playbooks/edit/condition_admin_spec.js', ALL),
      ('playbooks/edit/condition_user_spec.js', ALL),
      ('runs/rdp_main_finish_spec.js', '"finish with conditional hidden tasks" describe')],
     """Target ~9 tests, two describes (editor, run).
- Editor: create from task menu, edit operator/value, add OR clause, AND->OR, delete with confirm, assign/remove task to existing condition. All persist after reload.
- Run: table `{is, is_not, AND, OR, text is/is_not}` -> task visible/hidden as property values change live (no reload).
- Checked task whose condition stops matching stays visible with a warning indicator.
- Channel message on property change: 1 task vs 3 tasks (2-row table).
- Finish: hidden conditional tasks are not "outstanding"; a visible incomplete task still warns.""")

task('editor-header', 'Playbook editor header/overview (extend existing edit_header spec)',
     ['tests/playbooks/editor_header.spec.ts (rename from edit_header.spec.ts)'],
     [('playbooks/edit/header_spec.js', 'already ported in edit_header.spec.ts; keep'),
      ('playbooks/overview_spec.js', 'copy link, duplicate (+ duplicate clears run_number_prefix), archiving UI, usage statistics tab')],
     """Target ~7 tests. Rename the existing spec (git mv) and extend it.
- Copy link icon: tooltip, clipboard, "Copied!".
- Duplicate: fold "duplicate clears run_number_prefix" in as an extra assertion in the existing duplicate test; duplicator is a member (Run, not Join).
- Archived playbook shows badge + disabled Run button.
- Usage tab: counters update after starting and finishing a run (seed via API).""")

task('editor-retrospective', 'Playbook editor: retrospective toggle, timer/template, metrics',
     ['tests/playbooks/editor_retrospective.spec.ts'],
     [('playbooks/edit_metrics_spec.js', ALL + ' (split the mega-tests)'),
      ('playbooks/edit/retrospective_toggle_spec.js', 'editor tests (toggle shown, default on, clicking persists)'),
      ('playbooks/edit/actions_spec.js', '"retrospective enable / disable"'),
      ('playbooks/overview_spec.js', '"shows correct retrospective timer and template text"')],
     """Target ~8 tests. Split the 4 Cypress mega-tests into focused ones:
- Add up to 4 metrics (Duration/Cost/Integer), formatted display, Add disabled at 4, persists.
- Validation table: title required, title unique, duration format, numeric target for currency/integer.
- Only one metric in edit mode; switching saves (and validates) the previous one.
- Delete: unsaved vs saved metric confirmation text; repeated add/delete stable.
- 0 and null targets.
- Retrospective toggle default on, disabling persists (API + reload); timer + template text displayed.""")

task('task-requirements', 'Task requirements (beta)',
     ['tests/playbooks/task_requirements.spec.ts'],
     [('playbooks/edit/task_requirements_spec.js', ALL)],
     """Target 3 tests. Enable the beta flag via config API in `beforeAll` (helper from foundations) and restore it in `afterAll`.""")

task('owner-only-actions', 'Owner/group-only actions: finish, restore, reassignment',
     ['tests/runs/owner_only_actions.spec.ts'],
     [('runs/owner_only_finish_spec.js', 'UI tests (RHS finish visibility per role, slash command error, admin reassign-then-finish, restart disabled + tooltip). Direct API tests -> not ported (go-coverage-gaps audit); post-update checkbox -> status-update-dialog'),
      ('runs/owner_reassignment_restriction_spec.js', ALL),
      ('playbooks/owner_group_only_actions_toggle_spec.js', '"toggling the flag mid-run" as a UI check (finish section disappears/appears for participant), API half not ported (go-coverage-gaps audit)')],
     """Target ~8 tests. Likely license-gated: reuse the `ApiError` 501 skip pattern.
- Finish visibility role table `{owner ✔, participant ✘, playbook admin ✘, creator ✘, sysadmin ✔}`; end-to-end finish for owner and sysadmin.
- Old owner loses / new owner gains finish after reassignment; playbook admin reassigns to self then finishes.
- Reassignment table `{owner ✔, participant ✘ + toast, playbook admin ✔, flag off ✔}`.
- Slash command errors for `/playbook finish` and `/playbook owner` as non-owner (2-row table).
- Restart disabled with "Only the run owner can restart this run" tooltip.
- Flag toggled mid-run applies immediately (UI).""")

task('run-visibility', 'Run visibility permission matrix (table-driven)',
     ['tests/runs/run_visibility.spec.ts'],
     [('runs/permissions_spec.js', ALL)],
     """One data table `{playbookVisibility, channelVisibility, role, inList, rdpAccess}` driving one test body (Playwright generates one test per row). Seed all users/teams/playbooks/runs once in `beforeAll`.
- Roles: playbook member, run participant, run follower, team member, non-team member, sysadmin in team, sysadmin not in team.
- **Bug**: the Cypress test "private playbook + private channel > should be visible > to run followers" asserts NOT visible. Encode the real expectation with a correct row name (check server behavior).
- Unfollow: no-RunView user gets "Run not found"; playbook member can unfollow from RDP.
- Document the "sysadmin not in team sees overview but not list" inconsistency in a comment as the Cypress spec did.""")

task('run-actions', 'Run Actions modal and status-update broadcast',
     ['tests/runs/run_actions.spec.ts'],
     [('runs/rdp_main_header_spec.js', '"run actions" + "trigger: when a status update is posted" + context menu "run actions > modal can be opened"'),
      ('channels/broadcast_spec.js', ALL),
      ('channels/rhs/run_actions_dmgm_spec.js', ALL)],
     """Target ~7 tests.
- Modal open/cancel/save (from header button and context menu = 1 test); invalid webhook URL blocks save; inherits playbook settings; channel names shown after reload.
- Broadcast: ONE test with 2 public + 2 private channels replaces "public", "private", "4 channels"; announcement + update thread lands in each.
- Broadcast disabled with channels configured posts nothing.
- Root announcement deleted in broadcast channels, further updates still render.
- DM/GM runs: table `{DM, GM}` -> add/remove-from-channel toggles disabled with hint; broadcast + webhook toggles enabled and persist.""")

task('retrospective', 'Run retrospective (RDP), toggle, reminders, publishing',
     ['tests/runs/retrospective.spec.ts'],
     [('runs/rdp_main_retrospective_spec.js', 'participant tests (viewer -> rdp-viewer)'),
      ('runs/rdp_main_retrospective_toggle_spec.js', ALL),
      ('channels/retrospective_spec.js', ALL),
      ('playbooks/edit/retrospective_toggle_spec.js', 'run/channel tests (section shown/hidden, reminder on finish, re-enable on finished run, "Yes, start retrospective" -> publish)'),
      ('channels/playbook_run_actions.js', 'only "when a playbook run is finished > retrospective is disabled" (finish posts "marked as finished" and no reminder): same as the retro-disabled row of the reminder table')],
     """Target ~10 tests.
- Template text prefilled; publish posts to channel, table `{with metrics -> formatted MetricInfo values, no metrics}` (replaces 4/3/2/1/0); can publish once.
- Metrics: render title/target/description in order; null vs 0; autosave persists (wait on save response, no sleeps); invalid values show errors and aren't saved; publish blocked until valid.
- Toggle in RDP menu: role table `{owner ✔, non-owner participant ✘, sysadmin ✔}`; label + section flip immediately; cancel leaves state; timeline entries; RHS menu never shows it; publish after enabling updates UI without reload.
- Finish with retro enabled vs disabled -> reminder post or not (table). Re-enable on finished run posts reminder; "Yes, start retrospective" navigates and publish posts.""")

task('run-attributes', 'Run attributes (property values on runs)',
     ['tests/runs/attributes.spec.ts'],
     [('runs/run_attributes_spec.js', ALL)],
     """Target ~7 tests. Full matrix on the **RDP**, one smoke on channel RHS (principle P2).
- No section without attributes; inheritance of all types as "Empty".
- Edit + clear per type table `{text, url, select, multiselect}`; URL renders as `target=_blank` link.
- Channel RHS smoke: edit a text attribute.
- Timeline entries table `{set, clear, update select}`.
- Independence from later playbook attribute changes.""")

task('run-naming', 'Run naming: prefix, templates, tokens, sequential IDs',
     ['tests/runs/run_naming.spec.ts'],
     [('playbooks/edit/run_naming_spec.js', 'UI tests (API-only ones -> not ported, go-coverage-gaps audit)'),
      ('runs/owner_creator_template_spec.js', ALL),
      ('runs/sequential_id_spec.js', 'UI tests: list/RDP/RHS display, `{SEQ}` resolution, duplicate prefix toast (API-only ones -> not ported, go-coverage-gaps audit)'),
      ('playbooks/start_run_template_spec.js', 'none of the modal tests (start-run-modal) - reference only for token resolution')],
     """Target ~12 tests.
- Editor: fields present; lock checkbox unchecked by default, persists (template and literal); `{` autocomplete lists SEQ/OWNER/CREATOR; insert-variable button appends; unknown field warning; `{SEQ}` without prefix warning; real property field name has no warning; prefix not wiped by later template edit (regression); duplicate prefix shows error toast and reverts.
- Resolution table `{ {OWNER}, {CREATOR}, both, {SEQ}+both }` -> RDP h1 + API name; name frozen after owner reassignment while reporter stays creator.
- Sequential ID displayed in runs list (prefix and bare number), RDP info, and channel RHS: one test visiting all three.""")

task('task-assignment', 'Role-based task assignment on runs',
     ['tests/runs/task_assignment.spec.ts'],
     [('runs/role_based_assignment_spec.js', 'run/RHS UI tests (creation-time resolution API tests -> not ported (go-coverage-gaps audit); editor parts -> editor-checklists)')],
     """Target ~6 tests.
- Owner-type task follows owner change; creator-type doesn't; manual override sticks.
- Role -> specific user via API clears the role badge in RHS.
- property_user task shows resolved user once value set, survives owner change (WebSocket regression).
- "Run User" option in RHS task editor.""")

task('task-actions', 'Task actions (keyword/user triggers) - merged editor + run',
     ['tests/runs/task_actions.spec.ts'],
     [('playbooks/edit/task_actions_spec.js', ALL),
      ('runs/rdp_main_taskactions_spec.js', ALL)],
     """Target ~7 tests. Both Cypress specs exercise the same modal with the same 11 cases.
- Config validation table (in editor, verify via API): `{no keywords -> disabled, user without keyword -> disabled, unknown user -> ignored, removing all keywords -> disabled}`.
- Trigger behavior on a run: single keyword checks task + timeline entry; multi-word phrase; removed keyword stops triggering while remaining one works; user restriction (only that user triggers); multiple users; one post triggers in multiple runs in the same channel.
- The modal is reached via a CSS icon (`.icon-lightning-bolt-outline`) in Cypress: find an accessible name or add one in the component.""")

task('runs-list', 'Backstage runs list',
     ['tests/runs/runs_list.spec.ts'],
     [('runs/list_spec.js', ALL)],
     """Target ~4 tests. Click run -> RDP; "my runs only" for both users in one test; finished filter; LHS runs sorted by name.""")

task('playbooks-list', 'Backstage playbooks list',
     ['tests/playbooks/list.spec.ts'],
     [('playbooks/list_spec.js', 'all except import tests (import-export)'),
      ('playbooks/pagination_spec.js', ALL)],
     """Target ~6 tests. Join/leave (LHS updates); duplicate (member, Run button, LHS); duplicate with attributes + conditions is independent; archived hidden by default / shown with filter; search resets pagination.""")

task('import-export', 'Playbook import (UI)',
     ['tests/playbooks/import_export.spec.ts'],
     [('playbooks/list_spec.js', 'can import playbook (drag-drop, file input, invalid type)'),
      ('playbooks/export_import_spec.js', 'UI import tests only (API tests -> go-coverage-gaps)')],
     """Target ~4 tests.
- Table `{drag and drop, file input}` importing ONE fixture that contains attributes, a condition linked to a task, and a run number prefix colliding with an existing playbook -> editor shows attributes/options, condition header on task, suffixed prefix.
- Invalid file type error.
- Put fixtures under `tests/fixtures/`.""")

task('rhs-auto-open', 'Channel RHS auto-open rules + /playbook info',
     ['tests/channels/rhs_auto_open.spec.ts'],
     [('channels/rhs_spec.js', ALL),
      ('channels/slash_command/info_spec.js', ALL)],
     """Target ~3 test bodies.
- One table of `{entry: direct URL | LHS click | slash command start | editor run linked to existing channel | app bar icon, runState: none|ongoing|finished|new, rhsPreOpen: none|saved messages} -> expected (closed | run | no-active-runs | home)`.
- Icon toggles RHS Home open/closed.
- `/playbook info`: table `{non-run channel -> error, RHS closed -> opens, RHS open -> ephemeral}`.
- The Cypress spec used 2-5s sleeps for websocket ordering: wait on observable state instead.""")

task('rhs-run-details', 'Channel RHS run details (name, summary, badge, follow, title)',
     ['tests/channels/rhs_run_details.spec.ts'],
     [('channels/rhs/about_spec.js', ALL),
      ('channels/rhs/header_spec.js', ALL),
      ('channels/rhs/title_spec.js', ALL)],
     """Target ~7 tests (`about` and `header` are near-duplicates).
- Name is the run name, not the channel display name; rename updates RHS but not channel header.
- Summary edit persists; finished run: not editable, no "Become a participant" prompt.
- Playbook badge table `{from playbook -> shown and navigates, private playbook without access -> hidden, standalone -> hidden}`.
- Standalone run menu: active has Rename + Finish; finished has Save as playbook + Resume, no Rename.
- Title shows "Checklist", Following -> Follow, click title -> RDP.""")

task('rhs-run-list', 'Channel RHS run list',
     ['tests/channels/rhs_run_list.spec.ts'],
     [('channels/rhs/list_spec.js', ALL)],
     """Target ~6 tests. Filter counts; show more pagination; card info + click-through; dotmenu (go to overview, go to playbook, hidden-cases table `{standalone, private playbook without access}`, move channel reduces count); stays in list after moving with 2 runs. Don't depend on fixed names like 'playbook-run-9'; use generated names.""")

task('rhs-home', 'Channel RHS home / empty state (re-spec against current UI)',
     ['tests/channels/rhs_home.spec.ts'],
     [('channels/rhs/home_spec.js', 'ALL SKIPPED, intent only'),
      ('channels/rhs/template_spec.js', 'ALL SKIPPED, intent only'),
      ('channels/rhs/start_run_rhs_spec.js', 'skipped tests (intent only) + "empty state has no dropdown, only the header does"')],
     """Re-spec, not a port: the Cypress tests are skipped because the Checklists UI changed.
- First explore the current RHS empty state in the running app (use the browser / Playwright codegen) and describe the actual UI in the spec header comment.
- Cover: empty state for a channel without runs (New checklist), header create dropdown entries (Run a playbook, browse), empty-state button has no dropdown, user without playbook create permission (license-gated -> skip pattern).
- ~3 tests. If the intended behavior is unclear, write the open question in the task notes instead of guessing.""")

task('dm-gm-checklists', 'Checklists in DMs / GMs (RHS + RDP)',
     ['tests/channels/dm_gm_checklists.spec.ts'],
     [('channels/rhs/dm_checklist_spec.js', 'UI tests (API ones -> not ported, go-coverage-gaps audit)'),
      ('channels/rhs/gm_checklist_spec.js', 'UI tests (API ones -> not ported, go-coverage-gaps audit)'),
      ('runs/rdp_dm_checklist_spec.js', ALL)],
     """Target ~7 tests.
- Parametrize over `{DM, self-DM, GM}`: create from empty state, add + check task, post status update, assignee selector lists channel members, create dropdown has run-a-playbook + go-to-playbooks.
- Move-channel modal offers DM channels.
- RDP for a DM checklist: direct load, overview entries (incl. self-DM regression 397d5d3f), channel link label + navigates, recent activity after checking a task, View all -> Timeline (no force click), Save as playbook -> outline, hard refresh keeps team in channel link.""")

task('status-update-posts', 'Status update posts and reminder posts in channels',
     ['tests/channels/status_update_posts.spec.ts'],
     [('channels/post_type_components_spec.js', 'non-skipped tests'),
      ('channels/update_post_dm_spec.js', ALL),
      ('channels/update_request_post_spec.js', ALL)],
     """Target ~5 tests.
- custom_run_update renders in the run channel and when permalinked elsewhere.
- Renders (markdown) in the Playbooks bot DM for a participant.
- Reminder post: table `{participant -> text + Post update button, channel member -> text}` x `{channel, Threads view}`; snooze deletes the interactive post.
- Reminder timing: use a 1-2s reminder and `expect.poll`/`toBeVisible({timeout})`, never a fixed sleep. CRT config via config helper.""")

task('channel-actions', 'Channel actions (on-join, keyword prompt)',
     ['tests/channels/channel_actions.spec.ts'],
     [('channels/general_actions_spec.js', 'all except the IDOR API test (not ported, audited by go-coverage-gaps)')],
     """Target ~5 tests. On-join: category + welcome message in one test; keyword prompt -> run (the dialog part is in start-run-entry-points; here assert the bot prompt); "No, ignore thread" deletes prompt and no re-trigger; disabled trigger does nothing; settings reset when switching channel. Replace the `cy.wait(5000)` (MM-45969 workaround) with a state wait.""")

task('channel-header', 'Channel header button / App Bar',
     ['tests/channels/channel_header.spec.ts'],
     [('channels/channel_header_spec.js', ALL),
      ('channels/app_bar_spec.js', 'DEAD in Cypress (nested it), port the intent')],
     """Target ~3 tests. Table `{App Bar enabled -> app bar icon + tooltip, no legacy header button; disabled -> legacy button + tooltip + active state}`; run channel header description links to playbook and overview. Restore the App Bar config in `afterAll`.""")

task('slash-run-commands', '/playbook run commands (check, checkadd, checkremove, owner, timeline, finish, update)',
     ['tests/slash_commands/run_commands.spec.ts'],
     [('channels/slash_command/commands_spec.js', ALL),
      ('channels/slash_command/owner_spec.js', ALL)],
     """Target ~8 tests.
- Single-run happy paths: check (+ autocomplete count), checkadd, checkremove, timeline, finish (confirm), update (dialog -> post).
- Multi-run disambiguation: ONE table across subcommands `{missing args, invalid run number, view-only run -> "Become a participant"}` instead of repeating per command; then valid write-access paths; timeline allowed on view-only.
- Owner: table `{no args -> shows owner, unknown user (with/without @), user not in channel (with/without @) -> changes, already owner, two usernames -> error, valid change}`; error outside a run channel.
- Drop the cross-suite `switchToChannel` import; use page objects.""")

task('slash-todo-digest', '/playbook todo and digest links',
     ['tests/slash_commands/todo_digest.spec.ts'],
     [('channels/slash_command/todo_spec.js', ALL),
      ('digest_spec.js', 'SKIPPED (MM-63692), intent: digest links go to RDP with ?from=digest_*')],
     """Target ~3 tests. Runs in progress (count + order); assigned tasks (count updates after closing); overdue runs first. Add the digest link assertions (`?from=digest_overduestatus|runsinprogress|assignedtask`) to the matching tests; if MM-63692 still breaks it, `test.fixme` with the ticket. Replace `cy.wait(1100)` with `expect.poll`.""")

task('lhs', 'LHS navigation and dot menus',
     ['tests/navigation/lhs.spec.ts'],
     [('lhs_spec.js', 'all except "lhs refresh on follow/unfollow" (participants)')],
     """Target ~5 tests. Dot menu table `{run, playbook} x {copy link, favorite/unfavorite}`; leave run as owner requires reassignment; leave run without permanent access table `{on its RDP -> redirect to runs list, elsewhere -> stay}`; leave playbook.""")

task('not-found', 'Not-found routing',
     ['tests/navigation/not_found.spec.ts'],
     [('playbooks/overview_spec.js', 'the two not-found redirect tests'),
      ('runs/rdp_general_spec.js', ALL)],
     """One table `{unknown playbook id -> error?type=playbooks, malformed playbook url -> type=default, unknown run -> type=playbook_runs, malformed run url -> type=default}`.""")

task('task-inbox', 'Task inbox',
     ['tests/navigation/task_inbox.spec.ts'],
     [('runs/taskinbox_spec.js', ALL)],
     """Target ~3 tests. Header icon toggles panel ("Your tasks", count); filter all-from-owned-runs vs assigned only; checking a task hides it and "show checked" brings it back. Cypress used styled-component class selectors: add accessible names/roles in the webapp component if needed (that's in scope).""")

task('site-statistics', 'Admin console site statistics',
     ['tests/admin/site_statistics.spec.ts'],
     [('adminconsole/analytics_spec.js', ALL)],
     """One test: counters visible, create a playbook and a run as a regular user, reload, both counters +1.""")

task('go-coverage-gaps', 'Go coverage audit for Cypress API-only tests (report only, no Go changes)',
     ['e2e-tests/playwright/docs/tasks/go-coverage-gaps.result.md'],
     [('api/runs_spec.js', ALL), ('api/graphql_errors_spec.js', ALL), ('api/property_fields_graphql_spec.js', ALL),
      ('playbooks/export_import_spec.js', 'API export/import tests'),
      ('runs/new_channel_enforcement_spec.js', 'API contract tests'),
      ('runs/sequential_id_spec.js', 'API-only tests'),
      ('playbooks/edit/run_naming_spec.js', 'API-only tests (unlocked default, clearing both fields, prefix normalization)'),
      ('playbooks/start_run_template_spec.js', 'backend ignores client-supplied name when locked (x2)'),
      ('runs/owner_only_finish_spec.js', 'restore via API (x3), direct PUT finish 403'),
      ('playbooks/owner_group_only_actions_toggle_spec.js', 'mid-run toggle, no grandfathering'),
      ('runs/role_based_assignment_spec.js', 'owner/creator resolution at creation'),
      ('channels/general_actions_spec.js', 'MM-58432 ignore-thread IDOR'),
      ('channels/rhs/dm_checklist_spec.js', 'rejects run in DM; moving populates team_id'),
      ('channels/rhs/gm_checklist_spec.js', 'rejects run in GM; moving populates team_id'),
      ('channels/slash_command/test_spec.js', 'argument validation matrix')],
     """**Audit only. Hard rule: no Go file may change, and no code changes at all.** The output is one Markdown report.
For each listed Cypress API-only test, find the equivalent assertion in `server/api_*_test.go`, `server/app/*_test.go`, `server/command/*`, etc. Write `e2e-tests/playwright/docs/tasks/go-coverage-gaps.result.md` with a table: `cypress spec > test | covered by (file:TestFunc/subtest) | status: COVERED / PARTIAL / GAP | note`.
- COVERED: the Cypress test can be retired without replacement.
- PARTIAL / GAP: it must NOT be silently dropped. Pick one: (a) a Playwright task in `docs/todo.json` can cover it through the UI; name the task, and add the item to that task's doc under `## Added by go-coverage-gaps`. Or (b) list it under `## Follow-ups (outside the migration)` as a proposed Go test (file + test name + what to assert) for humans to schedule. In that case `retire-cypress` keeps the Cypress spec.
Likely gaps to check carefully: import rejects an unsupported `version` / a payload with `id`; round-trip remaps condition IDs; `channel_name_template_locked` defaults to false and a locked template ignores the client-supplied name; clearing template + prefix in one PATCH; prefix normalization `ABC-` -> `ABC`; `/playbook test` argument validation.""",
     kind='report')

task('retire-cypress', 'Retire migrated Cypress specs',
     ['e2e-tests/cypress/tests/integration/playbooks/**'],
     [],
     """Run last. For every Cypress spec in `docs/cypress_inventory.md`, check whether every task that lists it as a source is `done` in `docs/todo.json`. Delete fully covered specs (git rm). Also delete `e2e-tests/cypress/tests/integration/playbooks/tours_spec_ignore_.js`: it was dropped by decision (never ran, not ported). `channels/playbook_run_actions.js` follows the normal rule (covered by `run-start-actions`). A spec that has a PARTIAL/GAP row in `docs/tasks/go-coverage-gaps.result.md` assigned to "Follow-ups (outside the migration)" is NOT fully covered: keep it. Leave the others, and list them with the blocking task ids in `docs/tasks/retire-cypress.result.md`. Also remove now-unused Cypress support helpers only if nothing else imports them. Do not touch CI config unless all specs are gone; in that case, note it instead of changing it.""",
     kind='cleanup')

# ---------------- write docs ----------------
os.makedirs(TASKS_DIR, exist_ok=True)

COMMON_PW = """## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Rules (non-negotiable)

- Follow `e2e-tests/playwright/AGENTS.md` (POM is mandatory: no `page.getBy*`/`page.locator` in specs; a11y-first locators; API seeding through `tests/helpers`; `@objective` JSDoc; `{tag: '@playbooks'}`; `#`/`*` comments; collision-free names; no fixed waits).
- Apply the consolidation principles P1-P7 from `docs/cypress_migration_plan.md`: modernize, don't copy-paste. Every behavior listed under "Cypress coverage" must be covered by some assertion, unless this doc says it moves elsewhere.
- Reuse and extend existing page objects/helpers before creating new ones. If a webapp component lacks an accessible name needed for a role locator, adding an a11y attribute in `webapp/` is allowed (hard rule 2, nothing else).
- Don't delete Cypress specs (that's the `retire-cypress` task).
- **Stuck on a selector?** You may use the agent-browser skill (`agent-browser skills get core`) to explore the running app and read its accessibility tree (roles + accessible names). Turn what you find into role/label locators in a page object. Artifacts go to /tmp only; never change server config through the System Console. It's an exploration aid only; the Playwright tests must pass on their own.

## Definition of done

1. Target spec(s) exist and pass locally: `cd e2e-tests/playwright && npx playwright test <spec> --reporter=list` (server at `MM_SERVICESETTINGS_SITEURL`, default `http://localhost:8065`, plugin deployed with `make deploy` if you added webapp a11y attributes).
2. Run it a second time to check stability (`--repeat-each=2` is fine).
3. `e2e-tests/playwright/docs/quality.sh` prints `QUALITY: PASS` (log saved as `docs/tasks/reviews/<task-id>.attempt-<n>.quality.log`). If it redeployed the plugin, re-run step 1 afterwards.
4. At the top of the spec, a comment lists the Cypress spec(s) it replaces (and which parts).
"""

COMMON_REPORT = """## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Definition of done

1. `git status` shows only the new report file (and appended `## Added by go-coverage-gaps` sections in task docs, if any).
2. Every listed Cypress test appears in the report table with a status.
3. `e2e-tests/playwright/docs/quality.sh` prints `QUALITY: PASS`.
"""

COMMON_CLEANUP = """## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Rules

- Read `docs/todo.json` to know which tasks are done. Only delete specs whose every consuming task is done.
- **Quality gates are part of done.** Before reporting done you MUST run `e2e-tests/playwright/docs/quality.sh 2>&1 | tee e2e-tests/playwright/docs/tasks/reviews/<task-id>.attempt-<n>.quality.log` (it runs the CI checks matching your change: lint/types for webapp, Cypress and Playwright, i18n + GraphQL regeneration, `make deploy`, plus the hard-rule checks: no Go changes, webapp a11y-only) and **fix every issue it reports, then re-run it until it prints `QUALITY: PASS`**. Never disable a lint rule, add `eslint-disable`/`//nolint`, edit `eslint.config.mjs`/`eslint-rules/` to weaken a rule, or skip a test to get green. Keep regenerated files (`webapp/i18n/en.json`, GraphQL generated code) in the tree. If a failure is pre-existing and unrelated (prove it: it also fails on a clean `HEAD` via `git stash push -u -- e2e-tests webapp`, run, `git stash pop`; never stash the whole repo, which has untracked agent tooling), don't hide it: record the proof under `## Pre-existing failures` at the end of the quality log, and keep everything else green.
"""

CORE_RULE = """- **Mattermost core UI goes through `MattermostCore`** (`tests/pages/mattermost/`, created by the `mattermost-core-pom` task): channels, posts, ephemeral messages, LHS sidebar, app bar/channel header, core RHS/threads, generic modals, interactive dialogs, System Console. Plugin page objects and specs must not locate core UI themselves. Extend `MattermostCore` if something is missing. The reviewer treats core-UI locators outside `tests/pages/mattermost/` as MAJOR.
"""
core_idx = next(i for i, t in enumerate(T) if t['id'] == 'mattermost-core-pom')

todo = []
for i, t in enumerate(T, 1):
    fname = f'{i:02d}-{t["id"]}.md'
    rel_doc = f'e2e-tests/playwright/docs/tasks/{fname}'
    lines = [f'# Task {i:02d}: {t["name"]}', '', f'**Task id**: `{t["id"]}` · **Kind**: {t["kind"]}', '']
    lines += ['## Target', ''] + [f'- `{x}`' for x in t['targets']] + ['']
    lines += ['## What to do', '', t['guidance'].strip(), '']
    if t['kind'] == 'playwright':
        pw = COMMON_PW
        if i - 1 > core_idx:
            pw = pw.replace("## Definition of done", CORE_RULE + "\n## Definition of done", 1)
        lines += [pw]
    elif t['kind'] in ('go', 'report'):
        lines += [COMMON_REPORT]
    elif t['kind'] == 'cleanup':
        lines += [COMMON_CLEANUP]
    if t['sources']:
        lines += ['## Cypress coverage (sources)', '',
                  'Scope column says which part of each source spec belongs to THIS task. The excerpt below is the full inventory of that spec; ignore the parts outside the scope.', '',
                  '| Cypress spec | Scope for this task |', '|---|---|']
        for p, scope in t['sources']:
            lines.append(f'| `{CY_PREFIX}{p}` | {scope} |')
        lines.append('')
        for p, scope in t['sources']:
            sec = sections.get(p)
            if sec is None:
                raise SystemExit(f'missing inventory section: {p}')
            lines += [f'### `{p}`', '', f'> Scope: {scope}', '', sec, '']
    open(os.path.join(TASKS_DIR, fname), 'w').write('\n'.join(lines).rstrip() + '\n')
    is_done = t['kind'] == 'done'
    todo.append({
        'id': t['id'],
        'name': t['name'],
        'doc': rel_doc,
        'done': is_done,
        'coded_at': DONE_AT if is_done else None,
        'reviewed_at': DONE_AT if is_done else None,
        'review_status': 'OK' if is_done else None,
        'attempts': 0,
        'notes': 'Ported before task tracking started.' if is_done else None,
    })

# remove generated task docs that are no longer produced (renumbering); never touches reviews/ or *.result.md
produced = {os.path.basename(t['doc']) for t in todo}
for f in os.listdir(TASKS_DIR):
    if re.match(r'^\d{2}-.*\.md$', f) and f not in produced:
        os.remove(os.path.join(TASKS_DIR, f))

todo_path = os.path.join(DOCS, 'todo.json')
if os.path.exists(todo_path):
    # Merge: keep each existing task's state, follow the generator for order/name/doc, append new tasks in place.
    old = {t['id']: t for t in json.load(open(todo_path))['tasks']}
    gen_ids = [t['id'] for t in todo]
    removed = sorted(set(old) - set(gen_ids))
    if removed:
        raise SystemExit(f'todo.json has tasks the generator no longer defines: {removed}; remove them manually')
    merged = []
    for t in todo:
        if t['id'] in old:
            keep = dict(old[t['id']])
            keep['name'], keep['doc'] = t['name'], t['doc']
            merged.append(keep)
        else:
            merged.append(t)
            print('added task:', t['id'])
    todo = merged
json.dump({'version': 1, 'tasks': todo}, open(todo_path, 'w'), indent=2)
open(todo_path, 'a').write('\n')

# coverage check: every inventory spec used by at least one task
used = {p for t in T for p, _ in t['sources']}
missing = sorted(set(sections) - used)
print('tasks:', len(T))
print('unmapped inventory specs:', missing)
