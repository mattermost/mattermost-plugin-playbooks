// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

const adminUsername = process.env.MM_ADMIN_USERNAME || 'sysadmin';
const adminPassword = process.env.MM_ADMIN_PASSWORD || 'Sys@dmin-sample1';

export async function loginAsAdmin(page: Page) {
    await page.goto('/login');

    if (page.url().includes('/login')) {
        await page.locator('#input_loginId').fill(adminUsername);
        await page.locator('#input_password-input').fill(adminPassword);
        await page.locator('#saveSetting').click();
    }

    await page.locator('#channel_view').waitFor();
}
