// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {readJsonOrThrow, requestedWith} from './client';

interface Checklist {
    title: string;
    items: Array<{title: string}>;
}

export interface CustomPhase {
    id: string;
    title: string;
}

export interface Playbook {
    id: string;
    title: string;
    phases_enabled: boolean;
    use_checklists_as_phases: boolean;

    // The API answers null, not an empty list, for a playbook without custom phases.
    custom_phases: CustomPhase[] | null;
    [setting: string]: unknown;
}

export interface CreatePlaybookOptions {
    checklists?: Checklist[];
    description?: string;

    // Phases made of the task lists. Turns phases on too, unless phasesEnabled says otherwise.
    useChecklistsAsPhases?: boolean;

    // Phases of their own, by name, in order. Turns phases on with task lists off, unless the other options say otherwise.
    customPhases?: string[];

    // Overrides whether phases are on, to build a playbook that keeps phase settings it does not use.
    phasesEnabled?: boolean;
}

// A phase id the server accepts: 26 letters and digits, like the ones the editor makes.
export function newPhaseId(): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length: 26}, () => characters[Math.floor(Math.random() * characters.length)]).join('');
}

// Creates a playbook as whoever the page is currently logged in as. The creator
// becomes a playbook member, which the editor requires for member-only actions
// (e.g. Rename).
export async function createPlaybook(page: Page, teamId: string, title: string, options: CreatePlaybookOptions = {}): Promise<Playbook> {
    const usesPhases = Boolean(options.useChecklistsAsPhases || options.customPhases);
    const createResponse = await page.request.post('/plugins/playbooks/api/v0/playbooks', {
        ...requestedWith,
        data: {
            title,
            team_id: teamId,
            public: true,
            description: options.description ?? '',
            checklists: options.checklists ?? [],
            phases_enabled: options.phasesEnabled ?? usesPhases,
            use_checklists_as_phases: options.useChecklistsAsPhases ?? false,
            custom_phases: (options.customPhases ?? []).map((phaseTitle) => ({id: newPhaseId(), title: phaseTitle})),
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

// The custom phases of a playbook as saved, an empty list when it has none.
export async function getCustomPhases(page: Page, playbookId: string): Promise<CustomPhase[]> {
    return (await getPlaybook(page, playbookId)).custom_phases ?? [];
}

// Archives (soft-deletes) a playbook the test created.
export async function archivePlaybook(page: Page, playbookId: string) {
    const response = await page.request.delete(`/plugins/playbooks/api/v0/playbooks/${playbookId}`, requestedWith);
    if (!response.ok()) {
        throw new Error(`Unable to archive playbook ${playbookId}: ${response.status()} ${await response.text()}`);
    }
}

// Saves changes to a playbook the way the editor does: the latest playbook with the changes on top.
// The raw response is returned so tests can assert on the status code.
export async function updatePlaybook(page: Page, playbookId: string, changes: Record<string, unknown>) {
    const latest = await getPlaybook(page, playbookId);
    return page.request.put(`/plugins/playbooks/api/v0/playbooks/${playbookId}`, {...requestedWith, data: {...latest, ...changes}});
}
