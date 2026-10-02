// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

// Wraps the Mattermost core RHS chrome: the thread view (opened by clicking
// "Reply" on a post), the close button, and generic RHS state checks.
// The Playbooks RHS *content* (checklists, run info, etc.) is in ChannelRhs,
// not here. This class covers only the generic, core-Mattermost RHS wrapper.
export class MattermostCoreRhs {
    readonly page: Page;

    // The Reply input that appears in the thread view (signals the thread RHS is open).
    // Mattermost renders this as a textbox with placeholder containing "reply".
    readonly replyTextbox: Locator;

    // The close button for the RHS panel. Mattermost renders it as a button
    // with the accessible name "Close" inside the RHS container.
    readonly closeButton: Locator;

    constructor(page: Page) {
        this.page = page;
        // The thread-reply textbox has id="reply_textbox" in Mattermost core.
        this.replyTextbox = page.locator('#reply_textbox');
        // The close button for the RHS uses aria-label="Close" in Mattermost.
        this.closeButton = page.locator('[aria-label="Close"]').last();
    }

    // Opens the thread view for the most recent post by hovering over it to
    // reveal the action toolbar, then clicking the "Reply" button.
    // Waits for the thread reply textbox to confirm the RHS has opened.
    //
    // The "Reply" button is part of the post action bar that Mattermost renders
    // on hover; it has a stable Mattermost data-testid="reply-icon".
    async openLastPostThread(): Promise<void> {
        const lastPost = this.page.getByTestId('post-message-text').last();
        // Reveal the hover action bar
        await lastPost.hover();
        // The Reply button in the post action toolbar has aria-label="reply".
        // It is accessible only while the mouse is over the post (hover reveal).
        await this.page.getByRole('button', {name: 'reply', exact: true}).click();
        // Wait for the thread reply input to confirm the RHS is open
        await this.replyTextbox.waitFor();
    }

    // Asserts the thread RHS is open (the reply textbox is visible).
    async expectThreadOpen(): Promise<void> {
        await expect(this.replyTextbox).toBeVisible();
    }

    // Closes the currently open RHS panel.
    async close(): Promise<void> {
        await this.closeButton.click();
    }
}
