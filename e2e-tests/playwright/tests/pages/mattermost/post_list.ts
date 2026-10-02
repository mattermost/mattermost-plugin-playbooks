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
