// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

// Page object for the "Post update" / status update dialog
// (webapp/src/components/modals/update_run_status_modal.tsx), opened from the
// RDP "Post update" button, the `/playbook update` slash command, or a
// reminder post's "Update status" button.
export class StatusUpdateDialog {
    readonly page: Page;
    readonly dialog: Locator;
    readonly description: Locator;
    readonly message: Locator;
    readonly markAsFinishedCheckbox: Locator;
    readonly confirmButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.dialog = page.getByRole('dialog', {name: /(?:post|status) update/i});
        this.description = this.dialog.getByTestId('update_run_status_description');
        this.message = this.dialog.getByTestId('update_run_status_textbox');
        this.markAsFinishedCheckbox = this.dialog.getByRole('checkbox', {name: 'Also mark the run as finished'});
        this.confirmButton = this.dialog.getByTestId('modal-confirm-button');
        this.cancelButton = this.dialog.getByTestId('modal-cancel-button');
    }

    async setMessage(message: string) {
        await this.message.fill(message);
    }

    async setMarkAsFinished(checked: boolean) {
        if (checked) {
            await this.markAsFinishedCheckbox.check();
        } else {
            await this.markAsFinishedCheckbox.uncheck();
        }
    }

    async submit() {
        await this.confirmButton.click();
    }

    async cancel() {
        await this.cancelButton.click();
    }

    async expectOpen() {
        await expect(this.dialog).toBeVisible();
    }

    async expectClosed() {
        await expect(this.dialog).toHaveCount(0);
    }
}
