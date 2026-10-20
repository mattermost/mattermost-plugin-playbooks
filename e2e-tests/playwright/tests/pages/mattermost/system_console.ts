// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Page} from '@playwright/test';

// Wraps Mattermost System Console navigation.
// Only system admin users can access these pages; tests must log in as admin
// (or a user with the `manage_system` permission) before calling these methods.
export class MattermostSystemConsole {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // Navigates to the System Console site/system statistics page.
    // Mattermost's admin console route for analytics/statistics is
    // /admin_console/reporting/system_analytics (called "System Statistics"
    // in the UI as of Mattermost v9/10).
    async gotoSiteStatistics(): Promise<void> {
        await this.page.goto('/admin_console/reporting/system_analytics');
        // Wait for the page title to confirm we are on the right page.
        // The title text varies by version: "System Statistics", "Site Statistics".
        // In Mattermost admin console, the page title is not always a semantic
        // heading element, so we use getByText for broad compatibility.
        await expect(
            this.page.getByText(/system statistics|site statistics/i).first(),
        ).toBeVisible();
    }
}
