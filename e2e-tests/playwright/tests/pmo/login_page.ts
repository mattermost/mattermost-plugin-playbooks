// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

const adminUsername = process.env.MM_ADMIN_USERNAME || 'sysadmin';
const adminPassword = process.env.MM_ADMIN_PASSWORD || 'Sys@dmin-sample1';

export class LoginPage {
    readonly page: Page;
    readonly loginIdInput: Locator;
    readonly passwordInput: Locator;
    readonly loginButton: Locator;
    readonly channelView: Locator;

    constructor(page: Page) {
        this.page = page;
        this.loginIdInput = page.locator('#input_loginId');
        this.passwordInput = page.locator('#input_password-input');
        this.loginButton = page.locator('#saveSetting');
        this.channelView = page.locator('#channel_view');
    }

    async goto() {
        await this.page.goto('/login');
    }

    async loginAsAdmin() {
        await this.goto();

        if (this.page.url().includes('/login')) {
            await this.loginIdInput.fill(adminUsername);
            await this.passwordInput.fill(adminPassword);
            await this.loginButton.click();
        }

        await expect(this.channelView).toBeVisible();
    }
}
