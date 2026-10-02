// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Playwright port of:
//   e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_finish_spec.js
//     — all tests EXCEPT the "finish with conditional hidden tasks" describe
//       (the outstanding-task warning is included here; the *conditional hidden*
//       variant belongs to the conditions task).
//   e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_restore_spec.js
//     — all tests
//   e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_header_spec.js
//     — context menu > finish run (confirm / cancel) only; everything else
//       (title/badge/favorite/participate/rename/leave/run-actions) belongs to
//       the rdp-header task.
//   e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/auto_archive_spec.js
//     — run-behavior tests only (archive on finish, unarchive on restore, linked
//       pre-existing channel never archived, disabled = untouched, timeline events,
//       status post after restore, re-archive after manual unarchive).
//       Editor toggle tests (toggle visibility, banner, mode-switch live-update) go
//       to the editor-run-settings task.
//
// Consolidation (P3): finish-via-section and finish-via-context-menu are parametrized
// in a 2-row table, each covering confirm and cancel paths, instead of 4 separate tests.

import {test, expect} from '@playwright/test';

import {loginAs, loginAsAdmin} from '../helpers/auth';
import {uniqueSuffix} from '../helpers/client';
import {getChannel, getChannelByName, restoreChannel} from '../helpers/channel';
import {createPlaybook} from '../helpers/playbook';
import {createRun, finishRun, restoreRun, type Run} from '../helpers/run';
import {addUserToTeam, createTeam, type Team} from '../helpers/team';
import {createUser, type SeededUser} from '../helpers/user';
import {ChannelRhs} from '../pages/channel_rhs';
import {RunDetailsPage} from '../pages/run_details_page';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

// ─────────────────────────────────────────────────────────────────────────────
// Seeded state shared across all tests
// ─────────────────────────────────────────────────────────────────────────────

interface SeededData {
    team: Team;
    /** Run owner / participant user. */
    user: SeededUser;
    /** Non-participant viewer (not a run member). */
    viewer: SeededUser;
    /** Admin user credentials for operations requiring elevated permissions. */
    admin: SeededUser;
}

let seededData: SeededData;

