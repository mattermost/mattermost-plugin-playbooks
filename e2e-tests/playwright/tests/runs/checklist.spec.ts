// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Playwright port of:
//   e2e-tests/cypress/tests/integration/playbooks/channels/rhs/checklist_spec.js  — all tests
//   e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_checklist_spec.js — participant tests only
//   e2e-tests/cypress/tests/integration/playbooks/runs/rdp_checked_chip_spec.js   — all tests
//   e2e-tests/cypress/tests/integration/playbooks/runs/task_progress_spec.js      — all tests
//
// Consolidation applied (see docs/cypress_migration_plan.md §1):
//   P2: Full checklist matrix on channel RHS; one RDP smoke test.
//   P3: Progress cases parametrized in a table.  Chip state verified in a single test.
//   P5: Large 'rhs stuff' describe split into logical groups.
//
// Renaming behavior note: The Cypress test for 'renames a checklist' did NOT clear the
// input before typing the new title, so it asserted the concatenation oldTitle+newTitle.
// That is a Cypress test bug: the rename input is pre-filled with the existing title and
// typing without clearing appends. The Playwright port uses fill() (clear+replace), which
// matches the real intended user action. The correct expectation is therefore the new
// title only — not the concatenation. See task doc §notes for full explanation.

import {test, expect} from '@playwright/test';

import {loginAs, loginAsAdmin} from '../helpers/auth';
import {uniqueSuffix} from '../helpers/client';
import {createPlaybook} from '../helpers/playbook';
import {createRun, setChecklistItemState, setChecklistItemDueDate, type Run} from '../helpers/run';
import {addUserToTeam, createTeam, type Team} from '../helpers/team';
import {createUser, type SeededUser} from '../helpers/user';
import {ChannelRhs} from '../pages/channel_rhs';
import {RunDetailsPage} from '../pages/run_details_page';
import {PlaybooksPage} from '../pages/playbooks_page';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

// ─────────────────────────────────────────────────────────────────────────────
// Shared state
// ─────────────────────────────────────────────────────────────────────────────

interface SeededData {
    team: Team;
    user: SeededUser;
    /** Viewer user — not a run participant. Used for RDP smoke. */
    viewer: SeededUser;
    /** Playbook id for the large 4×12 checklist (RHS matrix). */
    rhsPlaybookId: string;
    /** Playbook id for the small 1×4 checklist (task-progress tests). */
    progressPlaybookId: string;
    /** Playbook id with 2×2 checklist (RDP smoke). */
    rdpPlaybookId: string;
}

let seededData: SeededData;

