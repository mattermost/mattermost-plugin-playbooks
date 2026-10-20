// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Foundations smoke test: exercises the shared helpers/page objects added for
// later Cypress-migration tasks (tests/helpers/{run,playbook,channel}.ts,
// tests/pages/{run_details_page,channel_rhs}.ts). Not a port of a specific
// Cypress spec.

import {test} from '@playwright/test';

import {loginAsAdmin} from '../helpers/auth';
import {getChannel} from '../helpers/channel';
import {uniqueSuffix} from '../helpers/client';
import {createPlaybook} from '../helpers/playbook';
import {createRun} from '../helpers/run';
import {createTeam} from '../helpers/team';
import {getCurrentUser} from '../helpers/user';
import {ChannelRhs} from '../pages/channel_rhs';
import {RunDetailsPage} from '../pages/run_details_page';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

interface RunDetailsData {
    teamName: string;
    runId: string;
    runName: string;
    channelName: string;
}

test.describe('run details foundations smoke', () => {
    let seededData: RunDetailsData;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);

        const currentUser = await getCurrentUser(page);
        const team = await createTeam(page, 'run-details-foundations');
        const playbook = await createPlaybook(page, team.id, `PW Playbook ${uniqueSuffix()}`);
        const runName = `PW Run ${uniqueSuffix()}`;
        const run = await createRun(page, {
            name: runName,
            ownerUserId: currentUser.id,
            teamId: team.id,
            playbookId: playbook.id,
        });
        const channel = await getChannel(page, run.channel_id);

        seededData = {teamName: team.name, runId: run.id, runName, channelName: channel.name};

        await context.close();
    });

    /**
     * @objective Verify the Run Details Page and the channel RHS both show a seeded run's name,
     * proving the shared helpers and page objects work end-to-end.
     *
     * @precondition
     * A playbook and a run are seeded via the API in `beforeAll`.
     */
    test('shows the run name on the RDP and in the run channel RHS', {tag: '@playbooks'}, async ({page}) => {
        const runDetailsPage = new RunDetailsPage(page);
        const channelRhs = new ChannelRhs(page);
        const {teamName, runId, runName, channelName} = seededData;

        // # Log in and open the Run Details Page for the seeded run
        await loginAsAdmin(page);
        await runDetailsPage.goto(teamName, runId);

        // * The run name is visible in the RDP header
        await runDetailsPage.expectTitle(runName);

        // # Open the run's channel; the Playbooks RHS auto-opens
        await channelRhs.gotoRunChannel(teamName, channelName);

        // * The run name is visible in the channel RHS too
        await channelRhs.expectRunTitle(runName);
    });
});
