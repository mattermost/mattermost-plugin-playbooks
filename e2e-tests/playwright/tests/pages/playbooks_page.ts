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
    readonly lhsNavigation: Locator;
    readonly createPlaybookButton: Locator;
    readonly createPlaybookDialog: Locator;
    readonly createPlaybookDropdownToggle: Locator;
    readonly createPlaybookDropdown: Locator;

    constructor(page: Page) {
        this.page = page;
        this.playbooksLHSButton = page.getByTestId('playbooksLHSButton');
        this.playbookRunsLHSButton = page.getByTestId('playbookRunsLHSButton');
        this.titlePlaybook = page.getByTestId('titlePlaybook');
        this.playbookListScrollContainer = page.getByTestId('playbook-list-scroll-container');
        this.playbookRunList = page.locator('#playbookRunList');
        this.lhsNavigation = page.getByTestId('lhs-navigation');
        this.createPlaybookButton = this.titlePlaybook.getByText('Create playbook');
        this.createPlaybookDialog = page.getByRole('dialog', {name: 'Create Playbook'});
        this.createPlaybookDropdownToggle = page.getByTestId('create-playbook-dropdown-toggle');
        this.createPlaybookDropdown = page.getByRole('menu', {name: 'Create Playbook Dropdown'});
    }

    async goto(teamName: string) {
        await this.page.goto(`/${teamName}/channels/town-square`);
        await expect(this.page).toHaveURL(new RegExp(`/${teamName}/channels/town-square(?:\\?.*)?$`));

        // Wait for the team's sidebar to render before leaving for the product.
        await expect(this.page.getByRole('link', {name: 'town square public channel'})).toBeVisible();
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

    // A preset template is rendered as a clickable card (role="button") whose
    // heading is the template title. Selecting it instantly creates a playbook
    // from that template and routes to the new playbook's outline.
    templateCard(templateTitle: string): Locator {
        return this.page.getByRole('button').filter({
            has: this.page.getByRole('heading', {name: templateTitle, exact: true}),
        });
    }

    async createPlaybookFromTemplate(templateTitle: string) {
        const card = this.templateCard(templateTitle);
        await expect(card).toBeVisible();
        await card.click();
    }

    async expectPlaybookInLHS(playbookTitle: string) {
        await expect(this.lhsNavigation.getByText(playbookTitle)).toBeVisible();
    }

    // Opens the "Create Playbook" modal from the list header button, then
    // confirms with no name typed, which creates an "Untitled Playbook".
    async createPlaybookFromModal() {
        await this.createPlaybookButton.click();
        await expect(this.createPlaybookDialog).toBeVisible();
        await this.createPlaybookDialog.getByRole('button', {name: 'Create playbook'}).click();
    }

    async expectCreatePlaybookButtonHidden() {
        await expect(this.createPlaybookButton).toHaveCount(0);
    }

    async openCreatePlaybookDropdown() {
        await this.createPlaybookDropdownToggle.click();

        // "Browse Playbooks" is always present, so its appearance confirms the
        // menu opened regardless of the user's create permission.
        await expect(this.createPlaybookDropdown.getByRole('menuitem', {name: 'Browse Playbooks'})).toBeVisible();
    }

    async expectCreatePlaybookEntryHidden() {
        await expect(this.createPlaybookDropdown.getByRole('menuitem', {name: 'Create New Playbook'})).toHaveCount(0);
    }

    async expectNoCreatePermissionNotice() {
        await expect(
            this.page.getByText("There are no playbooks to view. You don't have permission to create playbooks in this workspace."),
        ).toBeVisible();
    }
}
