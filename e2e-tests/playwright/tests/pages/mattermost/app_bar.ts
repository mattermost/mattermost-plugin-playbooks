// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type Locator, type Page} from '@playwright/test';

// Wraps the Mattermost app bar (the right-side vertical icon strip).
// Plugin icons are registered with a stable id derived from the plugin id:
// `app-bar-icon-<pluginId>`. These ids are assigned by the core Mattermost
// framework (not by the plugin), so they are wrapped here rather than in
// plugin page objects.
export class MattermostAppBar {
    readonly page: Page;

    // The Playbooks plugin app bar icon.
    // Mattermost assigns id="app-bar-icon-playbooks" when the plugin registers
    // via registerAppBarComponent.
    readonly playbooksIcon: Locator;

    constructor(page: Page) {
        this.page = page;
        this.playbooksIcon = page.locator('#app-bar-icon-playbooks');
    }

    // Clicks the Playbooks app bar icon and waits for either the Playbooks RHS
    // runs list or the "no active runs" empty state to be visible, confirming
    // the panel has opened.
    async openPlaybooks(): Promise<void> {
        await this.playbooksIcon.click();
        await this.page
            .getByTestId('no-active-runs')
            .or(this.page.getByTestId('rhs-runs-list'))
            .waitFor();
    }
}
