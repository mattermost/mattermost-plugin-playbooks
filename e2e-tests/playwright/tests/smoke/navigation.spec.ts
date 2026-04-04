// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {type SeededNavigationData, seedPlaybookNavigationData} from '../helpers/auth';
import {LoginPage} from '../pmo/login_page';
import {PlaybooksPage} from '../pmo/playbooks_page';

const specTeamPrefix = 'playbooks-navigation';

test.describe('playbooks navigation', () => {
    let seededData: SeededNavigationData;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({
            baseURL: process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065',
        });
        const page = await context.newPage();
        const loginPage = new LoginPage(page);

        await loginPage.loginAsAdmin();
        seededData = await seedPlaybookNavigationData(page, specTeamPrefix);

        await context.close();
    });

    test('opens the playbooks and runs views', async ({page}) => {
        const loginPage = new LoginPage(page);
        const playbooksPage = new PlaybooksPage(page);
        const {playbookTitle, runName, teamName} = seededData;

        await loginPage.loginAsAdmin();
        await playbooksPage.goto(teamName);
        await playbooksPage.openPlaybooksList();
        await playbooksPage.expectPlaybookVisible(playbookTitle);
        await playbooksPage.openRunsList();
        await playbooksPage.expectRunVisible(runName);
    });
});
