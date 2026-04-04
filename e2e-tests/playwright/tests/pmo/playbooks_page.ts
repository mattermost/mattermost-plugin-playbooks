// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

export class PlaybooksPage {
    readonly page: Page;
    readonly playbooksLHSButton: Locator;
    readonly playbookRunsLHSButton: Locator;
    readonly titlePlaybook: Locator;
    readonly playbookListScrollContainer: Locator;
    readonly playbookRunList: Locator;

    constructor(page: Page) {
        this.page = page;
        this.playbooksLHSButton = page.getByTestId('playbooksLHSButton');
        this.playbookRunsLHSButton = page.getByTestId('playbookRunsLHSButton');
        this.titlePlaybook = page.getByTestId('titlePlaybook');
        this.playbookListScrollContainer = page.getByTestId('playbook-list-scroll-container');
        this.playbookRunList = page.locator('#playbookRunList');
    }

    async goto(teamName: string) {
        await this.page.goto(`/${teamName}/channels/town-square`);
        await expect(this.page).toHaveURL(new RegExp(`/${teamName}/channels/town-square(?:\\?.*)?$`));
        await expect(this.page.locator(`a[href="/${teamName}/channels/town-square"]`)).toBeVisible();
        await this.page.goto('/playbooks');
        await expect(this.playbooksLHSButton).toBeVisible();
    }

    async openPlaybooksList() {
        await this.playbooksLHSButton.click();
        await expect(this.page).toHaveURL(/\/playbooks\/playbooks(?:\?.*)?$/);
    }

    async expectPlaybookVisible(playbookTitle: string) {
        await expect(this.titlePlaybook).toContainText('Playbooks');
        await expect(this.playbookListScrollContainer.getByText(playbookTitle)).toBeVisible();
    }

    async openRunsList() {
        await this.playbookRunsLHSButton.click();
        await expect(this.page).toHaveURL(/\/playbooks\/runs(?:\?.*)?$/);
        await expect(this.playbookRunList).toBeVisible();
    }

    async expectRunVisible(runName: string) {
        await expect(this.playbookRunList.getByText(runName)).toBeVisible();
    }
}
