// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Playwright port of the Cypress spec
//   e2e-tests/cypress/tests/integration/playbooks/channels/playbook_run_actions.js
// Covers all tests in that file EXCEPT "when a playbook run is finished >
// retrospective is disabled" (already covered by the retrospective task).
//
// NOTE: The source Cypress spec never executed (filename doesn't match the Cypress
// specPattern), so every behavior has been verified against the running app before
// asserting. Discrepancies from the Cypress spec are noted inline.
//
// Consolidation notes (P3):
//   • Invite-members cases {off+none, on+2, off+2} → one parametrized test body.
//   • Default-owner cases × 5 → one parametrized test body.
//   • Broadcast {enabled, disabled} → one parametrized test body; deleted-channel → separate.
//   • Creation webhook: server only logs errors, does NOT post to channel;
//     the failure-path test is kept as test.fixme. See ## Product bugs found in the quality log.

import {test, expect} from '@playwright/test';

import {loginAs, loginAsAdmin} from '../helpers/auth';
import {uniqueSuffix} from '../helpers/client';
import {createChannel, deleteChannel, type Channel} from '../helpers/channel';
import {getChannel} from '../helpers/channel';
import {createPlaybook} from '../helpers/playbook';
import {createRun} from '../helpers/run';
import {addUserToTeam, createTeam, removeUserFromTeam, type Team} from '../helpers/team';
import {createUser, type SeededUser} from '../helpers/user';
import {ChannelRhs} from '../pages/channel_rhs';
import {MattermostCore} from '../pages/mattermost';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

// ─────────────────────────────────────────────────────────────────────────────
// Shared seeded state for all tests in this spec
// ─────────────────────────────────────────────────────────────────────────────

interface SeededData {
    team: Team;
    /** User who creates and owns the runs in most tests. */
    user: SeededUser;
    /** Two extra team members used as invite targets. */
    extraUsers: [SeededUser, SeededUser];
    /** A public channel used as the broadcast target. */
    broadcastChannel: Channel;
}

let seededData: SeededData;

