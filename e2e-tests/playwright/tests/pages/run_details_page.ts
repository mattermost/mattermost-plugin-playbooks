// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

import {MattermostCore} from './mattermost';

// Page object for the Run Details Page (RDP), `/playbooks/runs/:runId`.
export class RunDetailsPage {
    readonly page: Page;
    // MattermostCore facade 
    readonly mm: MattermostCore;

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

    // The finish button inside the finish section.
    // The RDP finish section contains a single button that triggers the finish-run flow.
    readonly finishButton: Locator;

    // Playbooks LHS navigation panel (data-testid='lhs-navigation').
    // Used to verify a run appears/disappears from the left-hand sidebar list.
    readonly lhsNavigation: Locator;

    // Right sidebar (Info/Timeline)
    readonly sidebar: Locator;
    readonly sidebarTitle: Locator;

    // The channel-name link in the run detail sidebar (data-testid='runinfo-channel-link').
    // Clicking it navigates to the channel linked to this run.
    readonly channelLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.mm = new MattermostCore(page);

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
        // The finish section contains a single call-to-action button.
        // Using getByRole scoped to the section avoids matching other buttons on the page.
        this.finishButton = this.finishSection.getByRole('button');

        this.lhsNavigation = page.getByTestId('lhs-navigation');

        this.sidebar = page.getByRole('complementary');
        this.sidebarTitle = this.sidebar.getByTestId('rhs-title');

        this.channelLink = page.getByTestId('runinfo-channel-link');
    }

    async goto(teamName: string, runId: string) {
        // Visit town-square first so the Redux team context is set before
        // entering the (team-agnostic) run details URL.
        await this.mm.channels.goto(teamName, 'town-square');
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

    // ── Finish / restore actions ─────────────────────────────────────────────

    // Clicks the finish button in the RDP finish section.
    async clickFinishButton(): Promise<void> {
        await this.finishButton.click();
    }

    // Returns the locator for a named item in the open context dropdown menu.
    contextMenuItem(text: string): Locator {
        return this.contextMenu.getByText(text, {exact: true});
    }

    // Opens the context menu and clicks the item with the given text.
    async openContextMenuAndClickItem(itemText: string): Promise<void> {
        await this.openContextMenu();
        await this.contextMenuItem(itemText).click();
    }

    // ── Finish-section assertions ────────────────────────────────────────────

    // Asserts the RDP finish section is visible.
    async expectFinishSectionVisible(): Promise<void> {
        await expect(this.finishSection).toBeVisible();
    }

    // Asserts the RDP finish section has been removed from the DOM.
    async expectFinishSectionHidden(): Promise<void> {
        await expect(this.finishSection).toHaveCount(0);
    }

    // Asserts the finish section contains the expected placeholder text.
    async expectFinishSectionPlaceholder(text: string): Promise<void> {
        await expect(this.finishSection).toContainText(text);
    }

    // ── Context-menu item assertions ─────────────────────────────────────────

    // Asserts a named item is visible in the currently open context menu.
    async expectContextMenuItemVisible(text: string): Promise<void> {
        await expect(this.contextMenuItem(text)).toBeVisible();
    }

    // Asserts a named item does not exist in the context menu (or menu is closed).
    async expectContextMenuItemHidden(text: string): Promise<void> {
        await expect(this.contextMenuItem(text)).toHaveCount(0);
    }

    // ── LHS run-list assertions ──────────────────────────────────────────────

    // Asserts the run appears by name in the Playbooks LHS navigation list.
    async expectRunInLhs(runName: string): Promise<void> {
        await expect(this.lhsNavigation.getByText(runName)).toBeVisible();
    }

    // Asserts the run does NOT appear in the Playbooks LHS navigation list.
    async expectRunNotInLhs(runName: string): Promise<void> {
        await expect(this.lhsNavigation.getByText(runName)).toHaveCount(0);
    }

    // ── Timeline assertions ──────────────────────────────────────────────────

    // Returns the locator for all timeline items of a given event type.
    // The RDP timeline renders each event with data-testid="timeline-item <eventType>".
    timelineItem(eventType: string): Locator {
        return this.page.getByTestId(`timeline-item ${eventType}`);
    }

    // Asserts that at least one timeline item of the given event type is visible.
    async expectTimelineEvent(eventType: string): Promise<void> {
        await expect(this.timelineItem(eventType).first()).toBeVisible();
    }

    // ── Checklist interactions (RDP) ─────────────────────────────────────────────

    // Returns all task (checkbox-item-container) rows in the RDP checklist section.
    rdpChecklistItems(): Locator {
        return this.checklistSection.getByTestId('checkbox-item-container');
    }

    // Checks the task checkbox at the given index in the RDP checklist section.
    async checkTaskAtIndex(index: number): Promise<void> {
        await this.rdpChecklistItems().nth(index).getByRole('checkbox').click();
    }

    // Asserts the task at the given index is checked.
    async expectTaskChecked(index: number): Promise<void> {
        await expect(this.rdpChecklistItems().nth(index).getByRole('checkbox')).toBeChecked();
    }

    // Asserts the total number of visible task rows in the RDP checklist section.
    async expectTaskCount(count: number): Promise<void> {
        await expect(this.rdpChecklistItems()).toHaveCount(count);
    }

    // Hovers over the task at the given index to reveal its hover menu.
    async hoverTaskAtIndex(index: number): Promise<void> {
        await this.rdpChecklistItems().nth(index).hover();
    }

    // Opens the dot-menu ('More') for the task at the given index on the RDP.
    // The DotMenu button renders with data-testid='menuButtonMore' (see dot_menu.tsx).
    async openTaskDotMenuAtIndex(index: number): Promise<void> {
        await this.hoverTaskAtIndex(index);
        await this.rdpChecklistItems().nth(index).getByTestId('menuButtonMore').click({force: true});
    }

    // Asserts that a given item is visible in the currently open task dot-menu.
    async expectTaskMenuItemVisible(text: string): Promise<void> {
        await expect(this.page.getByRole('button', {name: text})).toBeVisible();
    }
}
