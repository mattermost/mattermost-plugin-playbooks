// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

// Page object for the Run Details Page (RDP), `/playbooks/runs/:runId`.
export class RunDetailsPage {
    readonly page: Page;

    // Header
    readonly header: Locator;
    readonly statusBadge: Locator;
    readonly contextMenuButton: Locator;
    readonly contextMenu: Locator;
    readonly timelineButton: Locator;
    readonly infoButton: Locator;

    // Sections
    readonly summarySection: Locator;
    readonly statusUpdateSection: Locator;
    readonly checklistSection: Locator;
    readonly retrospectiveSection: Locator;
    readonly finishSection: Locator;

    // Right sidebar (Info/Timeline)
    readonly sidebar: Locator;
    readonly sidebarTitle: Locator;

    // The channel-name link in the run detail sidebar (data-testid='runinfo-channel-link').
    // Clicking it navigates to the channel linked to this run.
    readonly channelLink: Locator;

    constructor(page: Page) {
        this.page = page;

        this.header = page.getByTestId('run-header-section');
        this.statusBadge = this.header.getByText(/^(In Progress|Finished|Archived)$/);
        // The run title doubles as the context-menu trigger (role="button", testid="menuButton").
        this.contextMenuButton = this.header.getByTestId('menuButton');
        this.contextMenu = page.getByTestId('dropdownmenu');
        this.timelineButton = this.header.getByTestId('rhs-header-button-timeline');
        this.infoButton = this.header.getByTestId('rhs-header-button-info');

        this.summarySection = page.getByTestId('run-summary-section');
        this.statusUpdateSection = page.getByTestId('run-statusupdate-section');
        this.checklistSection = page.getByTestId('run-checklist-section');
        this.retrospectiveSection = page.getByTestId('run-retrospective-section');
        this.finishSection = page.getByTestId('run-finish-section');

        this.sidebar = page.getByRole('complementary');
        this.sidebarTitle = this.sidebar.getByTestId('rhs-title');

        this.channelLink = page.getByTestId('runinfo-channel-link');
    }

    async goto(teamName: string, runId: string) {
        // Visit the team first so the current team (and its LHS) is set before
        // entering the (team-agnostic) run details URL.
        await this.page.goto(`/${teamName}/channels/town-square`);
        await this.page.getByRole('link', {name: 'town square public channel'}).waitFor();
        await this.page.goto(`/playbooks/runs/${runId}`);
        await this.header.waitFor();
    }

    async openContextMenu() {
        await this.contextMenuButton.click();
    }

    async expectTitle(runName: string) {
        await expect(this.contextMenuButton).toContainText(runName);
    }

    async expectStatus(status: 'In Progress' | 'Finished' | 'Archived') {
        await expect(this.statusBadge).toHaveText(status);
    }

    async openSidebarInfo() {
        await this.infoButton.click();
    }

    async openSidebarTimeline() {
        await this.timelineButton.click();
    }

    async expectSidebarTitle(title: string) {
        await expect(this.sidebarTitle).toContainText(title);
    }

    // Clicks the channel link and navigates to the linked channel.
    async clickChannelLink() {
        await this.channelLink.click();
    }
}
