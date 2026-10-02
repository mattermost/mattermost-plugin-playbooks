// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Smoke spec for the MattermostCore page-object facade
// (tests/pages/mattermost/index.ts). Not a port of a specific Cypress spec —
// it exercises each public method of MattermostCore once to confirm the facade
// works end-to-end against the running server:
//   • channels.goto / gotoDirectMessage / postMessage / runSlashCommand
//   • postList.expectLastPostContains / expectEphemeral
//   • appBar.openPlaybooks
//   • rhs.openLastPostThread / expectThreadOpen
//   • systemConsole.gotoSiteStatistics

import {test} from '@playwright/test';

import {loginAsAdmin} from '../helpers/auth';
import {uniqueSuffix} from '../helpers/client';
import {addUserToTeam, createTeam} from '../helpers/team';
import {createUser, getCurrentUser} from '../helpers/user';
import {MattermostCore} from '../pages/mattermost';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

interface CoreSmokeData {
    teamName: string;
    adminUsername: string;
    partnerUsername: string;
}

test.describe('MattermostCore facade', () => {
    let seededData: CoreSmokeData;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);
        const admin = await getCurrentUser(page);
        const team = await createTeam(page, `mm-core-smoke-${uniqueSuffix()}`);
        const partner = await createUser(page, 'mm-core-partner');
        await addUserToTeam(page, team.id, partner.id);

        seededData = {
            teamName: team.name,
            adminUsername: admin.username,
            partnerUsername: partner.username,
        };

        await context.close();
    });

    /**
     * @objective Verify that MattermostCore.channels.goto() navigates to a
     * team channel and that gotoDirectMessage() navigates to a DM, both
     * leaving the post textbox ready.
     */
    test('navigates to a channel and a DM channel', {tag: '@playbooks'}, async ({page}) => {
        const mm = new MattermostCore(page);
        const {teamName, partnerUsername} = seededData;

        // # Log in as admin
        await loginAsAdmin(page);

        // # Navigate to town-square via MattermostCore
        await mm.channels.goto(teamName, 'town-square');

        // * The post textbox is visible (channel is ready)
        await mm.channels.postTextbox.waitFor();

        // # Navigate to the DM channel with the partner user
        await mm.channels.gotoDirectMessage(teamName, partnerUsername);

        // * The post textbox is visible in the DM channel
        await mm.channels.postTextbox.waitFor();
    });

    /**
     * @objective Verify that postMessage() sends a message visible as the last
     * post, and that runSlashCommand() with /playbook info outside a run channel
     * produces an ephemeral reply.
     */
    test('posts a message and verifies it; runs a slash command and sees ephemeral reply', {tag: '@playbooks'}, async ({page}) => {
        const mm = new MattermostCore(page);
        const {teamName} = seededData;
        const messageText = `MM Core smoke ${uniqueSuffix()}`;

        // # Log in and navigate to town-square
        await loginAsAdmin(page);
        await mm.channels.goto(teamName, 'town-square');

        // # Post a message
        await mm.channels.postMessage(messageText);

        // * The message appears as the last post
        await mm.postList.expectLastPostContains(messageText);

        // # Run /playbook info outside a run channel — produces an ephemeral message
        await mm.channels.runSlashCommand('/playbook info');

        // * An ephemeral post appears with the expected error text
        await mm.postList.expectEphemeral('This command only works when run from a playbook run channel.');
    });

    /**
     * @objective Verify that rhs.openLastPostThread() opens the thread view,
     * appBar.openPlaybooks() opens the Playbooks panel, and
     * systemConsole.gotoSiteStatistics() lands on the System Console stats page.
     */
    test('opens a thread reply, the Playbooks app bar, and System Console site statistics', {tag: '@playbooks'}, async ({page}) => {
        const mm = new MattermostCore(page);
        const {teamName} = seededData;
        const threadMessageText = `Thread smoke ${uniqueSuffix()}`;

        // # Log in and navigate to town-square
        await loginAsAdmin(page);
        await mm.channels.goto(teamName, 'town-square');

        // # Post a message to have something to reply to
        await mm.channels.postMessage(threadMessageText);

        // # Open the thread RHS by clicking Reply on the last post
        await mm.rhs.openLastPostThread();

        // * The thread reply textbox is visible (thread RHS is open)
        await mm.rhs.expectThreadOpen();

        // # Navigate back to town-square and open the Playbooks app bar panel
        await mm.channels.goto(teamName, 'town-square');
        await mm.appBar.openPlaybooks();

        // * The Playbooks panel is open (handled internally by appBar.openPlaybooks())

        // # Navigate to System Console > Site Statistics
        await mm.systemConsole.gotoSiteStatistics();

        // * We are on the Site Statistics page (heading check is inside gotoSiteStatistics)
    });
});
