// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {readJsonOrThrow, requestedWith, uniqueSuffix} from './client';

export interface Channel {
    id: string;
    name: string;
    display_name: string;
    team_id: string;
    type: string;
}

export interface CreateChannelOptions {
    type?: 'O' | 'P';
    displayName?: string;
}

// Creates a team channel (public 'O' or private 'P', defaulting to public).
export async function createChannel(page: Page, teamId: string, options: CreateChannelOptions = {}): Promise<Channel> {
    const suffix = uniqueSuffix();
    const response = await page.request.post('/api/v4/channels', {
        ...requestedWith,
        data: {
            team_id: teamId,
            name: `pw-channel-${suffix}`,
            display_name: options.displayName ?? `PW Channel ${suffix}`,
            type: options.type ?? 'O',
        },
    });

    return readJsonOrThrow<Channel>(response, 'Unable to create channel');
}

export async function createDirectChannel(page: Page, userIdA: string, userIdB: string): Promise<Channel> {
    const response = await page.request.post('/api/v4/channels/direct', {
        ...requestedWith,
        data: [userIdA, userIdB],
    });

    return readJsonOrThrow<Channel>(response, 'Unable to create direct channel');
}

export async function createGroupChannel(page: Page, userIds: string[]): Promise<Channel> {
    const response = await page.request.post('/api/v4/channels/group', {
        ...requestedWith,
        data: userIds,
    });

    return readJsonOrThrow<Channel>(response, 'Unable to create group channel');
}

export async function getChannel(page: Page, channelId: string): Promise<Channel> {
    const response = await page.request.get(`/api/v4/channels/${channelId}`, requestedWith);
    return readJsonOrThrow<Channel>(response, `Unable to fetch channel ${channelId}`);
}

// Creates a keyword-triggered "Prompt to run a playbook" channel action via the Playbooks REST
// API. When any of `keywords` is posted in `channelId`, a bot prompt will appear asking users to
// run the specified playbook.
export async function createKeywordRunPlaybookAction(
    page: Page,
    channelId: string,
    keywords: string[],
    playbookId: string,
): Promise<{id: string}> {
    const response = await page.request.post(
        `/plugins/playbooks/api/v0/actions/channels/${channelId}`,
        {
            ...requestedWith,
            data: {
                channel_id: channelId,
                enabled: true,
                action_type: 'prompt_run_playbook',
                trigger_type: 'keywords',
                payload: {keywords, playbook_id: playbookId},
            },
        },
    );
    return readJsonOrThrow<{id: string}>(response, `Unable to create channel action for channel ${channelId}`);
}

// Searches for channels in a team matching `term` (display name or name prefix).
export async function searchChannels(page: Page, teamId: string, term: string): Promise<Channel[]> {
    const response = await page.request.post(`/api/v4/teams/${teamId}/channels/search`, {
        ...requestedWith,
        data: {term},
    });
    return readJsonOrThrow<Channel[]>(response, `Unable to search channels in team ${teamId} for term "${term}"`);
}
