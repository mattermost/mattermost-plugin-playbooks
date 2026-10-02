// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

// Wraps the Mattermost generic ConfirmModal component
// (components/confirm_modal.tsx in the core webapp). This modal is used
// throughout the core and by plugins for confirmation dialogs.
//
// The modal renders with id="confirmModal" and the action/cancel buttons
// use id="confirmModalButton" / id="cancelModalButton" — stable Mattermost
// infrastructure IDs documented here so they never leak into plugin page
// objects or spec files.
export class MattermostConfirmModal {
    readonly page: Page;

    // The modal wrapper element.
    readonly dialog: Locator;

    // The primary action button (e.g. "Confirm", "OK").
    readonly confirmButton: Locator;

    // The secondary cancel button.
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.dialog = page.locator('#confirmModal');
        this.confirmButton = page.locator('#confirmModalButton');
        this.cancelButton = page.locator('#cancelModalButton');
    }

    // Clicks the primary confirm button.
    async confirm(): Promise<void> {
        await this.confirmButton.click();
    }

    // Clicks the cancel button.
    async cancel(): Promise<void> {
        await this.cancelButton.click();
    }

    // Asserts the modal is visible.
    async expectVisible(): Promise<void> {
        await expect(this.dialog).toBeVisible();
    }

    // Asserts the modal has been removed from the DOM.
    async expectHidden(): Promise<void> {
        await expect(this.dialog).toHaveCount(0);
    }

    // Asserts the modal contains the given text somewhere in its body.
    async expectContainsText(text: string): Promise<void> {
        await expect(this.dialog).toContainText(text);
    }
}