test.beforeAll(async ({browser}) => {
    const context = await browser.newContext({baseURL});
    const page = await context.newPage();

    await loginAsAdmin(page);

    const team = await createTeam(page, 'checklist');
    const user = await createUser(page, 'chk-user');
    const viewer = await createUser(page, 'chk-viewer');
    await addUserToTeam(page, team.id, user.id);
    await addUserToTeam(page, team.id, viewer.id);

    // Log in as the ordinary user to create playbooks with them as member.
    await loginAs(page, user.username, user.password);

    // Large playbook for RHS matrix: 4 checklists × 12 items (= 48 total).
    // Stage 1 items 0-2 have slash commands; others are plain tasks.
    const rhsPlaybook = await createPlaybook(page, team.id, `CHK RHS PB ${uniqueSuffix()}`, {
        members: [],
        checklists: [
            {
                title: 'Stage 1',
                items: [
                    {title: 'Step 1', command: '/invalid'},
                    {title: 'Step 2', command: '/echo VALID'},
                    {title: 'Step 3', command: '/playbook check 0 0'},
                    {title: 'Step 4'}, {title: 'Step 5'}, {title: 'Step 6'},
                    {title: 'Step 7'}, {title: 'Step 8'}, {title: 'Step 9'},
                    {title: 'Step 10'}, {title: 'Step 11'}, {title: 'Step 12'},
                ],
            },
            {
                title: 'Stage 2',
                items: [
                    {title: 'Step 1', command: '/invalid'},
                    {title: 'Step 2', command: '/echo VALID'},
                    {title: 'Step 3'}, {title: 'Step 4'}, {title: 'Step 5'},
                    {title: 'Step 6'}, {title: 'Step 7'}, {title: 'Step 8'},
                    {title: 'Step 9'}, {title: 'Step 10'}, {title: 'Step 11'},
                    {title: 'Step 12'},
                ],
            },
            {
                title: 'Stage 3',
                items: [
                    {title: 'Step 1', command: '/invalid'},
                    {title: 'Step 2', command: '/echo VALID'},
                    {title: 'Step 3'}, {title: 'Step 4'}, {title: 'Step 5'},
                    {title: 'Step 6'}, {title: 'Step 7'}, {title: 'Step 8'},
                    {title: 'Step 9'}, {title: 'Step 10'}, {title: 'Step 11'},
                    {title: 'Step 12'},
                ],
            },
            {
                title: 'Stage 4',
                items: [
                    {title: 'Step 1', command: '/invalid'},
                    {title: 'Step 2', command: '/echo VALID'},
                    {title: 'Step 3'}, {title: 'Step 4'}, {title: 'Step 5'},
                    {title: 'Step 6'}, {title: 'Step 7'}, {title: 'Step 8'},
                    {title: 'Step 9'}, {title: 'Step 10'}, {title: 'Step 11'},
                    {title: 'Step 12'},
                ],
            },
        ],
    });

    // Small playbook for task-progress tests: 1 checklist × 4 tasks.
    const progressPlaybook = await createPlaybook(page, team.id, `CHK Progress PB ${uniqueSuffix()}`, {
        members: [],
        createPublicPlaybookRun: true,
        checklists: [
            {
                title: 'Stage 1',
                items: [
                    {title: 'Task 1'},
                    {title: 'Task 2'},
                    {title: 'Task 3'},
                    {title: 'Task 4'},
                ],
            },
        ],
    });

    // Playbook for RDP smoke: 2 checklists × 2 tasks.
    const rdpPlaybook = await createPlaybook(page, team.id, `CHK RDP PB ${uniqueSuffix()}`, {
        members: [],
        checklists: [
            {title: 'Stage 1', items: [{title: 'Step 1'}, {title: 'Step 2'}]},
            {title: 'Stage 2', items: [{title: 'Step 1'}, {title: 'Step 2'}]},
        ],
    });

    seededData = {
        team,
        user,
        viewer,
        rhsPlaybookId: rhsPlaybook.id,
        progressPlaybookId: progressPlaybook.id,
        rdpPlaybookId: rdpPlaybook.id,
    };

    await context.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create a fresh RHS run and navigate to its channel.
// ─────────────────────────────────────────────────────────────────────────────

async function startRhsRun(page: Parameters<typeof createRun>[0], rhs: ChannelRhs): Promise<Run> {
    const run = await createRun(page, {
        name: `CHK RHS Run ${uniqueSuffix()}`,
        ownerUserId: seededData.user.id,
        teamId: seededData.team.id,
        playbookId: seededData.rhsPlaybookId,
    });
    // The run creates a channel; navigate there — the RHS auto-opens.
    // We get the channel name from the run's channel_id by navigating to the run first
    // then following the channel link.
    const rdp = new RunDetailsPage(page);
    await rdp.goto(seededData.team.name, run.id);
    await rdp.clickChannelLink();
    await rhs.title.waitFor();
    return run;
}

// ─────────────────────────────────────────────────────────────────────────────
// RHS: header
// ─────────────────────────────────────────────────────────────────────────────

test.describe('RHS checklist', () => {
    /**
     * @objective The RHS checklist panel shows a 'Tasks' heading.
     */
    test('has Tasks heading', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run's channel
        await loginAs(page, seededData.user.username, seededData.user.password);
        await startRhsRun(page, rhs);

        // * 'Tasks' heading is visible
        await rhs.expectTasksHeading();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RHS: slash commands
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @objective Running /invalid shows an ephemeral error and the button stays 'Run';
     *            running /echo VALID posts 'VALID' and the button becomes 'Rerun';
     *            after a page reload both states persist.
     */
    test('slash commands: invalid error + valid run + persistence after reload', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        const run = await startRhsRun(page, rhs);

        // * Run button 0 (/invalid) starts as 'Run'
        await rhs.expectRunButtonText(0, 'Run');

        // # Click Run for the /invalid command
        await rhs.clickRunButton(0);

        // * Button still shows 'Run' (command failed)
        await rhs.expectRunButtonText(0, 'Run');

        // * An ephemeral error message appears in the channel
        await rhs.mm.postList.expectEphemeral('Failed to execute slash command /invalid');

        // * Run button 1 (/echo VALID) starts as 'Run'
        await rhs.expectRunButtonText(1, 'Run');

        // # Click Run for the /echo VALID command
        await rhs.clickRunButton(1);

        // * Button changes to 'Rerun'
        await rhs.expectRunButtonText(1, 'Rerun');

        // * 'VALID' is posted to the channel
        await rhs.mm.postList.expectAnyPostContains('VALID');

        // # Reload and re-open the channel RHS
        const rdp = new RunDetailsPage(page);
        await rdp.goto(seededData.team.name, run.id);
        await rdp.clickChannelLink();
        await rhs.title.waitFor();

        // * Button 0 still shows 'Run' (invalid command never completed)
        await rhs.expectRunButtonText(0, 'Run');

        // * Button 1 still shows 'Rerun' (valid command ran)
        await rhs.expectRunButtonText(1, 'Rerun');
    });

    /**
     * @objective Running /playbook check 0 0 checks the first task's checkbox
     *            and the state persists after a page reload.
     */
    test('/playbook check command checks task, persists after reload', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        const run = await startRhsRun(page, rhs);

        // * Run button 2 (/playbook check 0 0) starts as 'Run'
        await rhs.expectRunButtonText(2, 'Run');

        // # Click Run
        await rhs.clickRunButton(2);

        // * Button becomes 'Rerun'
        await rhs.expectRunButtonText(2, 'Rerun');

        // * First checklist item (index 0) is now checked
        await rhs.expectTaskChecked(0);

        // # Reload the page and navigate back
        const rdp = new RunDetailsPage(page);
        await rdp.goto(seededData.team.name, run.id);
        await rdp.clickChannelLink();
        await rhs.title.waitFor();

        // * Button 2 still shows 'Rerun'
        await rhs.expectRunButtonText(2, 'Rerun');

        // * Task 0 is still checked
        await rhs.expectTaskChecked(0);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RHS: task actions (skip/restore, add)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @objective A task can be skipped via its dot-menu and then restored,
     *            removing the skipped marker.
     */
    test('skip and restore task', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        await startRhsRun(page, rhs);

        // # Skip task 0 via its dot-menu
        await rhs.skipTask(0);

        // * Task 0 checkbox area shows the skipped marker
        await rhs.expectTaskSkipped(0);

        // # Restore task 0 via its dot-menu
        await rhs.restoreTask(0);

        // * Skipped marker is gone
        await rhs.expectTaskNotSkipped(0);
    });

    /**
     * @objective A new task can be added via the RHS 'add task' button, and
     *            via the /playbook checkadd slash command.
     */
    test('add task via UI and slash command', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        await startRhsRun(page, rhs);

        // # Add a task via the UI add-task button
        const uiTaskText = `UI task ${uniqueSuffix()}`;
        await rhs.addTask(uiTaskText);

        // * New task is visible
        await rhs.expectTaskVisible(uiTaskText);

        // # Add a task via the /playbook checkadd slash command
        const slashTaskText = `Slash task ${uniqueSuffix()}`;
        await rhs.mm.channels.runSlashCommand(`/playbook checkadd 0 ${slashTaskText}`);

        // * New slash-command task is visible
        await rhs.expectTaskVisible(slashTaskText);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RHS: checklist CRUD (create + rename)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @objective A new checklist can be created by clicking the add-checklist button.
     */
    test('create new checklist', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        await startRhsRun(page, rhs);

        const newChecklistTitle = `New Checklist ${uniqueSuffix()}`;

        // # Click add-checklist button, type a title, save
        await rhs.createChecklist(newChecklistTitle);

        // * New checklist title is visible in the RHS
        await rhs.expectChecklistTitle(newChecklistTitle);
    });

    /**
     * @objective Renaming a checklist via its dot-menu updates the displayed title.
     *
     * Implementation note: The Cypress test for this case did NOT call clear() before
     * typing the new title, resulting in an assertion of oldTitle+newTitle — that is a
     * Cypress test bug (the rename input is pre-filled with the current title; typing
     * without clearing appends).  This Playwright port uses fill() (which replaces the
     * content), matching real user intent.  The correct expected title is the new title
     * alone.
     */
    test('rename checklist', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        await startRhsRun(page, rhs);

        const newTitle = `Renamed ${uniqueSuffix()}`;

        // # Rename the first checklist (Stage 1)
        await rhs.renameChecklist(0, newTitle);

        // * Old title is gone
        await rhs.expectChecklistTitleAbsent('Stage 1');

        // * New title is shown
        await rhs.expectChecklistTitle(newTitle);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RHS: due dates
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @objective A due date can be set from the task hover menu (calendar icon).
     */
    test('set due date from hover menu', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        await startRhsRun(page, rhs);

        // # Set a due date on task 6 using the hover-menu calendar icon.
        // We use the 'Tomorrow' default option (always present, no typing needed) so the
        // test doesn't depend on chrono-node parsing relative-time text reliably.
        await rhs.setDueDateFromHoverMenu(6, 'Tomorrow');

        // * A due-date info button appears showing 'Due'
        await rhs.expectDueDateButtonVisible(0);
    });

    /**
     * @objective A due date can be set from task edit mode.
     */
    test('set due date from edit mode', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        await startRhsRun(page, rhs);

        // # Open the edit mode for task 6 via hover menu edit button
        await rhs.openEditModeForTask(6);

        // # Click the due-date info button to open the date picker
        await rhs.clickDueDateInfoButton(0);

        // # Click a default date picker option ('Tomorrow')
        await rhs.selectDateOption('Tomorrow');

        // * The due-date info button shows 'Due'
        await rhs.expectDueDateButtonVisible(0);
    });

    /**
     * @objective The overdue filter badge shows the count of overdue tasks (excluding
     *            skipped/completed); clicking it filters the list; clicking again restores
     *            the full list; and checking the last overdue task auto-removes the badge.
     *
     * @precondition
     * Due dates are set via API to ensure reliable past timestamps (not subject to UI
     * date-picker option ambiguity). Tasks are: 2 overdue, 1 skipped, 1 completed.
     */
    test('overdue filter: count, toggle, and auto-disappear when all cleared', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and create a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        const run = await createRun(page, {
            name: `CHK Overdue Run ${uniqueSuffix()}`,
            ownerUserId: seededData.user.id,
            teamId: seededData.team.id,
            playbookId: seededData.rhsPlaybookId,
        });

        // # Set past due dates via API on tasks 2, 3, 5, 6 to make them overdue
        const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
        await setChecklistItemDueDate(page, run.id, 0, 2, oneHourAgoMs - 0);
        await setChecklistItemDueDate(page, run.id, 0, 3, oneHourAgoMs - 1000);
        await setChecklistItemDueDate(page, run.id, 0, 5, oneHourAgoMs - 2000);
        await setChecklistItemDueDate(page, run.id, 0, 6, oneHourAgoMs - 3000);

        // # Navigate to the run channel
        const rdp = new RunDetailsPage(page);
        await rdp.goto(seededData.team.name, run.id);
        await rdp.clickChannelLink();
        await rhs.title.waitFor();

        // # Skip task 3 (skipped tasks are excluded from the overdue count)
        await rhs.skipTask(3);

        // # Check task 5 (completed tasks are excluded from the overdue count)
        await rhs.checkTaskAtIndex(5);

        // * Overdue filter shows '2 tasks overdue' (tasks 2 and 6 remain uncompleted+unskipped)
        await rhs.expectOverdueFilterText('2 tasks overdue');

        // # Click overdue filter to show only overdue tasks
        await rhs.clickOverdueFilter();

        // * Only 2 overdue tasks are shown
        await rhs.expectVisibleTaskCount(2);

        // # Click overdue filter again to cancel
        await rhs.clickOverdueFilter();

        // * All 48 tasks are shown again
        await rhs.expectVisibleTaskCount(48);

        // ── auto-disappear: filter to single overdue task, check it, verify badge gone ──

        // # Set a single overdue date on task 2 only (replace previous; skip/complete others)
        // Use a new run to avoid state from the multi-overdue setup above.
        const run2 = await createRun(page, {
            name: `CHK Overdue Run2 ${uniqueSuffix()}`,
            ownerUserId: seededData.user.id,
            teamId: seededData.team.id,
            playbookId: seededData.rhsPlaybookId,
        });
        await setChecklistItemDueDate(page, run2.id, 0, 2, Date.now() - 60_000);

        await rdp.goto(seededData.team.name, run2.id);
        await rdp.clickChannelLink();
        await rhs.title.waitFor();

        // * Overdue filter badge shows '1 task overdue'
        await rhs.expectOverdueFilterText('1 task overdue');

        // # Filter to show only overdue task
        await rhs.clickOverdueFilter();

        // * Only 1 overdue task visible
        await rhs.expectVisibleTaskCount(1);

        // # Mark the only visible overdue task as completed
        await rhs.checkTaskAtIndex(0);

        // * Overdue filter badge disappears after all overdue tasks are completed
        await rhs.expectOverdueFilterHidden();

        // * Full task list (48) is visible again
        await rhs.expectVisibleTaskCount(48);
    });

    /**
     * @objective Due dates are isolated per-run: setting a due date in run A does not
     *            appear when switching to run B (using the same playbook/checklist).
     */
    test('due-date state is isolated per run', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open run A
        await loginAs(page, seededData.user.username, seededData.user.password);
        const runA = await startRhsRun(page, rhs);

        // # Set a due date on task 2 in run A (use default 'Tomorrow' option)
        await rhs.setDueDateFromHoverMenu(2, 'Tomorrow');
        await rhs.expectDueDateButtonVisible(0);

        // # Create run B and navigate to its channel
        const runB = await createRun(page, {
            name: `CHK RHS Run B ${uniqueSuffix()}`,
            ownerUserId: seededData.user.id,
            teamId: seededData.team.id,
            playbookId: seededData.rhsPlaybookId,
        });
        const rdp = new RunDetailsPage(page);
        await rdp.goto(seededData.team.name, runB.id);
        await rdp.clickChannelLink();
        await rhs.title.waitFor();

        // * Task 2 in run B has no due date
        await rhs.expectNoDueDateAtTask(2);

        // # Sanity: run A still exists (avoid variable-unused lint)
        expect(runA.id).toBeTruthy();
    });

    /**
     * @objective Scrolling deep into a long task list and opening the due-date picker
     *            on a far-down item renders the date picker visibly (regression: scroll
     *            position could push the floating picker off-screen).
     */
    test('date picker visible when task is scrolled deep in the list', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        await startRhsRun(page, rhs);

        // # Scroll to the task ~3 pages down (index 26) and open its date picker
        await rhs.openDueDatePickerAtScrolledTask(26);

        // * The react-select combobox (date picker) is visible
        await rhs.expectDatePickerVisible();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Checked-by chip
// ─────────────────────────────────────────────────────────────────────────────

test.describe('checked-by chip', () => {
    /**
     * @objective Checking a task shows a 'checked off' chip; unchecking it changes the
     *            chip tooltip to 'unchecked'; skipping shows 'skipped'; restoring shows
     *            'restored'; an untouched task shows no chip at all.
     */
    test('chip state transitions (checked, unchecked, skipped, restored, untouched)', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);

        // # Log in and open a fresh run.  Use the RHS playbook (already seeded).
        await loginAs(page, seededData.user.username, seededData.user.password);

        // Create a dedicated run so interactions don't bleed across tests.
        const run = await createRun(page, {
            name: `CHK Chip Run ${uniqueSuffix()}`,
            ownerUserId: seededData.user.id,
            teamId: seededData.team.id,
            playbookId: seededData.rhsPlaybookId,
        });
        const rdp = new RunDetailsPage(page);
        await rdp.goto(seededData.team.name, run.id);
        await rdp.clickChannelLink();
        await rhs.title.waitFor();

        // We'll add two fresh tasks to avoid touching slash-command items.
        const checkTaskText = `Chip check task ${uniqueSuffix()}`;
        const skipTaskText = `Chip skip task ${uniqueSuffix()}`;
        const untouchedText = `Untouched ${uniqueSuffix()}`;
        await rhs.addTask(checkTaskText);
        await rhs.addTask(skipTaskText);
        await rhs.addTask(untouchedText);

        // Locate the added tasks by their position at the end of Stage 1 (items 12, 13, 14
        // after the 12 seeded items).
        const checkIdx = 12;
        const skipIdx = 13;
        const untouchedIdx = 14;

        // ── untouched task shows no chip ──────────────────────────────────────

        // * An untouched task shows no chip
        await rhs.expectCheckedByChipHidden(untouchedIdx);

        // ── check → 'checked off' chip ───────────────────────────────────────

        // # Check the first added task
        await rhs.checkTaskAtIndex(checkIdx);
        await rhs.expectTaskChecked(checkIdx);

        // * Chip appears
        await rhs.expectCheckedByChipVisible(checkIdx);

        // * Tooltip says 'checked off' (or 'Checked off')
        await rhs.expectChipTooltipContains(checkIdx, 'hecked off');

        // ── uncheck → 'unchecked' chip ────────────────────────────────────────

        // # Uncheck the task
        await rhs.checkTaskAtIndex(checkIdx);

        // * Chip stays visible with 'unchecked' tooltip
        await rhs.expectCheckedByChipVisible(checkIdx);
        await rhs.expectChipTooltipContains(checkIdx, 'nchecked');

        // ── skip → 'skipped' chip ────────────────────────────────────────────

        // # Skip the second added task
        await rhs.skipTask(skipIdx);

        // * Chip appears with 'skipped' tooltip
        await rhs.expectCheckedByChipVisible(skipIdx);
        await rhs.expectChipTooltipContains(skipIdx, 'kipped');

        // ── restore → 'restored' chip ─────────────────────────────────────────

        // # Restore the task
        await rhs.restoreTask(skipIdx);

        // * Chip stays visible with 'restored' tooltip (NOT 'unchecked')
        await rhs.expectCheckedByChipVisible(skipIdx);
        await rhs.expectChipTooltipContains(skipIdx, 'estored');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task progress indicator (backstage runs list)
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_TASKS = 4;

interface ProgressCase {
    label: string;
    expected: string;
    setup: (page: Parameters<typeof createRun>[0], run: Run) => Promise<void>;
}

const progressCases: ProgressCase[] = [
    {
        label: '0/4 when no tasks done',
        expected: `0/${TOTAL_TASKS}`,
        setup: async () => {/* nothing to do */},
    },
    {
        label: '2/4 after closing 2 tasks',
        expected: `2/${TOTAL_TASKS}`,
        setup: async (page, run) => {
            await setChecklistItemState(page, run.id, 0, 0, 'closed');
            await setChecklistItemState(page, run.id, 0, 1, 'closed');
        },
    },
    {
        label: '3/4 after closing 2 + skipping 1 (skipped counts)',
        expected: `3/${TOTAL_TASKS}`,
        setup: async (page, run) => {
            await setChecklistItemState(page, run.id, 0, 0, 'closed');
            await setChecklistItemState(page, run.id, 0, 1, 'closed');
            await setChecklistItemState(page, run.id, 0, 2, 'skipped');
        },
    },
    {
        label: '4/4 when some closed + some skipped',
        expected: `${TOTAL_TASKS}/${TOTAL_TASKS}`,
        setup: async (page, run) => {
            await setChecklistItemState(page, run.id, 0, 0, 'closed');
            await setChecklistItemState(page, run.id, 0, 1, 'closed');
            await setChecklistItemState(page, run.id, 0, 2, 'skipped');
            await setChecklistItemState(page, run.id, 0, 3, 'skipped');
        },
    },
    {
        label: '4/4 after all tasks completed',
        expected: `${TOTAL_TASKS}/${TOTAL_TASKS}`,
        setup: async (page, run) => {
            await setChecklistItemState(page, run.id, 0, 0, 'closed');
            await setChecklistItemState(page, run.id, 0, 1, 'closed');
            await setChecklistItemState(page, run.id, 0, 2, 'closed');
            await setChecklistItemState(page, run.id, 0, 3, 'closed');
        },
    },
];

for (const c of progressCases) {
    /**
     * @objective The backstage runs list shows the correct task progress indicator.
     */
    test(`task progress: ${c.label}`, {tag: '@playbooks'}, async ({page}) => {
        const playbooksPage = new PlaybooksPage(page);

        // # Log in and create a fresh run for the progress playbook
        await loginAs(page, seededData.user.username, seededData.user.password);
        const run = await createRun(page, {
            name: `CHK Prog Run ${uniqueSuffix()}`,
            ownerUserId: seededData.user.id,
            teamId: seededData.team.id,
            playbookId: seededData.progressPlaybookId,
        });

        // # Apply the test-specific state via API
        await c.setup(page, run);

        // # Navigate to the backstage runs list
        await playbooksPage.gotoRunsList(seededData.team.name);

        // * Task progress indicator shows the expected fraction
        await playbooksPage.expectTaskProgress(run.name, c.expected);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// RDP smoke: participant can check a task + hover menu shows Skip/Duplicate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @objective On the Run Details Page, a participant can check a task (checkbox
 *            becomes checked) and the hover dot-menu shows 'Skip task' and
 *            'Duplicate task' actions.
 */
test('RDP smoke: participant checks task + hover menu has Skip/Duplicate', {tag: '@playbooks'}, async ({page}) => {
    const rdp = new RunDetailsPage(page);

    // # Log in as owner/participant and create a fresh run
    await loginAs(page, seededData.user.username, seededData.user.password);
    const run = await createRun(page, {
        name: `CHK RDP Run ${uniqueSuffix()}`,
        ownerUserId: seededData.user.id,
        teamId: seededData.team.id,
        playbookId: seededData.rdpPlaybookId,
    });

    // # Navigate to the RDP
    await rdp.goto(seededData.team.name, run.id);

    // * Checklist section is visible
    await expect(rdp.checklistSection).toBeVisible();

    // * 4 tasks are shown (2 checklists × 2 tasks)
    await rdp.expectTaskCount(4);

    // # Check the first task
    await rdp.checkTaskAtIndex(0);

    // * First task checkbox is now checked
    await rdp.expectTaskChecked(0);

    // # Open the dot-menu for the first task
    await rdp.openTaskDotMenuAtIndex(0);

    // * 'Skip task' and 'Duplicate task' actions are visible
    await rdp.expectTaskMenuItemVisible('Skip task');
    await rdp.expectTaskMenuItemVisible('Duplicate task');
});
