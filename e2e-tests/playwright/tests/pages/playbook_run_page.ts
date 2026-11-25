// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';

import {PhaseTimeline} from './phase_timeline';

export class PlaybookRunPage {
    readonly page: Page;
    readonly phases: PhaseTimeline;

    constructor(page: Page) {
        this.page = page;
        this.phases = new PhaseTimeline(page);
    }

    checklistHeader(title: string): Locator {
        return this.page.getByTestId('checklistHeader').filter({hasText: title});
    }

    // The task list's menu only shows while the pointer is over its header.
    async hoverChecklistHeader(title: string) {
        await this.checklistHeader(title).hover();
    }

    async goto(teamName: string, runId: string) {
        // Visit the team first so the current team (and its LHS) is set before
        // entering the (team-agnostic) run URL.
        await this.page.goto(`/${teamName}/channels/town-square`);
        await this.page.getByRole('link', {name: 'town square public channel'}).waitFor();

        // Updates reach the page over the websocket, so wait until it is connected: anything the
        // test changes before that would never be pushed to the page.
        const connected = new Promise<void>((resolve) => {
            this.page.on('websocket', (socket) => {
                socket.on('framereceived', (frame) => {
                    if (String(frame.payload).includes('"event":"hello"')) {
                        resolve();
                    }
                });
            });
        });
        await this.page.goto(`/playbooks/runs/${runId}`);
        await this.page.getByTestId('run-header-section').waitFor();
        await connected;
    }
}