test.beforeAll(async ({browser}) => {
    const context = await browser.newContext({baseURL});
    const page = await context.newPage();

    await loginAsAdmin(page);

    const team = await createTeam(page, 'run-start-actions');
    const user = await createUser(page, 'rsa-creator');
    await addUserToTeam(page, team.id, user.id);

    const extra0 = await createUser(page, 'rsa-extra0');
    const extra1 = await createUser(page, 'rsa-extra1');
    await addUserToTeam(page, team.id, extra0.id);
    await addUserToTeam(page, team.id, extra1.id);

    // A public channel used as the broadcast target in broadcast tests.
    // The creator user is added so they can navigate to it.
    await loginAs(page, user.username, user.password);
    const broadcastChannel = await createChannel(page, team.id, {
        displayName: `RSA Broadcast ${uniqueSuffix()}`,
    });

    seededData = {
        team,
        user,
        extraUsers: [extra0, extra1],
        broadcastChannel,
    };

    await context.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: navigate to a run channel (by channel_id → name) and wait for the RHS
// ─────────────────────────────────────────────────────────────────────────────

async function gotoRunChannel(
    page: Parameters<typeof getChannel>[0],
    rhs: ChannelRhs,
    teamName: string,
    channelId: string,
): Promise<void> {
    const ch = await getChannel(page, channelId);
    await rhs.gotoRunChannel(teamName, ch.name);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Invite members
// ─────────────────────────────────────────────────────────────────────────────

test.describe('run start actions — invite members', () => {
    type InviteCase = {
        label: string;
        inviteUsersEnabled: boolean;
        invitedUserIds: 'none' | 'two';
        expectInvited: boolean;
    };

    const cases: InviteCase[] = [
        {
            label: 'off + no invited users',
            inviteUsersEnabled: false,
            invitedUserIds: 'none',
            expectInvited: false,
        },
        {
            label: 'on + 2 invited users',
            inviteUsersEnabled: true,
            invitedUserIds: 'two',
            expectInvited: true,
        },
        {
            label: 'off + 2 invited users (setting disabled)',
            inviteUsersEnabled: false,
            invitedUserIds: 'two',
            expectInvited: false,
        },
    ];

    for (const c of cases) {
        /**
         * @objective Verify that the invite-members setting controls who appears
         * in the run channel when a run starts.
         *
         * Actual app behavior (verified against running app):
         *   • The invite feature adds the specified users as run participants.
         *   • With create_channel_member_on_new_participant=true (createPlaybook default),
         *     participants are also added as channel members and post "joined the channel".
         *   • When the setting is disabled, no extra users are added.
         *
         * Note: The dormant Cypress spec expected "added to the channel by @playbooks"
         * for invited users. The actual app posts "joined the channel" instead.
         * This is not a product bug — the invite mechanism adds participants, and
         * create_channel_member_on_new_participant triggers the channel-join event.
         */
        test(`invite members: ${c.label}`, {tag: '@playbooks'}, async ({page}) => {
            const rhs = new ChannelRhs(page);
            const mm = new MattermostCore(page);
            const {team, user, extraUsers} = seededData;

            // # Log in as the creator user
            await loginAs(page, user.username, user.password);

            // # Create a playbook with the given invite settings
            const invitedIds = c.invitedUserIds === 'two'
                ? [extraUsers[0].id, extraUsers[1].id]
                : [];

            const pb = await createPlaybook(page, team.id, `RSA Invite ${uniqueSuffix()}`, {
                createPublicPlaybookRun: true,
                inviteUsersEnabled: c.inviteUsersEnabled,
                invitedUserIds: invitedIds,
            });

            // # Start a run via API
            const run = await createRun(page, {
                name: `RSA Invite Run ${uniqueSuffix()}`,
                ownerUserId: user.id,
                teamId: team.id,
                playbookId: pb.id,
            });

            // # Navigate to the run channel
            await gotoRunChannel(page, rhs, team.name, run.channel_id);

            if (c.expectInvited) {
                // * The channel has posts mentioning both invited users
                // (system messages show them as "@username joined the channel" or
                // "@user0 and @user1 joined the channel" — the exact wording depends
                // on Mattermost's message-grouping logic)
                await mm.postList.expectAnyPostContains(extraUsers[0].username);
                await mm.postList.expectAnyPostContains(extraUsers[1].username);
            } else {
                // * Neither invited user appears in the channel posts
                await mm.postList.expectNoPostContains(extraUsers[0].username);
                await mm.postList.expectNoPostContains(extraUsers[1].username);
            }
            // Note: The creator's add-to-channel system message shows as
            // "You were added to the channel by @playbooks" (not the username),
            // so we do not assert on the creator's username in the post list.
        });
    }

    /**
     * @objective When an invited user has been removed from the team before the
     * run starts, the playbooks bot posts a failure notice listing that user.
     *
     * @precondition The invited user is added to the team, the playbook is
     * configured with them as invited, and they are removed from the team
     * before the run is created.
     */
    test('invite members: non-existent user → bot posts failure notice', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);
        const mm = new MattermostCore(page);
        const {team, user} = seededData;

        // # Log in as admin to create/remove the removable user
        await loginAsAdmin(page);

        // # Create a user, add them to the team, and configure the playbook
        const removableUser = await createUser(page, 'rsa-removable');
        await addUserToTeam(page, team.id, removableUser.id);

        const pb = await createPlaybook(page, team.id, `RSA Nonexistent ${uniqueSuffix()}`, {
            createPublicPlaybookRun: true,
            inviteUsersEnabled: true,
            invitedUserIds: [removableUser.id],
        });

        // # Remove the user from the team before starting the run
        await removeUserFromTeam(page, team.id, removableUser.id);

        // # Log in as the creator user and start the run
        await loginAs(page, user.username, user.password);

        const run = await createRun(page, {
            name: `RSA Nonexistent Run ${uniqueSuffix()}`,
            ownerUserId: user.id,
            teamId: team.id,
            playbookId: pb.id,
        });

        // # Navigate to the run channel
        await gotoRunChannel(page, rhs, team.name, run.channel_id);

        // * The playbooks bot posts a failure notice naming the removed user
        await mm.postList.expectAnyPostContains(
            `Failed to invite the following users: @${removableUser.username}`,
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Default owner
// ─────────────────────────────────────────────────────────────────────────────

test.describe('run start actions — default owner', () => {
    type OwnerCase = {
        label: string;
        defaultOwnerEnabled: boolean;
        defaultOwnerIdSlot: 'none' | 'extra0' | 'creator';
        inviteExtra0: boolean;
        expectedOwnerSlot: 'creator' | 'extra0';
    };

    const cases: OwnerCase[] = [
        {
            label: 'setting off, no owner set → creator is owner',
            defaultOwnerEnabled: false,
            defaultOwnerIdSlot: 'none',
            inviteExtra0: false,
            expectedOwnerSlot: 'creator',
        },
        {
            label: 'setting on, no owner set → creator is owner',
            defaultOwnerEnabled: true,
            defaultOwnerIdSlot: 'none',
            inviteExtra0: false,
            expectedOwnerSlot: 'creator',
        },
        {
            label: 'setting on, invited owner → owner is the invited user',
            defaultOwnerEnabled: true,
            defaultOwnerIdSlot: 'extra0',
            inviteExtra0: true,
            expectedOwnerSlot: 'extra0',
        },
        {
            label: 'setting on, uninvited owner → owner is the configured user',
            defaultOwnerEnabled: true,
            defaultOwnerIdSlot: 'extra0',
            inviteExtra0: false,
            expectedOwnerSlot: 'extra0',
        },
        {
            label: 'setting on, owner = creator → creator is owner',
            defaultOwnerEnabled: true,
            defaultOwnerIdSlot: 'creator',
            inviteExtra0: false,
            expectedOwnerSlot: 'creator',
        },
    ];

    for (const c of cases) {
        /**
         * @objective Verify that the default-owner setting controls who appears
         * as run owner in the RHS when a run starts.
         */
        test(`default owner: ${c.label}`, {tag: '@playbooks'}, async ({page}) => {
            const rhs = new ChannelRhs(page);
            const {team, user, extraUsers} = seededData;

            // # Log in as the creator user
            await loginAs(page, user.username, user.password);

            const defaultOwnerId =
                c.defaultOwnerIdSlot === 'extra0' ? extraUsers[0].id
                    : c.defaultOwnerIdSlot === 'creator' ? user.id
                        : '';

            const pb = await createPlaybook(page, team.id, `RSA Owner ${uniqueSuffix()}`, {
                createPublicPlaybookRun: true,
                defaultOwnerEnabled: c.defaultOwnerEnabled,
                defaultOwnerId,
                inviteUsersEnabled: c.inviteExtra0,
                invitedUserIds: c.inviteExtra0 ? [extraUsers[0].id] : [],
            });

            // # Start a run via API
            const run = await createRun(page, {
                name: `RSA Owner Run ${uniqueSuffix()}`,
                ownerUserId: user.id,
                teamId: team.id,
                playbookId: pb.id,
            });

            // # Navigate to the run channel; the Playbooks RHS auto-opens
            await gotoRunChannel(page, rhs, team.name, run.channel_id);

            const expectedUsername =
                c.expectedOwnerSlot === 'creator' ? user.username : extraUsers[0].username;

            // * The RHS About section shows the expected owner's username
            await rhs.expectOwner(expectedUsername);
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Broadcast on run start
// ─────────────────────────────────────────────────────────────────────────────

test.describe('run start actions — broadcast channel', () => {
    type BroadcastCase = {
        label: string;
        broadcastEnabled: boolean;
        expectAnnouncement: boolean;
    };

    const cases: BroadcastCase[] = [
        {label: 'enabled', broadcastEnabled: true, expectAnnouncement: true},
        {label: 'disabled', broadcastEnabled: false, expectAnnouncement: false},
    ];

    for (const c of cases) {
        /**
         * @objective When broadcast is enabled, starting a run posts an announcement
         * in the configured broadcast channel. When disabled, no announcement appears.
         */
        test(`broadcast on start: ${c.label}`, {tag: '@playbooks'}, async ({page}) => {
            const rhs = new ChannelRhs(page);
            const mm = new MattermostCore(page);
            const {team, user, broadcastChannel} = seededData;

            // # Log in as the creator user
            await loginAs(page, user.username, user.password);

            const playbookTitle = `RSA Broadcast ${uniqueSuffix()}`;
            const pb = await createPlaybook(page, team.id, playbookTitle, {
                createPublicPlaybookRun: true,
                broadcastEnabled: c.broadcastEnabled,
                broadcastChannelIds: [broadcastChannel.id],
            });

            const runName = `RSA Broadcast Run ${uniqueSuffix()}`;
            const run = await createRun(page, {
                name: runName,
                ownerUserId: user.id,
                teamId: team.id,
                playbookId: pb.id,
            });

            // # Navigate to the run channel to verify the run started
            await gotoRunChannel(page, rhs, team.name, run.channel_id);

            // # Navigate to the broadcast channel and check for the announcement
            await mm.channels.goto(team.name, broadcastChannel.name);

            if (c.expectAnnouncement) {
                // * The broadcast channel has an announcement mentioning the run name
                await mm.postList.expectLastPostContains(runName);
                // * The announcement mentions the creator and playbook
                await mm.postList.expectLastPostContains(`@${user.username} ran the`);
                await mm.postList.expectLastPostContains(`${playbookTitle} playbook`);
            } else {
                // * No announcement appears in the broadcast channel
                await mm.postList.expectNoPostContains(runName);
            }
        });
    }

    /**
     * @objective When the configured broadcast channel has been deleted before
     * the run starts, the playbooks bot posts a failure notice in the run channel.
     */
    test('broadcast on start: deleted channel → bot posts failure notice', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);
        const mm = new MattermostCore(page);
        const {team, user} = seededData;

        // # Log in as creator user
        await loginAs(page, user.username, user.password);

        // # Create a temporary channel to use as the broadcast target
        const tmpChannel = await createChannel(page, team.id, {
            displayName: `RSA Tmp Broadcast ${uniqueSuffix()}`,
        });

        const pb = await createPlaybook(page, team.id, `RSA Deleted Bcast ${uniqueSuffix()}`, {
            createPublicPlaybookRun: true,
            broadcastEnabled: true,
            broadcastChannelIds: [tmpChannel.id],
        });

        // # Delete the broadcast channel before starting the run
        await deleteChannel(page, tmpChannel.id);

        // # Start the run
        const run = await createRun(page, {
            name: `RSA Deleted Bcast Run ${uniqueSuffix()}`,
            ownerUserId: user.id,
            teamId: team.id,
            playbookId: pb.id,
        });

        // # Navigate to the run channel
        await gotoRunChannel(page, rhs, team.name, run.channel_id);

        // * The playbooks bot posts a failure notice about the broadcast
        await mm.postList.expectAnyPostContains(
            'Failed to broadcast run creation to the configured channel.',
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Creation webhook
// ─────────────────────────────────────────────────────────────────────────────

test.describe('run start actions — creation webhook', () => {
    /**
     * @objective When the creation webhook URL is unreachable, the playbooks bot
     * should post a failure notice in the run channel.
     *
     * PRODUCT BUG: The server's triggerWebhooks() function sends webhook requests
     * asynchronously in a goroutine and only logs errors — it never posts a failure
     * message to the run channel. The Cypress spec's expected message
     * "Playbook run creation announcement through the outgoing webhook failed."
     * is never posted by the current implementation.
     * See: server/app/playbook_run_service.go triggerWebhooks().
     * The success-path assertion (no error post) is omitted because it is trivially
     * true — the server never posts such a message regardless of webhook outcome.
     */
    test.fixme('creation webhook: unreachable URL → bot posts failure notice in run channel', {tag: '@playbooks'}, async ({page}) => {
        const rhs = new ChannelRhs(page);
        const mm = new MattermostCore(page);
        const {team, user} = seededData;

        // # Log in as the creator user
        await loginAs(page, user.username, user.password);

        // # Use an unreachable URL (connection refused on loopback)
        const pb = await createPlaybook(page, team.id, `RSA Webhook ${uniqueSuffix()}`, {
            createPublicPlaybookRun: true,
            webhookOnCreationEnabled: true,
            webhookOnCreationUrls: ['http://127.0.0.1:9/'],
        });

        const run = await createRun(page, {
            name: `RSA Webhook Run ${uniqueSuffix()}`,
            ownerUserId: user.id,
            teamId: team.id,
            playbookId: pb.id,
        });

        // # Navigate to the run channel
        await gotoRunChannel(page, rhs, team.name, run.channel_id);

        // * The bot posts a failure notice (FIXME: this message is never posted)
        await expect(mm.postList.allPostMessages()).toContainText(
            'Playbook run creation announcement through the outgoing webhook failed.',
        );
    });
});
