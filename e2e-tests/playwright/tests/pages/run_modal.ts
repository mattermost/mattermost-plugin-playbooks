// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

// Page object for the "Run playbook" start-run modal
// (webapp/src/components/modals/run_playbook_modal.tsx).
export class RunModal {
    readonly page: Page;
    readonly dialog: Locator;
    readonly runNameInput: Locator;
    readonly summaryInput: Locator;
    readonly linkExistingChannelRadio: Locator;
    readonly createChannelRadio: Locator;
    readonly createPublicChannelRadio: Locator;
    readonly createPrivateChannelRadio: Locator;
    readonly channelSelector: Locator;
    readonly confirmButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.dialog = page.getByRole('dialog', {name: /run playbook/i});
        this.runNameInput = this.dialog.getByTestId('run-name-input');
        this.summaryInput = this.dialog.getByTestId('run-summary-input');
        this.linkExistingChannelRadio = this.dialog.getByTestId('link-existing-channel-radio');
        this.createChannelRadio = this.dialog.getByTestId('create-channel-radio');
        this.createPublicChannelRadio = this.dialog.getByTestId('create-public-channel-radio');
        this.createPrivateChannelRadio = this.dialog.getByTestId('create-private-channel-radio');
        this.channelSelector = this.dialog.getByTestId('link-existing-channel-selector');
        this.confirmButton = this.dialog.getByTestId('modal-confirm-button');
        this.cancelButton = this.dialog.getByTestId('modal-cancel-button');
    }

    async setRunName(name: string) {
        await this.runNameInput.fill(name);
    }

    async setSummary(summary: string) {
        await this.summaryInput.fill(summary);
    }

    async chooseLinkExistingChannel() {
        await this.linkExistingChannelRadio.check();
    }

    async chooseCreateChannel() {
        await this.createChannelRadio.check();
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
