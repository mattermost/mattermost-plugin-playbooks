// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@playwright/test';

import {
    type SeededBulkEditTeamData,
    seedBulkEditTeamData,
    seedPlaybookOutlineBulkEditData,
} from '../helpers/auth';
import {LoginPage} from '../pmo/login_page';
import {MultiSelectActionBar} from '../pmo/multi_select_action_bar';
import {PlaybookOutlinePage} from '../pmo/playbook_outline_page';

const specTeamPrefix = 'playbook-outline-bulk-edit';

test.describe('playbook outline bulk edit', () => {
    let seededTeam: SeededBulkEditTeamData;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({
            baseURL: process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065',
        });
        const page = await context.newPage();
        const loginPage = new LoginPage(page);

        await loginPage.loginAsAdmin();
        seededTeam = await seedBulkEditTeamData(page, specTeamPrefix);

        await context.close();
    });

    test('selects tasks, clears selection, and exits bulk edit', async ({page}) => {
        const loginPage = new LoginPage(page);
        const outlinePage = new PlaybookOutlinePage(page);
        const actionBar = new MultiSelectActionBar(page);

        await loginPage.loginAsAdmin();
        const playbook = await seedPlaybookOutlineBulkEditData(page, seededTeam, 'selection-clear');

        await outlinePage.goto(playbook.teamName, playbook.playbookId);
        await outlinePage.expectBulkEditVisible();

        await outlinePage.openBulkEdit();
        await outlinePage.expectTaskSelectionCheckboxVisible(playbook.taskTitles.clearSelectionA);
        await outlinePage.selectTaskByTitle(playbook.taskTitles.clearSelectionA);
        await outlinePage.selectTaskByTitle(playbook.taskTitles.clearSelectionB);
        await actionBar.expectVisible();
        await actionBar.expectSelectedCount(2);

        await actionBar.clearSelection();
        await actionBar.expectHidden();
        await outlinePage.expectBulkEditVisible();

        await outlinePage.openBulkEdit();
        await outlinePage.expectTaskSelectionCheckboxVisible(playbook.taskTitles.clearSelectionA);
        await outlinePage.exitBulkEdit();
        await actionBar.expectHidden();
        await outlinePage.expectBulkEditVisible();
    });

    test('bulk deletes selected tasks', async ({page}) => {
        const loginPage = new LoginPage(page);
        const outlinePage = new PlaybookOutlinePage(page);
        const actionBar = new MultiSelectActionBar(page);

        await loginPage.loginAsAdmin();
        const playbook = await seedPlaybookOutlineBulkEditData(page, seededTeam, 'delete');

        await outlinePage.goto(playbook.teamName, playbook.playbookId);
        await outlinePage.openBulkEdit();
        await outlinePage.selectTaskByTitle(playbook.taskTitles.deleteA);
        await outlinePage.selectTaskByTitle(playbook.taskTitles.deleteB);
        await actionBar.expectSelectedCount(2);

        await actionBar.deleteSelected();
        await actionBar.expectHidden();
        await outlinePage.expectTaskHidden(playbook.taskTitles.deleteA);
        await outlinePage.expectTaskHidden(playbook.taskTitles.deleteB);
        await outlinePage.expectTaskVisible(playbook.taskTitles.conditionAnchor);
    });

    test('bulk assigns selected tasks', async ({page}) => {
        const loginPage = new LoginPage(page);
        const outlinePage = new PlaybookOutlinePage(page);
        const actionBar = new MultiSelectActionBar(page);

        await loginPage.loginAsAdmin();
        const playbook = await seedPlaybookOutlineBulkEditData(page, seededTeam, 'assign');

        await outlinePage.goto(playbook.teamName, playbook.playbookId);
        await outlinePage.openBulkEdit();
        await outlinePage.selectTaskByTitle(playbook.taskTitles.assignA);
        await outlinePage.selectTaskByTitle(playbook.taskTitles.assignB);
        await actionBar.expectSelectedCount(2);

        await actionBar.assignToUser(playbook.assigneeUser.username);
        await outlinePage.expectTaskAssignedTo(playbook.taskTitles.assignA, `@${playbook.assigneeUser.username}`);
        await outlinePage.expectTaskAssignedTo(playbook.taskTitles.assignB, `@${playbook.assigneeUser.username}`);
    });

    test('moves selected tasks into an existing condition', async ({page}) => {
        const loginPage = new LoginPage(page);
        const outlinePage = new PlaybookOutlinePage(page);
        const actionBar = new MultiSelectActionBar(page);

        await loginPage.loginAsAdmin();
        const playbook = await seedPlaybookOutlineBulkEditData(page, seededTeam, 'condition');

        await outlinePage.goto(playbook.teamName, playbook.playbookId);
        await expect.poll(async () => outlinePage.conditionIndicatorCount()).toBe(1);

        await outlinePage.openBulkEdit();
        await outlinePage.selectTaskByTitle(playbook.taskTitles.conditionTarget);
        await actionBar.expectSelectedCount(1);

        await actionBar.moveSelectedToCondition(playbook.conditionMatcher);
        await expect.poll(async () => outlinePage.conditionIndicatorCount()).toBe(2);
        await outlinePage.expectTaskHasConditionIndicator(playbook.taskTitles.conditionTarget);
        await outlinePage.expectTaskAppearsBefore(playbook.taskTitles.conditionTarget, playbook.taskTitles.clearSelectionA);
    });

    test('hides bulk edit for archived playbooks', async ({page}) => {
        const loginPage = new LoginPage(page);
        const outlinePage = new PlaybookOutlinePage(page);

        await loginPage.loginAsAdmin();
        const playbook = await seedPlaybookOutlineBulkEditData(page, seededTeam, 'archived', {
            archived: true,
            includeCondition: false,
        });

        await outlinePage.goto(playbook.teamName, playbook.playbookId);
        await outlinePage.expectTaskVisible(playbook.taskTitles.conditionAnchor);
        await outlinePage.expectBulkEditHidden();
    });
});
