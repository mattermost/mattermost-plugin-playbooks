// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

export class MultiSelectActionBar {
    readonly page: Page;
    readonly container: Locator;
    readonly assignButton: Locator;
    readonly addToConditionButton: Locator;
    readonly deleteSelectedButton: Locator;
    readonly clearSelectionButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.container = page.getByTestId('multi-select-action-bar');
        this.assignButton = this.container.getByRole('button', {name: 'Assign'});
        this.addToConditionButton = this.container.getByRole('button', {name: /Add to condition/});
        this.deleteSelectedButton = this.container.getByRole('button', {name: 'Delete selected tasks'});
        this.clearSelectionButton = this.container.getByRole('button', {name: 'Clear selection'});
    }

    async expectVisible() {
        await expect(this.container).toBeVisible();
    }

    async expectHidden() {
        await expect(this.container).toHaveCount(0);
    }

    async expectSelectedCount(count: number) {
        const label = count === 1 ? '1 task selected' : `${count} tasks selected`;
        await expect(this.container).toContainText(label);
    }

    async clearSelection() {
        await this.clearSelectionButton.click();
    }

    async deleteSelected() {
        await this.deleteSelectedButton.click();
        await this.page.getByRole('dialog').getByRole('button', {name: 'Delete'}).click();
    }

    async assignToUser(username: string) {
        await this.assignButton.click();

        const option = this.page.locator('.playbook-react-select__option').filter({hasText: username}).first();
        await expect(option).toBeVisible();
        await option.click();
    }

    async moveSelectedToCondition(conditionMatcher: string) {
        await this.addToConditionButton.click();

        const dropdown = this.page.getByText('Move to condition', {exact: true}).locator('xpath=..');
        await expect(dropdown).toBeVisible();

        const option = dropdown.getByRole('button').filter({hasText: conditionMatcher}).first();
        await expect(option).toBeVisible();
        await option.click();
    }
}
