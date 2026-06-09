// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {type SeededNavigationData, loginAsAdmin, seedPlaybookNavigationData} from '../helpers/auth';
import {PlaybooksPage} from '../pages/playbooks_page';

const specTeamPrefix = 'playbooks-navigation';

test.describe('playbooks navigation', () => {
    let seededData: SeededNavigationData;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({
            baseURL: process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065',
        });
        const page = await context.newPage();

        await loginAsAdmin(page);
        seededData = await seedPlaybookNavigationData(page, specTeamPrefix);

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
