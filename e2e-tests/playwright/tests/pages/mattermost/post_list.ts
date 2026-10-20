// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

// Wraps the Mattermost center-channel post list: asserting on specific posts,
// the most recent post, ephemeral posts, and system messages.
//
// Mattermost assigns data-testid="postMessageText_<postId>" to every rendered
// post-message body. Using that testid pattern (rather than CSS classes) is
// the most stable hook available in core Mattermost markup.
export class MattermostPostList {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // All rendered post-message bodies, identified by the stable Mattermost
    // testid. `.last()` and `.first()` give the most/least recent post.
    // Mattermost renders each post's message body with
    // data-testid="post-message-text".
    allPostMessages(): Locator {
        return this.page.getByTestId('post-message-text');
    }

    // Asserts that the most recent (bottom-most) post in the channel contains
    // the given text.
    async expectLastPostContains(text: string): Promise<void> {
        await expect(this.allPostMessages().last()).toContainText(text);
    }

    // The last post body (most recent message in the channel).
    lastPostMessage(): Locator {
        return this.allPostMessages().last();
    }

    // Clicks the "Yes, run playbook" action button inside the most recent bot post.
    // This button is rendered by Mattermost's post-action framework when a keyword-triggered
    // "Prompt to run a playbook" channel action fires. The button opens the RunModal.
    //
    // Note: the button is inside a post rendered in the center channel; it is part of
    // Mattermost's built-in post-action infrastructure (core UI), not plugin markup.
    async clickYesRunPlaybook(): Promise<void> {
        await this.page.getByRole('button', {name: /yes, run playbook/i}).click();
    }

    // Clicks the "Run playbook" item in the post action toolbar of the most recent
    // post. The action toolbar only appears on hover, and the "Run playbook" item
    // is registered by the Playbooks plugin under the post-level "actions" menu.
    //
    // Steps:
    //   1. Hover the last post to reveal the action toolbar.
    //   2. Click the "actions" button (the playbook icon) to open its dropdown.
    //   3. Click the "Run playbook" menuitem.
    //
    // The caller is expected to interact with the RunModal that opens next.
    async runPlaybookFromLastPost(): Promise<void> {
        // Hover the post body to make the action toolbar appear.
        await this.allPostMessages().last().hover();
        // The "actions" button is the post-level app/plugin actions dropdown.
        // Accessible name: "actions".
        await this.page.getByRole('button', {name: 'actions', exact: true}).click();
        // The "Run playbook" menuitem is registered by the Playbooks plugin.
        // Its accessible name has a leading icon character; regex match ignores it.
        await this.page.getByRole('menuitem', {name: /run playbook/i}).click();
    }

    // The first (oldest) post body in the channel.
    firstPostMessage(): Locator {
        return this.allPostMessages().first();
    }

    // Asserts that the first (oldest) post in the channel contains the given text.
    async expectFirstPostContains(text: string): Promise<void> {
        await expect(this.firstPostMessage()).toContainText(text);
    }

    // Asserts that at least one post in the channel contains the given text.
    // Uses toContainText on the first matching post via filter.
    async expectAnyPostContains(text: string): Promise<void> {
        await expect(this.allPostMessages().filter({hasText: text}).first()).toBeVisible();
    }

    // Asserts that NO post in the channel contains the given text.
    async expectNoPostContains(text: string): Promise<void> {
        await expect(this.allPostMessages().filter({hasText: text})).toHaveCount(0);
    }

    // Asserts that an ephemeral ("only visible to you") post containing `text`
    // is visible. In Mattermost, ephemeral posts show the indicator text
    // "Only visible to you" alongside the message body. The `postContent`
    // testid is present on every rendered post; filtering by both the
    // indicator text and the expected message text uniquely identifies the
    // ephemeral post.
    async expectEphemeral(text: string): Promise<void> {
        await expect(
            this.page
                .getByTestId('postContent')
                .filter({hasText: 'Only visible to you'})
                .filter({hasText: text}),
        ).toBeVisible();
    }
}
