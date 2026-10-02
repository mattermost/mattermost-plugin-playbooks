// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

import {MattermostCore} from './mattermost';

export class PlaybookEditorPage {
    readonly page: Page;
    // MattermostCore facade 
    readonly mm: MattermostCore;
    readonly title: Locator;
    readonly header: Locator;
    readonly description: Locator;
    readonly titleEditInput: Locator;
    readonly descriptionEditInput: Locator;
    readonly saveButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.mm = new MattermostCore(page);
        this.title = page.getByTestId('playbook-editor-title');
        this.header = page.getByTestId('playbook-editor-header');
        this.description = page.getByTestId('playbook-editor-description');
        this.titleEditInput = page.getByTestId('rendered-editable-text');
        this.descriptionEditInput = page.getByRole('textbox', {name: /Add a description/});
        this.saveButton = page.getByRole('button', {name: 'Save'});
    }

    async goto(teamName: string, playbookId: string) {
        // Visit town-square first so the Redux team context is set before
        // entering the (team-agnostic) editor URL.
        await this.mm.channels.goto(teamName, 'town-square');
        await this.page.goto(`/playbooks/playbooks/${playbookId}/outline`);
        await this.title.waitFor();
    }

    // Navigates directly to the playbook editor outline URL without visiting a channel first.
    // This leaves Redux's currentChannelId unset/empty, which means the run modal will
    // NOT auto-fill any channel when the user switches to "Link to existing channel".
    // Use this when the test specifically needs no channel context.
    async gotoDirectly(playbookId: string) {
        await this.page.goto(`/playbooks/playbooks/${playbookId}/outline`);
        await this.title.waitFor();
    }

    // Navigates to the editor via client-side routing from Town Square, preserving the
    // Redux currentChannelId set by the town-square visit. This is the workaround used
    // by tests that need the run modal to default to the current channel when switching
    // to "Link to existing channel" mode.
    async gotoViaClientSideNav(teamName: string, playbookId: string) {
        // First fully navigate to town-square to set the Redux current channel
        await this.mm.channels.goto(teamName, 'town-square');
        // Push the editor URL into the history without a full page reload
        await this.page.evaluate((url) => {
            (window as {WebappUtils?: {browserHistory?: {push: (u: string) => void}}}).WebappUtils?.browserHistory?.push(url);
        }, `/playbooks/playbooks/${playbookId}/outline`);
        await this.title.waitFor();
    }

    async expectOutlineOpened(playbookTitle: string) {
        await expect(this.page).toHaveURL(/\/outline(?:\?.*)?$/);
        await expect(this.title).toContainText(playbookTitle);
    }

    private async openTitleMenu() {
        await this.title.click();
    }

    async rename(newTitle: string) {
        await this.openTitleMenu();
        await this.page.getByRole('button', {name: 'Rename'}).click();
        await this.titleEditInput.fill(newTitle);
        await this.saveButton.click();
    }

    async duplicate() {
        await this.openTitleMenu();
        await this.page.getByRole('button', {name: 'Duplicate'}).click();
    }

    async editDescription(currentText: string, newText: string) {
        // The description renders as markdown; double-clicking it opens the editor.
        await this.description.getByText(currentText).dblclick();
        await this.descriptionEditInput.fill(newText);
        await this.saveButton.click();
    }

    async expectTitle(playbookTitle: string) {
        await expect(this.header.getByRole('button', {name: playbookTitle})).toBeVisible();
    }

    async expectDescription(description: string) {
        await expect(this.description.getByText(description)).toBeVisible();
    }

    // Opens the "Run" start-run modal from the playbook editor toolbar and waits
    // for the run-details step to be fully loaded (playbook data fetched via API).
    // Uses data-testid as a last resort: another button with aria-label "Runs and
    // Checklists" would match getByRole({name:'Run'}) as a substring.
    async openRunModal() {
        await this.page.getByTestId('run-playbook').click();
        // Wait for the run-name input to appear, which signals the run-details step
        // is rendered and the playbook data has been loaded (no more loading spinner).
        await this.page.getByTestId('run-name-input').waitFor({state: 'attached'});
    }
}
