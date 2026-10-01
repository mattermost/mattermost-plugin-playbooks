// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

// Page object for the Playbooks right-hand sidebar (RHS) rendered inside a
// channel (the "Checklists" / run-details view that auto-opens when visiting
// a channel linked to a run).
export class ChannelRhs {
    readonly page: Page;
    // The RHS header title ("Checklist") rendered by the core webapp's RHS
    // chrome. There is no single container both the title and body share an
    // accessible role/testid for (the core RHS panel itself exposes neither),
    // so this is the stable anchor used to confirm the Playbooks RHS is open.
    readonly title: Locator;
    // The run name doubles as the context-menu trigger (same ContextMenu
    // component used by the Run Details Page header; testid="menuButton").
    readonly runTitle: Locator;
    readonly contextMenu: Locator;
    readonly checklist: Locator;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByTestId('rhs-title');
        this.runTitle = page.getByTestId('menuButton');
        this.contextMenu = page.getByTestId('dropdownmenu');
        this.checklist = page.getByTestId('pb-checklists-inner-container');
    }

    // Navigates to the given channel; the Playbooks RHS auto-opens when the
    // channel is linked to a run.
    async gotoRunChannel(teamName: string, channelName: string) {
        await this.page.goto(`/${teamName}/channels/${channelName}`);
        await this.title.waitFor();
    }

    async openRunContextMenu() {
        await this.runTitle.click();
    }

    async expectRunTitle(runName: string) {
        await expect(this.runTitle).toContainText(runName);
    }
}
