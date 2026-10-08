// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

// Page object for the Mattermost interactive dialog opened by the `/playbook run` slash
// command (and the post-actions menu "Run playbook" item, which uses the same flow).
//
// This is a Mattermost-core interactive dialog (`OpenInteractiveDialog`) rendered by the
// Mattermost frontend, NOT the custom React RunModal component used by the playbook
// editor / backstage list entry points. The two dialogs share the same accessible name
// ("Run playbook") and similar button labels ("Start run" / "Cancel"), but differ in their
// field testids:
//
//   • InteractiveRunDialog (this class): run-name testid = "playbookRunNameinput"
//   • RunModal (plugin POM):              run-name testid = "run-name-input"
//
// Mattermost's interactive-dialog renderer assigns each field an id/testid following the
// convention "<fieldName>input" (where fieldName is the key from the Dialog schema, e.g.
// "playbookRunName" → testid "playbookRunNameinput").
//
// The dialog title is translated from "app.user.new_run.title" → "Run playbook".
// The submit button label comes from "app.user.new_run.submit_label" → "Start run".
export class InteractiveRunDialog {
    readonly page: Page;

    // The dialog element. Mattermost renders interactive dialogs with role="dialog";
    // the title ("Run playbook") is used as the accessible name.
    readonly dialog: Locator;

    // The run-name text input (field key "playbookRunName" → testid "playbookRunNameinput").
    readonly runNameInput: Locator;

    // The run-name field container (field key "playbookRunName" → testid "playbookRunName").
    // Includes the field label and any validation error text rendered below the input.
    readonly runNameField: Locator;

    // The playbook-select field container (field key "playbookID" → testid "playbookID").
    // Used to assert validation-error messages on the field wrapper.
    readonly playbookField: Locator;

    // Submit button ("Start run").
    readonly submitButton: Locator;

    // Cancel button ("Cancel").
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.dialog = page.getByRole('dialog', {name: /run playbook/i});
        this.runNameInput = this.dialog.getByTestId('playbookRunNameinput');
        this.runNameField = this.dialog.getByTestId('playbookRunName');
        this.playbookField = this.dialog.getByTestId('playbookID');
        this.submitButton = this.dialog.getByRole('button', {name: /start run/i});
        this.cancelButton = this.dialog.getByRole('button', {name: /cancel/i});
    }

    // Waits until the interactive run dialog is visible.
    async expectOpen(): Promise<void> {
        await expect(this.dialog).toBeVisible();
    }

    // Asserts the dialog is no longer in the DOM.
    async expectClosed(): Promise<void> {
        await expect(this.dialog).toHaveCount(0);
    }

    // Fills the run-name input field. Replaces any existing value.
    async setRunName(name: string): Promise<void> {
        await this.runNameInput.fill(name);
    }

    // Clicks the "Start run" submit button.
    async submit(): Promise<void> {
        await this.submitButton.click();
    }

    // Clicks the "Cancel" button.
    async cancel(): Promise<void> {
        await this.cancelButton.click();
    }

    // Asserts the dialog contains the given text (e.g. an owner name from the intro text).
    async expectContainsText(text: string): Promise<void> {
        await expect(this.dialog).toContainText(text);
    }

    // Asserts the dialog contains the "Run name" field label.
    async expectRunNameLabelVisible(): Promise<void> {
        await expect(this.dialog.getByText('Run name', {exact: false})).toBeVisible();
    }

    // Asserts the playbook-select field shows a "This field is required." validation error.
    // Mattermost interactive dialogs render the error message inside the field container
    // (data-testid="playbookID") when a required field is left empty and the form is submitted.
    async expectPlaybookRequired(): Promise<void> {
        await expect(this.playbookField).toContainText('This field is required.');
    }

    // Asserts the run-name field wrapper shows a "This field is required." validation error.
    // Mattermost interactive dialogs render the error message inside the field container
    // (data-testid="playbookRunName") when a required field is left empty and submitted.
    async expectRunNameRequired(): Promise<void> {
        await expect(this.runNameField).toContainText('This field is required.');
    }
}