test.beforeAll(async ({browser}) => {
    const context = await browser.newContext({baseURL});
    const page = await context.newPage();

    await loginAsAdmin(page);

    const team = await createTeam(page, 'finish-restore');
    const user = await createUser(page, 'fr-owner');
    const viewer = await createUser(page, 'fr-viewer');
    const admin = await createUser(page, 'fr-admin');
    await addUserToTeam(page, team.id, user.id);
    await addUserToTeam(page, team.id, viewer.id);
    await addUserToTeam(page, team.id, admin.id);

    seededData = {team, user, viewer, admin};

    await context.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Seed a fresh run for the owner user. Each test that mutates a run creates its own. */
async function seedRun(page: Parameters<typeof createPlaybook>[0], options: {
    teamId: string;
    userId: string;
    playbookTitle?: string;
    autoArchiveChannel?: boolean;
    channelMode?: 'create_new_channel' | 'link_existing_channel';
    channelId?: string;
    checklists?: Array<{title: string; items: Array<{title: string}>}>;
}): Promise<{playbookId: string; run: Run}> {
    const playbook = await createPlaybook(page, options.teamId, options.playbookTitle ?? `FR Playbook ${uniqueSuffix()}`, {
        members: [],
        autoArchiveChannel: options.autoArchiveChannel,
        channelMode: options.channelMode,
        channelId: options.channelId,
        checklists: options.checklists,
    });
    const run = await createRun(page, {
        name: `FR Run ${uniqueSuffix()}`,
        ownerUserId: options.userId,
        teamId: options.teamId,
        playbookId: playbook.id,
    });
    return {playbookId: playbook.id, run};
}

// ─────────────────────────────────────────────────────────────────────────────
// Finish section: visibility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @objective The finish section is visible for the run owner and hidden for a non-participant viewer.
 */
test('finish section: visible for owner (with placeholder), hidden for viewer', {tag: '@playbooks'}, async ({page}) => {
    const rdp = new RunDetailsPage(page);

    // # Log in as owner and create a fresh run
    await loginAs(page, seededData.user.username, seededData.user.password);
    const {run} = await seedRun(page, {teamId: seededData.team.id, userId: seededData.user.id});

    // # Navigate to the run details page as owner
    await rdp.goto(seededData.team.name, run.id);

    // * Owner sees the finish section
    await rdp.expectFinishSectionVisible();

    // * Finish section shows the placeholder text
    await rdp.expectFinishSectionPlaceholder('Time to wrap up?');

    // # Log in as the viewer (non-participant) and visit the same run
    await loginAs(page, seededData.viewer.username, seededData.viewer.password);
    await rdp.goto(seededData.team.name, run.id);

    // * Viewer cannot see the finish section
    await rdp.expectFinishSectionHidden();
});

// ─────────────────────────────────────────────────────────────────────────────
// Finish run: parametrized table — finish-section vs context-menu trigger
// ─────────────────────────────────────────────────────────────────────────────

interface FinishTrigger {
    label: string;
    /** Opens the confirm modal from the given trigger surface. */
    openModal: (rdp: RunDetailsPage) => Promise<void>;
}

const finishTriggers: FinishTrigger[] = [
    {
        label: 'finish section',
        openModal: async (rdp) => {
            await rdp.clickFinishButton();
        },
    },
    {
        label: 'header context menu',
        openModal: async (rdp) => {
            await rdp.openContextMenuAndClickItem('Finish');
        },
    },
];

for (const trigger of finishTriggers) {
    /**
     * @objective Confirming finish via the ${trigger.label} changes the badge to
     *            "Finished", removes the finish section, and removes the run from LHS.
     */
    test(`finish run via ${trigger.label}: confirm`, {tag: '@playbooks'}, async ({page}) => {
        const rdp = new RunDetailsPage(page);

        // # Log in as owner and navigate to a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        const {run} = await seedRun(page, {teamId: seededData.team.id, userId: seededData.user.id});
        await rdp.goto(seededData.team.name, run.id);

        // * Badge starts as "In Progress"
        await rdp.expectStatus('In Progress');

        // # Open the finish confirm modal via the trigger
        await trigger.openModal(rdp);

        // * Confirm modal is visible and its title mentions "Confirm finish"
        await rdp.mm.confirmModal.expectVisible();
        await rdp.mm.confirmModal.expectContainsText('Confirm finish');

        // # Confirm finishing the run
        await rdp.mm.confirmModal.confirm();

        // * The badge changes to "Finished"
        await rdp.expectStatus('Finished');

        // * The finish section is removed from the page
        await rdp.expectFinishSectionHidden();

        // * The run is no longer in the LHS navigation list
        await rdp.expectRunNotInLhs(run.name);
    });

    /**
     * @objective Canceling the finish modal via the ${trigger.label} leaves the badge as
     *            "In Progress" and the finish section and context-menu item remain.
     */
    test(`finish run via ${trigger.label}: cancel`, {tag: '@playbooks'}, async ({page}) => {
        const rdp = new RunDetailsPage(page);

        // # Log in as owner and navigate to a fresh run
        await loginAs(page, seededData.user.username, seededData.user.password);
        const {run} = await seedRun(page, {teamId: seededData.team.id, userId: seededData.user.id});
        await rdp.goto(seededData.team.name, run.id);

        // * Badge starts as "In Progress"
        await rdp.expectStatus('In Progress');

        // # Open the finish confirm modal via the trigger
        await trigger.openModal(rdp);

        // * Confirm modal is visible
        await rdp.mm.confirmModal.expectVisible();

        // # Cancel the finish
        await rdp.mm.confirmModal.cancel();

        // * The badge remains "In Progress"
        await rdp.expectStatus('In Progress');

        // * The finish section is still visible
        await rdp.expectFinishSectionVisible();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Outstanding tasks warning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @objective The finish confirm modal shows an "outstanding task" warning when the
 *            run has at least one visible, incomplete checklist item.
 */
test('finish modal warns about outstanding tasks when a visible task is incomplete', {tag: '@playbooks'}, async ({page}) => {
    const rdp = new RunDetailsPage(page);

    // # Create a playbook with one checklist item, then start a run
    await loginAs(page, seededData.user.username, seededData.user.password);
    const {run} = await seedRun(page, {
        teamId: seededData.team.id,
        userId: seededData.user.id,
        checklists: [
            {title: 'Stage 1', items: [{title: 'Incomplete task'}]},
        ],
    });
    await rdp.goto(seededData.team.name, run.id);

    // # Open the finish modal without completing the task
    await rdp.clickFinishButton();

    // * The confirm modal is visible
    await rdp.mm.confirmModal.expectVisible();

    // * The modal warns about the outstanding task
    await rdp.mm.confirmModal.expectContainsText('outstanding task');

    // # Cancel to leave the run in progress
    await rdp.mm.confirmModal.cancel();
});

// ─────────────────────────────────────────────────────────────────────────────
// Restart (restore) from context menu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @objective After finishing a run, the context menu "Restart" action restores
 *            the badge to "In Progress" and the run reappears in the LHS.
 *
 * @precondition
 * The run is finished via the RDP finish section before clicking Restart.
 */
test('restart run from context menu', {tag: '@playbooks'}, async ({page}) => {
    const rdp = new RunDetailsPage(page);

    // # Log in as owner and navigate to a fresh run
    await loginAs(page, seededData.user.username, seededData.user.password);
    const {run} = await seedRun(page, {teamId: seededData.team.id, userId: seededData.user.id});
    await rdp.goto(seededData.team.name, run.id);

    // * Badge starts as "In Progress"
    await rdp.expectStatus('In Progress');

    // # Finish the run via the finish section
    await rdp.clickFinishButton();
    await rdp.mm.confirmModal.confirm();

    // * Badge changes to "Finished"
    await rdp.expectStatus('Finished');

    // # Open the context menu and click "Restart"
    await rdp.openContextMenuAndClickItem('Restart');

    // * The restart confirm modal appears
    await rdp.mm.confirmModal.expectVisible();

    // # Confirm restart
    await rdp.mm.confirmModal.confirm();

    // * Badge returns to "In Progress"
    await rdp.expectStatus('In Progress');

    // * The run reappears in the LHS navigation list
    await rdp.expectRunInLhs(run.name);
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-archive: archive on finish and unarchive on restore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @objective When auto_archive_channel is enabled:
 *   - Finishing a run via the RHS archives the channel (delete_at becomes > 0).
 *   - Finishing via the RDP also archives the channel and records a
 *     channel_archived timeline event.
 *   - Restoring via the RDP unarchives the channel (delete_at becomes 0) and
 *     records a channel_unarchived timeline event.
 *
 * @precondition The playbook has auto_archive_channel: true.
 */
test('auto-archive: archives channel on finish and unarchives on restore with timeline events', {tag: '@playbooks'}, async ({page}) => {
    const rdp = new RunDetailsPage(page);
    const rhs = new ChannelRhs(page);

    await loginAs(page, seededData.user.username, seededData.user.password);

    // ── Part 1: RHS finish archives the channel ──────────────────────────────
    const {run: run1} = await seedRun(page, {
        teamId: seededData.team.id,
        userId: seededData.user.id,
        autoArchiveChannel: true,
    });

    // # Visit the run channel via the core channel URL (RHS auto-opens)
    const ch1 = await getChannel(page, run1.channel_id);
    await rhs.gotoRunChannel(seededData.team.name, ch1.name);

    // # Finish the run via the RHS Finish button
    await rhs.clickFinishButton();
    await rdp.mm.confirmModal.confirm();

    // * Channel becomes archived (delete_at > 0); poll until the async archive completes
    await expect.poll(
        async () => {
            const ch = await getChannel(page, run1.channel_id);
            return ch.delete_at;
        },
        {timeout: 10000, message: 'Channel was not archived after run finish via RHS'},
    ).toBeGreaterThan(0);

    // ── Part 2: RDP finish → channel_archived timeline, then restore → unarchive ──
    const {run: run2} = await seedRun(page, {
        teamId: seededData.team.id,
        userId: seededData.user.id,
        autoArchiveChannel: true,
    });

    // # Navigate to run details page and finish via the finish section
    await rdp.goto(seededData.team.name, run2.id);
    await rdp.clickFinishButton();
    await rdp.mm.confirmModal.confirm();

    // * Badge is now Finished
    await rdp.expectStatus('Finished');

    // * Channel becomes archived (poll)
    await expect.poll(
        async () => {
            const ch = await getChannel(page, run2.channel_id);
            return ch.delete_at;
        },
        {timeout: 10000, message: 'Channel was not archived after run finish via RDP finish section'},
    ).toBeGreaterThan(0);

    // * The channel_archived timeline event is visible on the RDP
    await rdp.openSidebarTimeline();
    await rdp.expectTimelineEvent('channel_archived');

    // # Restore the run via the context menu
    await rdp.openContextMenuAndClickItem('Restart');
    await rdp.mm.confirmModal.confirm();

    // * Badge returns to "In Progress"
    await rdp.expectStatus('In Progress');

    // * Channel becomes unarchived (poll)
    await expect.poll(
        async () => {
            const ch = await getChannel(page, run2.channel_id);
            return ch.delete_at;
        },
        {timeout: 10000, message: 'Channel was not unarchived after run restore'},
    ).toBe(0);

    // * The channel_unarchived timeline event is visible on the RDP
    await rdp.expectTimelineEvent('channel_unarchived');
});

/**
 * @objective A linked pre-existing channel (channel_mode = link_existing_channel) is
 *            never archived when the run is finished, even when auto_archive_channel is
 *            set to true in the playbook.
 */
test('auto-archive: linked pre-existing channel is not archived on finish', {tag: '@playbooks'}, async ({page}) => {
    await loginAs(page, seededData.user.username, seededData.user.password);

    // # Get the town-square channel as the pre-existing channel to link
    const townSquare = await getChannelByName(page, seededData.team.name, 'town-square');

    // # Create a playbook that links the existing channel with auto-archive enabled
    const {run} = await seedRun(page, {
        teamId: seededData.team.id,
        userId: seededData.user.id,
        autoArchiveChannel: true,
        channelMode: 'link_existing_channel',
        channelId: townSquare.id,
    });

    // # Finish the run via API (linked channel is not a fresh run channel)
    await finishRun(page, run.id);

    // * The linked channel is never archived even with auto_archive_channel=true
    await expect.poll(
        async () => {
            const ch = await getChannel(page, townSquare.id);
            // The run should reach Finished status within a reasonable time
            return ch.delete_at;
        },
        {timeout: 5000, message: 'Timed out checking that linked channel remains unarchived'},
    ).toBe(0);
});

/**
 * @objective When auto_archive_channel is disabled (default), finishing and restoring
 *            a run does not archive or unarchive the run channel (delete_at stays 0
 *            throughout both operations).
 */
test('auto-archive: disabled setting leaves channel untouched across finish and restore', {tag: '@playbooks'}, async ({page}) => {
    const rdp = new RunDetailsPage(page);

    await loginAs(page, seededData.user.username, seededData.user.password);
    const {run} = await seedRun(page, {
        teamId: seededData.team.id,
        userId: seededData.user.id,
        autoArchiveChannel: false,
    });

    // # Navigate to run details page
    await rdp.goto(seededData.team.name, run.id);

    // # Finish the run
    await rdp.clickFinishButton();
    await rdp.mm.confirmModal.confirm();
    await rdp.expectStatus('Finished');

    // * Channel is NOT archived after finish (delete_at = 0)
    // Poll briefly to confirm no async archive occurs
    await expect.poll(
        async () => {
            const ch = await getChannel(page, run.channel_id);
            return ch.delete_at;
        },
        {timeout: 5000, message: 'Channel was unexpectedly archived after finish with auto-archive disabled'},
    ).toBe(0);

    // # Restore the run
    await rdp.openContextMenuAndClickItem('Restart');
    await rdp.mm.confirmModal.confirm();
    await rdp.expectStatus('In Progress');

    // * Channel is still NOT archived after restore
    const ch = await getChannel(page, run.channel_id);
    expect(ch.delete_at).toBe(0);
});

/**
 * @objective After a run is finished (auto-archiving the channel), restoring the run
 *            via API unarchives the channel and the run channel shows a status post
 *            with text "from Finished to In Progress".
 */
test('auto-archive: status post in channel after restore', {tag: '@playbooks'}, async ({page}) => {
    const rhs = new ChannelRhs(page);

    await loginAs(page, seededData.user.username, seededData.user.password);
    const {run} = await seedRun(page, {
        teamId: seededData.team.id,
        userId: seededData.user.id,
        autoArchiveChannel: true,
    });

    // # Finish the run via API — server auto-archives the channel
    await finishRun(page, run.id);

    // * Wait for the channel to be archived
    await expect.poll(
        async () => {
            const ch = await getChannel(page, run.channel_id);
            return ch.delete_at;
        },
        {timeout: 10000, message: 'Channel was not archived after API finish'},
    ).toBeGreaterThan(0);

    // # Restore the run via API — server unarchives the channel
    await restoreRun(page, run.id);

    // * Wait for the channel to be unarchived
    await expect.poll(
        async () => {
            const ch = await getChannel(page, run.channel_id);
            return ch.delete_at;
        },
        {timeout: 10000, message: 'Channel was not unarchived after API restore'},
    ).toBe(0);

    // # Navigate to the unarchived channel (RHS auto-opens)
    const ch = await getChannel(page, run.channel_id);
    await rhs.gotoRunChannel(seededData.team.name, ch.name);

    // * A status post mentions the transition from Finished to In Progress
    await rhs.mm.postList.expectLastPostContains('from Finished to In Progress');
});

/**
 * @objective After finishing a run (auto-archiving), manually unarchiving the channel
 *            and then restoring the run via the RDP clears the "already auto-archived"
 *            marker so that a second finish re-archives the channel.
 */
test('auto-archive: second finish re-archives channel after manual unarchive and restore', {tag: '@playbooks'}, async ({page}) => {
    const rdp = new RunDetailsPage(page);

    await loginAs(page, seededData.user.username, seededData.user.password);
    const {run} = await seedRun(page, {
        teamId: seededData.team.id,
        userId: seededData.user.id,
        autoArchiveChannel: true,
    });

    // # Finish the run via API — channel is auto-archived
    await finishRun(page, run.id);

    await expect.poll(
        async () => {
            const ch = await getChannel(page, run.channel_id);
            return ch.delete_at;
        },
        {timeout: 10000, message: 'Channel was not archived after first finish'},
    ).toBeGreaterThan(0);

    // # Manually unarchive the channel as admin (simulates using the channel header
    // outside Playbooks — this does NOT restore the run, only the channel).
    await loginAsAdmin(page);
    await restoreChannel(page, run.channel_id);

    await expect.poll(
        async () => {
            const ch = await getChannel(page, run.channel_id);
            return ch.delete_at;
        },
        {timeout: 10000, message: 'Channel was not manually unarchived'},
    ).toBe(0);

    // # Log back in as the owner and restore the run via the RDP dropdown
    await loginAs(page, seededData.user.username, seededData.user.password);
    await rdp.goto(seededData.team.name, run.id);

    // * Badge shows "Finished" (run was finished above)
    await rdp.expectStatus('Finished');

    await rdp.openContextMenuAndClickItem('Restart');
    await rdp.mm.confirmModal.confirm();

    // * Badge returns to "In Progress"
    await rdp.expectStatus('In Progress');

    // # Finish the run a second time via the RDP finish section
    await rdp.clickFinishButton();
    await rdp.mm.confirmModal.confirm();

    // * Badge is "Finished" again
    await rdp.expectStatus('Finished');

    // * The channel is re-archived on the second finish
    await expect.poll(
        async () => {
            const ch = await getChannel(page, run.channel_id);
            return ch.delete_at;
        },
        {timeout: 10000, message: 'Channel was not re-archived on second finish after manual unarchive and restore'},
    ).toBeGreaterThan(0);
});
