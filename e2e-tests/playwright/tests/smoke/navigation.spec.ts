// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@playwright/test';

import {loginAsAdmin} from '../helpers/auth';

test.describe('playbooks navigation', () => {
    test('opens the playbooks and runs views', async ({page}) => {
        await loginAsAdmin(page);

        await page.goto('/playbooks');

        await expect(page.getByTestId('playbooksLHSButton')).toBeVisible();
        await page.getByTestId('playbooksLHSButton').click();
        await expect(page.getByTestId('titlePlaybook')).toContainText('Playbooks');

        await page.getByTestId('playbookRunsLHSButton').click();
        await expect(page.locator('#playbookRunList')).toBeVisible();
    });
});
