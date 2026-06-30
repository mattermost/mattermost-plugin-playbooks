// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {readJsonOrThrow, requestedWith, slugify, uniqueSuffix} from './client';

export interface SeededUser {
    id: string;
    username: string;
    password: string;
}

interface CurrentUser {
    id: string;
    username: string;
}

const seededUserPassword = 'Passwd123!';

export async function getCurrentUser(page: Page): Promise<CurrentUser> {
    const response = await page.request.get('/api/v4/users/me', requestedWith);
    return readJsonOrThrow<CurrentUser>(response, 'Unable to fetch current user');
}

export async function createUser(page: Page, userPrefix: string): Promise<SeededUser> {
    const suffix = uniqueSuffix().replace(/-/g, '');
    const normalizedPrefix = slugify(userPrefix, 'playwright-user');
    const truncatedPrefix = normalizedPrefix.slice(0, Math.max(1, 40 - suffix.length - 1));
    const username = `${truncatedPrefix}-${suffix}`;

    const response = await page.request.post('/api/v4/users', {
        ...requestedWith,
        data: {
            email: `${username}@sample.mattermost.com`,
            username,
            password: seededUserPassword,
            first_name: username,
            last_name: '',
            nickname: '',
        },
    });

    const user = await readJsonOrThrow<SeededUser>(response, 'Unable to create user');
    return {...user, password: seededUserPassword};
}
