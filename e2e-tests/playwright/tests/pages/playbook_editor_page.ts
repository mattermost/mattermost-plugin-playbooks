// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

export class PlaybookEditorPage {
    readonly page: Page;
    readonly title: Locator;
    readonly header: Locator;
    readonly titleEditInput: Locator;
    readonly descriptionEditInput: Locator;
    readonly saveButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByTestId('playbook-editor-title');
        this.header = page.getByTestId('playbook-editor-header');
        this.titleEditInput = page.getByTestId('rendered-editable-text');
        this.descriptionEditInput = page.getByRole('textbox', {name: /Add a description/});
        this.saveButton = page.getByRole('button', {name: 'Save'});
    }

    async goto(teamName: string, playbookId: string) {
        // Visit the team first so the current team (and its LHS) is set before
        // entering the (team-agnostic) editor URL.
        await this.page.goto(`/${teamName}/channels/town-square`);
        await expect(this.page.getByRole('link', {name: 'town square public channel'})).toBeVisible();
        await this.page.goto(`/playbooks/playbooks/${playbookId}/outline`);
        await expect(this.title).toBeVisible();
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
        await this.page.getByText(currentText).dblclick();
        await this.descriptionEditInput.fill(newText);
        await this.saveButton.click();
    }

    async expectTitle(playbookTitle: string) {
        await expect(this.header.getByRole('button', {name: playbookTitle})).toBeVisible();
    }

    async expectDescription(description: string) {
        await expect(this.page.getByText(description)).toBeVisible();
    }
}
