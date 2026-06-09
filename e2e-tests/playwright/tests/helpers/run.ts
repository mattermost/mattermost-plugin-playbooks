// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {requestedWith} from './client';

interface CreateRunOptions {
    name: string;
    ownerUserId: string;
    teamId: string;
    playbookId: string;
}

export async function createRun(page: Page, options: CreateRunOptions) {
    const response = await page.request.post('/plugins/playbooks/api/v0/runs', {
        ...requestedWith,
        data: {
            name: options.name,
            owner_user_id: options.ownerUserId,
            team_id: options.teamId,
            playbook_id: options.playbookId,
        },
    });

    if (response.status() !== 201) {
        throw new Error(`Unable to create run: ${response.status()} ${await response.text()}`);
    }
}
