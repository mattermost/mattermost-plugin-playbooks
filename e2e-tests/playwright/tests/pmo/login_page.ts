// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

import {ensureAdminHasTeam} from '../helpers/bootstrap';

export class LoginPage {
    readonly page: Page;
    readonly channelView: Locator;

    constructor(page: Page) {
        this.page = page;
        this.channelView = page.locator('#channel_view');
    }

    async loginAsAdmin() {
        const team = await ensureAdminHasTeam(this.page.request);
        await this.page.goto(`/${team.name}/channels/town-square`);

        await expect(this.channelView).toBeVisible();
    }
}
