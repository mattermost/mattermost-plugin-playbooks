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

    // Template/preview elements
    readonly runNamePreview: Locator;
    readonly runNamePreviewError: Locator;
    readonly runNameError: Locator;
    readonly runNameReadonlyDesc: Locator;

    // new_channel_only enforcement hint
    readonly newChannelOnlyHint: Locator;

    // "Create new playbook" button (only visible in the select-playbook step)
    readonly createNewPlaybookButton: Locator;

    // Attributes section header (only shown when property-field template tokens are present)
    readonly attributesSectionHeader: Locator;

    constructor(page: Page) {
        this.page = page;
        this.dialog = page.getByRole('dialog', {name: /run playbook/i});
        this.runNameInput = this.dialog.getByTestId('run-name-input');
        this.summaryInput = this.dialog.getByTestId('run-summary-input');
        this.linkExistingChannelRadio = this.dialog.getByTestId('link-existing-channel-radio');
        this.createChannelRadio = this.dialog.getByTestId('create-channel-radio');
        this.createPublicChannelRadio = this.dialog.getByTestId('create-public-channel-radio');
        this.createPrivateChannelRadio = this.dialog.getByTestId('create-private-channel-radio');
        // The StyledChannelSelector component (react-select) renders with id="link-existing-channel-selector"
        // but does NOT forward data-testid to the DOM — only the id attribute is present.
        this.channelSelector = this.dialog.locator('#link-existing-channel-selector');
        this.confirmButton = this.dialog.getByTestId('modal-confirm-button');
        this.cancelButton = this.dialog.getByTestId('modal-cancel-button');

        this.runNamePreview = this.dialog.getByTestId('run-name-preview');
        this.runNamePreviewError = this.dialog.getByTestId('run-name-preview-error');
        this.runNameError = this.dialog.getByTestId('run-name-error');
        this.runNameReadonlyDesc = this.dialog.getByTestId('run-name-readonly-desc');

        this.newChannelOnlyHint = this.dialog.getByTestId('new-channel-only-hint');

        // The "Create new playbook" button is in the modal header when no playbook is pre-selected
        this.createNewPlaybookButton = this.dialog.getByRole('button', {name: /create new playbook/i});

        // "Attributes" heading only appears when the playbook template references property fields
        this.attributesSectionHeader = this.dialog.getByText('Attributes', {exact: true});
    }

    // Waits for the run-details step to be fully loaded (loading spinner resolved).
    // Always call this after `selectPlaybook()` or after opening the modal from an editor
    // to ensure the playbook data is loaded before interacting with the form fields.
    async waitForDetailsLoaded() {
        // The run-name input only renders in the run-details step after loading completes.
        await this.runNameInput.waitFor({state: 'attached'});
    }

    // Returns true when the modal is showing the playbook-picker step.
    // The picker step is active when the run-name input has NOT yet rendered —
    // that input only appears in the run-details step (after a playbook is selected).
    // When only one playbook is available it is auto-selected and the modal jumps
    // directly to the run-details step, bypassing the picker entirely.
    async isPlaybookPickerShowing(): Promise<boolean> {
        // runNameInput is only rendered in the run-details step; its absence means the
        // picker (or a loading state) is still active.
        return await this.runNameInput.count() === 0;
    }

    // Selects the given playbook in the picker step only if the picker is currently visible.
    // A no-op when the modal has already skipped the picker (e.g. single playbook or
    // playbook pre-selected from an editor/list context).
    async selectPlaybookIfNeeded(playbookTitle: string): Promise<void> {
        if (await this.isPlaybookPickerShowing()) {
            await this.selectPlaybook(playbookTitle);
        }
    }

    async setRunName(name: string) {
        await this.runNameInput.fill(name);
    }

    async setSummary(summary: string) {
        await this.summaryInput.fill(summary);
    }

    async chooseLinkExistingChannel() {
        // Use .click() because .check() on a controlled React radio may not fire
        // the onChange handler in all Playwright/React combinations.
        await this.linkExistingChannelRadio.click();
    }

    async chooseCreateChannel() {
        // Use .click() for the same reason as chooseLinkExistingChannel.
        await this.createChannelRadio.click();
    }

    // Selects a playbook by title in the "select-playbook" step and waits for the
    // run-details step to fully load (playbook data fetched via API).
    async selectPlaybook(playbookTitle: string) {
        await this.dialog.getByText(playbookTitle).click();
        await this.waitForDetailsLoaded();
    }

    // Types into the channel selector's search input and picks the first matching result.
    // The selector is a react-select rendered with id="link-existing-channel-selector".
    // React-select renders options with CSS class 'playbooks-rselect__option' (not role='option').
    // Clicking the control opens the dropdown; typing filters it; clicking the option selects it.
    async selectChannel(term: string) {
        // Click the inner control to open the dropdown
        await this.channelSelector.locator('.playbooks-rselect__control').click();
        // Type the search term to filter options
        await this.page.keyboard.type(term);
        // Wait for the first matching option and click it
        await this.page.locator('.playbooks-rselect__option').first().click();
    }

    async submit() {
        await this.confirmButton.click();
    }

    async cancel() {
        await this.cancelButton.click();
    }

    // ── Expectations ────────────────────────────────────────────────────────

    async expectOpen() {
        await expect(this.dialog).toBeVisible();
    }

    async expectClosed() {
        await expect(this.dialog).toHaveCount(0);
    }

    async expectRunNameValue(value: string) {
        await expect(this.runNameInput).toHaveValue(value);
    }

    async expectRunNameReadOnly() {
        await expect(this.runNameInput).toHaveAttribute('readonly');
    }

    async expectRunNameEditable() {
        await expect(this.runNameInput).not.toHaveAttribute('readonly');
    }

    async expectSummaryValue(value: string) {
        await expect(this.summaryInput).toHaveValue(value);
    }

    async expectSubmitEnabled() {
        await expect(this.confirmButton).toBeEnabled();
    }

    async expectSubmitDisabled() {
        await expect(this.confirmButton).toBeDisabled();
    }

    async expectPreviewContains(text: string) {
        await expect(this.runNamePreview).toContainText(text);
    }

    async expectPreviewNotContains(text: string) {
        await expect(this.runNamePreview).not.toContainText(text);
    }

    async expectNoPreview() {
        await expect(this.runNamePreview).toHaveCount(0);
    }

    async expectPreviewErrorContains(text: string) {
        await expect(this.runNamePreviewError).toContainText(text);
    }

    async expectNameErrorContains(text: string) {
        await expect(this.runNameError).toContainText(text);
    }

    async expectNoNameError() {
        await expect(this.runNameError).toHaveCount(0);
    }

    async expectChannelSelectorVisible() {
        await expect(this.channelSelector).toBeVisible();
    }

    async expectChannelSelectorHidden() {
        await expect(this.channelSelector).toHaveCount(0);
    }

    async expectChannelSelectorPlaceholder(text: string) {
        // Wait for the selector to render (it only appears when link-existing mode is active)
        await this.channelSelector.waitFor({state: 'visible'});
        await expect(this.channelSelector).toContainText(text);
    }

    async expectNewChannelOnlyHintVisible() {
        await expect(this.newChannelOnlyHint).toBeVisible();
    }

    async expectNewChannelOnlyHintHidden() {
        await expect(this.newChannelOnlyHint).toHaveCount(0);
    }

    async expectLinkExistingChannelRadioDisabled() {
        await expect(this.linkExistingChannelRadio).toBeDisabled();
    }

    async expectLinkExistingChannelRadioEnabled() {
        await expect(this.linkExistingChannelRadio).toBeEnabled();
    }

    async expectCreateChannelRadioChecked() {
        await expect(this.createChannelRadio).toBeChecked();
    }

    async expectCreateChannelRadioEnabled() {
        await expect(this.createChannelRadio).toBeEnabled();
    }

    async expectNoOptionalLabel() {
        await expect(this.dialog.getByText('(optional)', {exact: true})).toHaveCount(0);
    }

    async expectNoAttributesSection() {
        await expect(this.attributesSectionHeader).toHaveCount(0);
    }

    // Types into the channel-selector search input without selecting any option.
    // The react-select container has id="link-existing-channel-selector";
    // clicking the inner control opens the dropdown and focuses the search input.
    async typeInChannelSelector(term: string) {
        // Click the inner control to open the dropdown and focus the search input
        await this.channelSelector.locator('.playbooks-rselect__control').click();
        // Type via keyboard (the hidden search input now has focus)
        await this.page.keyboard.type(term);
    }

    // Asserts that no option matching `text` appears in the channel selector dropdown.
    // React-select renders options with class 'playbooks-rselect__option' (not role='option').
    // We wait for the dropdown to render, then assert no matching option exists.
    async expectChannelOptionAbsent(text: string) {
        // Wait briefly for the menu to appear (if it's going to)
        const menu = this.page.locator('.playbooks-rselect__menu');
        await expect(menu).toBeVisible();
        // Assert no option text matches the search term
        await expect(
            menu.locator('.playbooks-rselect__option', {hasText: text}),
        ).toHaveCount(0);
    }

    // Asserts that the "Unknown Channel" pill is not shown.
    // The pill renders when a channel-id is pre-selected but the channel data hasn't loaded.
    async expectNoUnknownChannelPill() {
        await expect(this.dialog.getByText('Unknown Channel')).toHaveCount(0);
    }

    // Asserts the Create Playbook dialog is open (opened when clicking "Create new playbook").
    async expectCreatePlaybookDialogOpen() {
        await expect(this.page.getByRole('dialog', {name: /create playbook/i})).toBeVisible();
    }
}
