// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type Locator, type Page} from '@playwright/test';

// Wraps the Mattermost left-hand sidebar (LHS): channel links, DM/GM entries,
// the Threads entry, and category headers.
//
// The accessible name of a channel link in the LHS is built by Mattermost as
// "<displayName> <type>" (e.g. "town square public channel", "off-topic public
// channel"). Pass that combined string to `channelLink()` / `waitForChannel()`.
export class MattermostSidebar {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // Returns the LHS sidebar link for a channel identified by its accessible
    // name. The accessible name Mattermost renders is the channel display name
    // followed by the channel type keyword, e.g. "town square public channel".
    channelLink(accessibleName: string): Locator {
        return this.page.getByRole('link', {name: accessibleName});
    }

    // Waits until the sidebar link for `accessibleName` is visible.
    // Use this to confirm the LHS has rendered and the team context is set
    // before navigating to a team-agnostic URL (e.g. /playbooks/...).
    async waitForChannel(accessibleName: string): Promise<void> {
        await this.channelLink(accessibleName).waitFor();
    }
}
