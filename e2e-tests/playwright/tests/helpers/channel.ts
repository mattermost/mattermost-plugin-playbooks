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
