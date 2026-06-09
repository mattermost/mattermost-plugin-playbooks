// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {APIResponse} from '@playwright/test';

// Mattermost rejects API calls without this header as potential CSRF.
export const requestedWith = {headers: {'X-Requested-With': 'XMLHttpRequest'}};

export async function readJsonOrThrow<T>(response: APIResponse, message: string): Promise<T> {
    if (!response.ok()) {
        throw new Error(`${message}: ${response.status()} ${await response.text()}`);
    }

    return await response.json() as T;
}

// A short unique token for naming seeded entities so parallel runs don't collide.
export function uniqueSuffix(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Normalizes a label into a valid Mattermost team/user name segment.
export function slugify(prefix: string, fallback: string): string {
    return prefix.
        toLowerCase().
        replace(/[^a-z0-9-]+/g, '-').
        replace(/-{2,}/g, '-').
        replace(/^-|-$/g, '') || fallback;
}
