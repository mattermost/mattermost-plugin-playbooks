// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {readJsonOrThrow, requestedWith, slugify, uniqueSuffix} from './client';

export interface Team {
    id: string;
    name: string;
}

interface Scheme {
    id: string;
    default_team_user_role: string;
}

interface Role {
    id: string;
    name: string;
    permissions: string[];
}

export async function createTeam(page: Page, teamPrefix: string): Promise<Team> {
    const suffix = uniqueSuffix();
    const namespace = 'pw';
    const normalizedPrefix = slugify(teamPrefix, 'playwright');
    const truncatedPrefix = normalizedPrefix.slice(0, Math.max(1, 60 - namespace.length - suffix.length - 2));
    const name = `${namespace}-${truncatedPrefix}-${suffix}`;

    const response = await page.request.post('/api/v4/teams', {
        ...requestedWith,
        data: {
            name,
            display_name: `${teamPrefix} ${suffix}`,
            type: 'O',
        },
    });

    return readJsonOrThrow<Team>(response, 'Unable to create team');
}

export async function addUserToTeam(page: Page, teamId: string, userId: string) {
    const response = await page.request.post(`/api/v4/teams/${teamId}/members`, {
        ...requestedWith,
        data: {team_id: teamId, user_id: userId},
    });

    if (response.status() !== 201) {
        throw new Error(`Unable to add user ${userId} to team ${teamId}: ${response.status()} ${await response.text()}`);
    }
}

export async function createTeamScheme(page: Page, namePrefix: string): Promise<Scheme> {
    const response = await page.request.post('/api/v4/schemes', {
        ...requestedWith,
        data: {
            display_name: `${namePrefix} ${uniqueSuffix()}`,
            scope: 'team',
            description: 'Playwright restricted team scheme',
        },
    });

    if (response.status() !== 201) {
        throw new Error(`Unable to create team scheme: ${response.status()} ${await response.text()}`);
    }

    return await response.json() as Scheme;
}

export async function setTeamScheme(page: Page, teamId: string, schemeId: string) {
    const response = await page.request.put(`/api/v4/teams/${teamId}/scheme`, {
        ...requestedWith,
        data: {scheme_id: schemeId},
    });

    if (!response.ok()) {
        throw new Error(`Unable to set scheme ${schemeId} on team ${teamId}: ${response.status()} ${await response.text()}`);
    }
}

export async function getTeamMemberRole(page: Page, scheme: Scheme): Promise<Role> {
    const response = await page.request.post('/api/v4/roles/names', {
        ...requestedWith,
        data: [scheme.default_team_user_role],
    });

    const roles = await readJsonOrThrow<Role[]>(response, `Unable to fetch role ${scheme.default_team_user_role}`);
    if (roles.length === 0) {
        throw new Error(`Role ${scheme.default_team_user_role} not found`);
    }

    return roles[0];
}

export async function setRolePermissions(page: Page, roleId: string, permissions: string[]) {
    const response = await page.request.put(`/api/v4/roles/${roleId}/patch`, {
        ...requestedWith,
        data: {permissions},
    });

    if (!response.ok()) {
        throw new Error(`Unable to patch role ${roleId}: ${response.status()} ${await response.text()}`);
    }
}
