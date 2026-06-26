// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {loginAsAdmin} from '../helpers/auth';
import {uniqueSuffix} from '../helpers/client';
import {createPlaybook} from '../helpers/playbook';
import {createRun} from '../helpers/run';
import {createTeam} from '../helpers/team';
import {getCurrentUser} from '../helpers/user';
import {PlaybooksPage} from '../pages/playbooks_page';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

interface NavigationData {
    teamName: string;
    playbookTitle: string;
    runName: string;
}

test.describe('playbooks navigation', () => {
    let seededData: NavigationData;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);

        const currentUser = await getCurrentUser(page);
        const team = await createTeam(page, 'playbooks-navigation');
        const playbookTitle = `PW Playbook ${uniqueSuffix()}`;
        const runName = `PW Run ${uniqueSuffix()}`;
        const playbook = await createPlaybook(page, team.id, playbookTitle);
        await createRun(page, {name: runName, ownerUserId: currentUser.id, teamId: team.id, playbookId: playbook.id});

        seededData = {teamName: team.name, playbookTitle, runName};

        await context.close();
    });

    /**
     * @objective Verify the Playbooks and Runs backstage views open and list seeded content.
     *
     * @precondition
     * A playbook and a run are seeded in the test team via the API.
     */
    test('opens the playbooks and runs views', {tag: '@playbooks'}, async ({page}) => {
        const playbooksPage = new PlaybooksPage(page);
        const {playbookTitle, runName, teamName} = seededData;

        // # Log in via API and open the Playbooks product for the seeded team
        await loginAsAdmin(page);
        await playbooksPage.goto(teamName);

        // # Open the playbooks list
        await playbooksPage.openPlaybooksList();

        // * The seeded playbook is listed
        await playbooksPage.expectPlaybookVisible(playbookTitle);

        // # Open the runs list
        await playbooksPage.openRunsList();

        // * The seeded run is listed
        await playbooksPage.expectRunVisible(runName);
    });
});
