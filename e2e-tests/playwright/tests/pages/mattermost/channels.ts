// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type Locator, type Page} from '@playwright/test';

// Wraps Mattermost core channel-level UI: navigating to channels, DMs and GMs;
// the post composition textbox; sending messages and slash commands.
//
// Core Mattermost markup is not owned by this repo, so accessibility-first
// locators are used where available. The `#post_textbox` id is a stable
// Mattermost infrastructure hook (not a plugin element); it is documented here
// so it does not leak into plugin page objects or specs.
export class MattermostChannels {
    readonly page: Page;

    // The main post-composition textbox.
    // Mattermost assigns id="post_textbox" to the visible post input.
    // This id is stable Mattermost infrastructure and is wrapped here so
    // plugin page objects never locate it directly.
    readonly postTextbox: Locator;

    constructor(page: Page) {
        this.page = page;
        this.postTextbox = page.locator('#post_textbox');
    }

    // Navigates to a channel by team and channel name, then waits for the
    // post textbox to be ready. Waiting for the textbox confirms the channel
    // content is loaded and the Redux team context is set — safe to navigate
    // onward to team-agnostic plugin routes after this resolves.
    async goto(teamName: string, channelName: string): Promise<void> {
        await this.page.goto(`/${teamName}/channels/${channelName}`);
        await this.postTextbox.waitFor();
    }

    // Navigates to the DM channel for a given username.
    async gotoDirectMessage(teamName: string, username: string): Promise<void> {
        await this.page.goto(`/${teamName}/messages/@${username}`);
        await this.postTextbox.waitFor();
    }

    // Navigates to a GM channel by its channel name (URL slug, not display name).
    async gotoGroupMessage(gmChannelName: string): Promise<void> {
        await this.page.goto(`/messages/${gmChannelName}`);
        await this.postTextbox.waitFor();
    }

    // Types a message into the post textbox and sends it by pressing Enter.
    // Uses keyboard.type() rather than fill() because the Mattermost Advanced
    // Text Editor is a contenteditable div: fill() does not reliably fire the
    // React synthetic events needed to enable the Send button / Enter submission.
    async postMessage(text: string): Promise<void> {
        await this.postTextbox.click();
        await this.page.keyboard.type(text);
        await this.page.keyboard.press('Enter');
    }

    // Types and submits a slash command. The '/' prefix must be included by
    // the caller (e.g. `await mm.channels.runSlashCommand('/playbook info')`).
    // Uses keyboard.type to keep the slash character and avoid triggering
    // React-controlled fill edge cases. Submits by clicking the Send button
    // (data-testid="SendMessageButton") rather than pressing Enter, to avoid
    // the slash-command autocomplete dropdown intercepting the Enter key press.
    async runSlashCommand(cmd: string): Promise<void> {
        await this.postTextbox.click();
        await this.page.keyboard.type(cmd);
        await this.page.getByTestId('SendMessageButton').click();
    }
}
