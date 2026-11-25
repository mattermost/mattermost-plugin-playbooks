// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {readJsonOrThrow, requestedWith} from './client';

interface Checklist {
    title: string;
    items: Array<{title: string}>;
}

export interface Playbook {
    id: string;
    title: string;
    use_checklists_as_phases: boolean;
    [setting: string]: unknown;
}

export interface CreatePlaybookOptions {
    checklists?: Checklist[];
    description?: string;
    useChecklistsAsPhases?: boolean;
}

// Creates a playbook as whoever the page is currently logged in as. The creator
// becomes a playbook member, which the editor requires for member-only actions
// (e.g. Rename).
export async function createPlaybook(page: Page, teamId: string, title: string, options: CreatePlaybookOptions = {}): Promise<Playbook> {
    const createResponse = await page.request.post('/plugins/playbooks/api/v0/playbooks', {
        ...requestedWith,
        data: {
            title,
            team_id: teamId,
            public: true,
            description: options.description ?? '',
            checklists: options.checklists ?? [],
            use_checklists_as_phases: options.useChecklistsAsPhases ?? false,
            reminder_timer_default_seconds: 86400,
            create_channel_member_on_new_participant: true,
        },
    });
    if (createResponse.status() !== 201) {
        throw new Error(`Unable to create playbook: ${createResponse.status()} ${await createResponse.text()}`);
    }

    const location = createResponse.headers()['location'];
    if (!location) {
        throw new Error('Playbook create response did not include a location header');
    }

    const playbookResponse = await page.request.get(location, requestedWith);
    return readJsonOrThrow<Playbook>(playbookResponse, 'Unable to fetch created playbook');
}

export async function getPlaybook(page: Page, playbookId: string): Promise<Playbook> {
    const response = await page.request.get(`/plugins/playbooks/api/v0/playbooks/${playbookId}`, requestedWith);
    return readJsonOrThrow<Playbook>(response, `Unable to fetch playbook ${playbookId}`);
}

// Archives (soft-deletes) a playbook the test created.
export async function archivePlaybook(page: Page, playbookId: string) {
    const response = await page.request.delete(`/plugins/playbooks/api/v0/playbooks/${playbookId}`, requestedWith);
    if (!response.ok()) {
        throw new Error(`Unable to archive playbook ${playbookId}: ${response.status()} ${await response.text()}`);
    }
}
