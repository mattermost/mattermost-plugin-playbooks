// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

export class PlaybookOutlinePage {
    readonly page: Page;
    readonly bulkEditButton: Locator;
    readonly exitBulkEditButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.bulkEditButton = page.getByRole('button', {name: 'Bulk edit'});
        this.exitBulkEditButton = page.getByRole('button', {name: 'Exit bulk edit'});
    }

    async goto(teamName: string, playbookId: string) {
        await this.page.goto(`/${teamName}/channels/town-square`);
        await this.page.goto(`/playbooks/playbooks/${playbookId}/outline`);
        await expect(this.page).toHaveURL(new RegExp(`/playbooks/playbooks/${playbookId}/outline(?:\\?.*)?$`));
    }

    async expectBulkEditVisible() {
        await expect(this.bulkEditButton).toBeVisible();
    }

    async expectBulkEditHidden() {
        await expect(this.bulkEditButton).toHaveCount(0);
        await expect(this.exitBulkEditButton).toHaveCount(0);
    }

    async openBulkEdit() {
        await this.bulkEditButton.click();
        await expect(this.exitBulkEditButton).toBeVisible();
    }

    async exitBulkEdit() {
        await this.exitBulkEditButton.click();
        await expect(this.bulkEditButton).toBeVisible();
    }

    async selectTaskByTitle(title: string) {
        const row = this.taskRow(title);
        await row.hover();
        await this.selectionCheckbox(title).click();
        await expect(this.selectionCheckbox(title)).toBeChecked();
    }

    async expectTaskVisible(title: string) {
        await expect(this.taskRow(title)).toBeVisible();
    }

    async expectTaskHidden(title: string) {
        await expect(this.taskRow(title)).toHaveCount(0);
    }

    async expectTaskSelectionCheckboxVisible(title: string) {
        await expect(this.selectionCheckbox(title)).toHaveCSS('opacity', '1');
    }

    async expectTaskSelectionCheckboxHidden(title: string) {
        await expect(this.selectionCheckbox(title)).toHaveCSS('opacity', '0');
    }

    async expectTaskAssignedTo(title: string, assigneeText: string) {
        await expect(this.assigneeProfileSelector(title)).toContainText(assigneeText);
    }

    async expectTaskHasConditionIndicator(title: string) {
        await expect(this.conditionIndicator(title)).toBeVisible();
    }

    async conditionIndicatorCount() {
        return this.page.getByTestId('condition-indicator').count();
    }

    async expectTaskAppearsBefore(title: string, otherTitle: string) {
        const rowTexts = await this.page.getByTestId('checkbox-item-container').evaluateAll((nodes) =>
            nodes.map((node) => node.textContent || '')
        );
        const titleIndex = rowTexts.findIndex((rowText) => rowText.includes(title));
        const otherTitleIndex = rowTexts.findIndex((rowText) => rowText.includes(otherTitle));

        expect(titleIndex).toBeGreaterThanOrEqual(0);
        expect(otherTitleIndex).toBeGreaterThanOrEqual(0);
        expect(titleIndex).toBeLessThan(otherTitleIndex);
    }

    private taskRow(title: string) {
        return this.page.getByTestId('checkbox-item-container').filter({
            has: this.page.getByText(title, {exact: true}),
        }).first();
    }

    private selectionCheckbox(title: string) {
        return this.taskRow(title).locator('input[type="checkbox"]').first();
    }

    private assigneeProfileSelector(title: string) {
        return this.taskRow(title).getByTestId('assignee-profile-selector');
    }

    private conditionIndicator(title: string) {
        return this.taskRow(title).getByTestId('condition-indicator');
    }
}
