// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {readJsonOrThrow, requestedWith} from './client';

interface Checklist {
    title: string;
    items: Array<{title: string}>;
}

export interface PlaybookMember {
    user_id: string;
    roles?: string[];
}

export interface Playbook {
    id: string;
    title: string;
    team_id: string;
    public: boolean;
    checklists: Checklist[];
    members: PlaybookMember[];
    delete_at: number;
}

export interface CreatePlaybookOptions {
    checklists?: Checklist[];
    description?: string;
    public?: boolean;
    members?: PlaybookMember[];
}

// Creates a playbook as whoever the page is currently logged in as. The creator
// becomes a playbook member, which the editor requires for member-only actions
// (e.g. Rename), unless an explicit `members` list is provided.
export async function createPlaybook(page: Page, teamId: string, title: string, options: CreatePlaybookOptions = {}): Promise<Playbook> {
    const createResponse = await page.request.post('/plugins/playbooks/api/v0/playbooks', {
        ...requestedWith,
        data: {
            title,
            team_id: teamId,
            public: options.public ?? true,
            description: options.description ?? '',
            checklists: options.checklists ?? [],
            members: options.members,
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

// Full-replace update (PUT): fetches the current playbook, merges in `partial`,
// and sends the whole object back, matching how the editor itself saves.
export async function updatePlaybook(page: Page, playbookId: string, partial: Partial<Playbook>): Promise<void> {
    const current = await getPlaybook(page, playbookId);
    const response = await page.request.put(`/plugins/playbooks/api/v0/playbooks/${playbookId}`, {
        ...requestedWith,
        data: {...current, ...partial},
    });

    if (!response.ok()) {
        throw new Error(`Unable to update playbook ${playbookId}: ${response.status()} ${await response.text()}`);
    }
}

interface PatchPlaybookOptions {
    run_number_prefix?: string;
    channel_name_template?: string;
    channel_name_template_locked?: boolean;
}

// Partial update (PATCH): only supports the fields the server's patch endpoint
// accepts (see server/api/playbooks.go patchPlaybook). Use updatePlaybook() for
// anything else.
export async function patchPlaybook(page: Page, playbookId: string, partial: PatchPlaybookOptions): Promise<void> {
    const response = await page.request.patch(`/plugins/playbooks/api/v0/playbooks/${playbookId}`, {
        ...requestedWith,
        data: partial,
    });

    if (!response.ok()) {
        throw new Error(`Unable to patch playbook ${playbookId}: ${response.status()} ${await response.text()}`);
    }
}

export async function archivePlaybook(page: Page, playbookId: string): Promise<void> {
    const response = await page.request.delete(`/plugins/playbooks/api/v0/playbooks/${playbookId}`, requestedWith);

    if (!response.ok()) {
        throw new Error(`Unable to archive playbook ${playbookId}: ${response.status()} ${await response.text()}`);
    }
}
