// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {readJsonOrThrow, requestedWith} from './client';

interface Checklist {
    title: string;
    items: Array<{title: string; command?: string}>;
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
    channel_mode?: string;
    channel_id?: string;
    channel_name_template?: string;
    channel_name_template_locked?: boolean;
    run_summary_template?: string;
    run_summary_template_enabled?: boolean;
    new_channel_only?: boolean;
    default_owner_enabled?: boolean;
    default_owner_id?: string;
    create_public_playbook_run?: boolean;
    next_run_number?: number;
    run_number_prefix?: string;
    // Run-start action fields
    invited_user_ids?: string[];
    invite_users_enabled?: boolean;
    broadcast_channel_ids?: string[];
    broadcast_enabled?: boolean;
    webhook_on_creation_urls?: string[];
    webhook_on_creation_enabled?: boolean;
    retrospective_enabled?: boolean;
    create_channel_member_on_new_participant?: boolean;
}

export interface CreatePlaybookOptions {
    checklists?: Checklist[];
    description?: string;
    public?: boolean;
    members?: PlaybookMember[];
    // Run-start action settings
    invitedUserIds?: string[];
    inviteUsersEnabled?: boolean;
    defaultOwnerId?: string;
    defaultOwnerEnabled?: boolean;
    broadcastChannelIds?: string[];
    broadcastEnabled?: boolean;
    webhookOnCreationUrls?: string[];
    webhookOnCreationEnabled?: boolean;
    retrospectiveEnabled?: boolean;
    createPublicPlaybookRun?: boolean;
    // Auto-archive: when true, the run channel is archived when the run is finished.
    autoArchiveChannel?: boolean;
    // Channel mode for the playbook: 'create_new_channel' (default) or 'link_existing_channel'.
    channelMode?: 'create_new_channel' | 'link_existing_channel';
    // When channelMode is 'link_existing_channel', the id of the channel to link.
    channelId?: string;
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
            // Run-start action settings (only sent when explicitly provided)
            ...(options.invitedUserIds !== undefined && {invited_user_ids: options.invitedUserIds}),
            ...(options.inviteUsersEnabled !== undefined && {invite_users_enabled: options.inviteUsersEnabled}),
            ...(options.defaultOwnerId !== undefined && {default_owner_id: options.defaultOwnerId}),
            ...(options.defaultOwnerEnabled !== undefined && {default_owner_enabled: options.defaultOwnerEnabled}),
            ...(options.broadcastChannelIds !== undefined && {broadcast_channel_ids: options.broadcastChannelIds}),
            ...(options.broadcastEnabled !== undefined && {broadcast_enabled: options.broadcastEnabled}),
            ...(options.webhookOnCreationUrls !== undefined && {webhook_on_creation_urls: options.webhookOnCreationUrls}),
            ...(options.webhookOnCreationEnabled !== undefined && {webhook_on_creation_enabled: options.webhookOnCreationEnabled}),
            ...(options.retrospectiveEnabled !== undefined && {retrospective_enabled: options.retrospectiveEnabled}),
            ...(options.createPublicPlaybookRun !== undefined && {create_public_playbook_run: options.createPublicPlaybookRun}),
            ...(options.autoArchiveChannel !== undefined && {auto_archive_channel: options.autoArchiveChannel}),
            ...(options.channelMode !== undefined && {channel_mode: options.channelMode}),
            ...(options.channelId !== undefined && {channel_id: options.channelId}),
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
    new_channel_only?: boolean;
    channel_mode?: string;
    channel_id?: string;
    run_summary_template?: string;
    run_summary_template_enabled?: boolean;
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

export interface PropertyFieldInput {
    name: string;
    type: string;
    attrs?: Record<string, unknown>;
}

// Adds a property field to a playbook via GraphQL (the REST API does not expose this yet).
// operationName is required by the server outside developer/testing mode: without it, the
// GraphQL handler returns an empty 200 body ('Invalid blank operation name').
export async function addPlaybookPropertyField(page: Page, playbookId: string, field: PropertyFieldInput): Promise<void> {
    const response = await page.request.post('/plugins/playbooks/api/v0/query', {
        ...requestedWith,
        data: {
            operationName: 'AddPlaybookPropertyField',
            query: `mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
                addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
            }`,
            variables: {playbookID: playbookId, propertyField: field},
        },
    });

    if (!response.ok()) {
        throw new Error(`Unable to add property field to playbook ${playbookId}: ${response.status()} ${await response.text()}`);
    }

    const text = await response.text();
    if (!text) {
        throw new Error(`addPlaybookPropertyField: server returned empty response body — operationName may be missing or server is not in developer mode`);
    }

    const body = JSON.parse(text) as {errors?: Array<{message: string}>};
    if (body.errors?.length) {
        throw new Error(`addPlaybookPropertyField failed: ${JSON.stringify(body.errors)}`);
    }
}

export async function archivePlaybook(page: Page, playbookId: string): Promise<void> {
    const response = await page.request.delete(`/plugins/playbooks/api/v0/playbooks/${playbookId}`, requestedWith);

    if (!response.ok()) {
        throw new Error(`Unable to archive playbook ${playbookId}: ${response.status()} ${await response.text()}`);
    }
}
