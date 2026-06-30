// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {ensureAdminHasTeam} from './bootstrap';
import {requestedWith} from './client';

// Logs in (via API) on the page's browser context, so subsequent navigations
// are authenticated. Used to test as a non-admin user without driving the
// Mattermost login UI.
export async function loginAs(page: Page, loginId: string, password: string) {
    const response = await page.request.post('/api/v4/users/login', {
        ...requestedWith,
        data: {login_id: loginId, password},
    });

    if (!response.ok()) {
        throw new Error(`Unable to login as ${loginId}: ${response.status()} ${await response.text()}`);
    }
}

// Logs in as the system admin (via API) and ensures the admin has a team. No
// UI navigation — callers navigate to the page under test themselves.
export async function loginAsAdmin(page: Page) {
    await ensureAdminHasTeam(page.request);
}
