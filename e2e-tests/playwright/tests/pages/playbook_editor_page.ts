// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

// The list of a playbook's own phases in the outline.
export class CustomPhasesEditor {
    readonly page: Page;
    readonly root: Locator;
    readonly input: Locator;
    readonly addButton: Locator;
    readonly rows: Locator;
    readonly names: Locator;
    readonly empty: Locator;
    readonly duplicateAlert: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByTestId('custom-phases-editor');
        this.input = page.getByTestId('custom-phase-input');
        this.addButton = page.getByTestId('custom-phase-add');
        this.rows = page.getByTestId('custom-phase-row');
        this.names = page.getByTestId('custom-phase-name');
        this.empty = page.getByTestId('custom-phases-empty');
        this.duplicateAlert = this.root.getByRole('alert');
    }

    // The name of every phase in the list, in order.
    async titles(): Promise<string[]> {
        return this.names.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    }

    async typeName(title: string) {
        await this.input.fill(title);
    }

    async addWithButton(title: string) {
        await this.input.fill(title);
        await this.addButton.click();
    }

    async addWithEnter(title: string) {
        await this.input.fill(title);
        await this.input.press('Enter');
    }

    async remove(title: string) {
        await this.page.getByRole('button', {name: `Delete phase ${title}`, exact: true}).click();
    }

    // Types a new name into the field of the phase at the given position and leaves it with the given key.
    async renameAt(index: number, title: string, key: 'Enter' | 'Escape' | 'Tab') {
        const field = this.names.nth(index);
        await field.fill(title);
        await field.press(key);
    }

    // Moves a phase with the keyboard, the way the drag handle is operated without a pointer.
    async moveWithKeyboard(title: string, steps: number) {
        const handle = this.page.getByRole('button', {name: `Drag to reorder phase ${title}`, exact: true});
        await handle.focus();
        await this.page.keyboard.press('Space');
        const key = steps > 0 ? 'ArrowDown' : 'ArrowUp';
        for (let i = 0; i < Math.abs(steps); i++) {
            await this.page.keyboard.press(key);
        }
        await this.page.keyboard.press('Space');
    }
}

export class PlaybookEditorPage {
    readonly page: Page;
    readonly title: Locator;
    readonly header: Locator;
    readonly description: Locator;
    readonly titleEditInput: Locator;
    readonly descriptionEditInput: Locator;
    readonly saveButton: Locator;
    readonly activatePhasesToggle: Locator;
    readonly activatePhasesCheckbox: Locator;
    readonly usePhasesToggle: Locator;
    readonly usePhasesCheckbox: Locator;
    readonly customPhases: CustomPhasesEditor;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByTestId('playbook-editor-title');
        this.header = page.getByTestId('playbook-editor-header');
        this.description = page.getByTestId('playbook-editor-description');
        this.titleEditInput = page.getByTestId('rendered-editable-text');
        this.descriptionEditInput = page.getByRole('textbox', {name: /Add a description/});
        this.saveButton = page.getByRole('button', {name: 'Save'});
        this.activatePhasesToggle = page.getByTestId('activate-phases-toggle');
        this.activatePhasesCheckbox = this.activatePhasesToggle.locator('input[type="checkbox"]');
        this.customPhases = new CustomPhasesEditor(page);
        this.usePhasesToggle = page.getByTestId('use-checklists-as-phases-toggle');
        this.usePhasesCheckbox = this.usePhasesToggle.locator('input[type="checkbox"]');
    }

    async goto(teamName: string, playbookId: string) {
        // Visit the team first so the current team (and its LHS) is set before
        // entering the (team-agnostic) editor URL.
        await this.page.goto(`/${teamName}/channels/town-square`);
        await this.page.getByRole('link', {name: 'town square public channel'}).waitFor();
        await this.page.goto(`/playbooks/playbooks/${playbookId}/outline`);
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

    async toggleActivatePhases() {
        await this.activatePhasesToggle.click();
    }

    async toggleUsePhases() {
        await this.usePhasesToggle.click();
    }
}
