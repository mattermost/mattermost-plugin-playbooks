// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// MattermostCore — the single facade for all core Mattermost UI interactions.
//
// Plugin page objects and specs must NEVER locate core Mattermost UI directly
// (no `page.locator('#post_textbox')`, no sidebar-link `getByRole('link')`,
// no `#app-bar-icon-*` in plugin code). All such interactions go through this
// facade and its sub-classes in `tests/pages/mattermost/`.
//
// Usage:
//   import {MattermostCore} from '../pages/mattermost';
//   const mm = new MattermostCore(page);
//   await mm.channels.goto(teamName, 'town-square');
//   await mm.channels.postMessage('hello');
//   await mm.postList.expectLastPostContains('hello');
//   await mm.appBar.openPlaybooks();

import {type Page} from '@playwright/test';

import {MattermostAppBar} from './app_bar';
import {MattermostChannels} from './channels';
import {MattermostPostList} from './post_list';
import {MattermostCoreRhs} from './rhs';
import {MattermostSidebar} from './sidebar';
import {MattermostSystemConsole} from './system_console';

export {MattermostAppBar} from './app_bar';
export {MattermostChannels} from './channels';
export {MattermostPostList} from './post_list';
export {MattermostCoreRhs} from './rhs';
export {MattermostSidebar} from './sidebar';
export {MattermostSystemConsole} from './system_console';

export class MattermostCore {
    // Channel navigation, post textbox, sending messages, slash commands.
    readonly channels: MattermostChannels;

    // LHS sidebar: channel links, waiting for a channel to appear.
    readonly sidebar: MattermostSidebar;

    // Right-side app bar icons (Playbooks icon, etc.).
    readonly appBar: MattermostAppBar;

    // Center-channel post list: last-post assertions, ephemeral-message checks.
    readonly postList: MattermostPostList;

    // Core RHS wrapper: thread view, close button.
    // The Playbooks RHS content is in ChannelRhs (plugin page object).
    readonly rhs: MattermostCoreRhs;

    // System Console navigation (admin-only routes).
    readonly systemConsole: MattermostSystemConsole;

    constructor(page: Page) {
        this.channels = new MattermostChannels(page);
        this.sidebar = new MattermostSidebar(page);
        this.appBar = new MattermostAppBar(page);
        this.postList = new MattermostPostList(page);
        this.rhs = new MattermostCoreRhs(page);
        this.systemConsole = new MattermostSystemConsole(page);
    }
}
