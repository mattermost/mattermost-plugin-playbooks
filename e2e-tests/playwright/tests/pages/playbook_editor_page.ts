// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

export class PlaybookEditorPage {
    readonly page: Page;
    readonly title: Locator;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByTestId('playbook-editor-title');
    }

    async expectOutlineOpened(playbookTitle: string) {
        await expect(this.page).toHaveURL(/\/outline(?:\?.*)?$/);
        await expect(this.title).toContainText(playbookTitle);
    }
}
