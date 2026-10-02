// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {request, type APIRequestContext, type FullConfig} from '@playwright/test';

import {readJsonOrThrow, requestedWith} from './client';

interface CurrentUser {
    id: string;
}

interface Team {
    id: string;
    name: string;
}

const adminUsername = process.env.MM_ADMIN_USERNAME || 'sysadmin';
const adminPassword = process.env.MM_ADMIN_PASSWORD || 'Sys@dmin-sample1';

// Match Cypress' default sysadmin team without sharing files across projects.
const defaultTeam = {
    name: 'ad-1',
    displayName: 'eligendi',
};

async function loginAsAdmin(apiContext: APIRequestContext) {
    const response = await apiContext.post('/api/v4/users/login', {
        ...requestedWith,
        data: {
            login_id: adminUsername,
            password: adminPassword,
        },
    });

    if (!response.ok()) {
        throw new Error(`Unable to login as sysadmin: ${response.status()} ${await response.text()}`);
    }
}

async function getCurrentUser(apiContext: APIRequestContext): Promise<CurrentUser> {
    const response = await apiContext.get('/api/v4/users/me', requestedWith);
    return readJsonOrThrow<CurrentUser>(response, 'Unable to fetch current user');
}

async function getTeamsForUser(apiContext: APIRequestContext, userId: string): Promise<Team[]> {
    const response = await apiContext.get(`/api/v4/users/${userId}/teams`, requestedWith);
    return readJsonOrThrow<Team[]>(response, `Unable to fetch teams for user ${userId}`);
}

async function getTeamByName(apiContext: APIRequestContext, teamName: string): Promise<Team | null> {
    const response = await apiContext.get(`/api/v4/teams/name/${teamName}`, requestedWith);

    if (response.status() === 404) {
        return null;
    }

    return readJsonOrThrow<Team>(response, `Unable to fetch team ${teamName}`);
}

async function createDefaultTeam(apiContext: APIRequestContext): Promise<Team> {
    const response = await apiContext.post('/api/v4/teams', {
        ...requestedWith,
        data: {
            name: defaultTeam.name,
            display_name: defaultTeam.displayName,
            type: 'O',
        },
    });

    return readJsonOrThrow<Team>(response, 'Unable to create default team');
}

async function addUserToTeam(apiContext: APIRequestContext, teamId: string, userId: string) {
    const response = await apiContext.post(`/api/v4/teams/${teamId}/members`, {
        ...requestedWith,
        data: {
            team_id: teamId,
            user_id: userId,
        },
    });

    if (response.ok()) {
        return;
    }

    const body = await response.text();
    if (response.status() === 400 && body.includes('already_member')) {
        return;
    }

    throw new Error(`Unable to add user ${userId} to team ${teamId}: ${response.status()} ${body}`);
}

// Normalises the server config to the values Cypress enforces in
// e2e-tests/cypress/tests/support/api/on_prem_default_config.json via
// sysadminSetup() in index.js. CI starts the server with EnableOpenServer=false
// (default when MM_TEAMSETTINGS_ENABLEOPENSERVER is not set) and may have
// CollapsedThreads in a non-disabled state when an enterprise license is
// present. Playwright's globalSetup sets both to the same values Cypress uses
// so the suite sees a predictable server regardless of CI defaults.
//
// Only the settings that materially affect the Playwright suite are patched;
// the rest of the config is left untouched (read-modify-write via GET + PUT).
async function ensureServerConfig(apiContext: APIRequestContext): Promise<void> {
    const getResp = await apiContext.get('/api/v4/config', requestedWith);
    if (!getResp.ok()) {
        throw new Error(`ensureServerConfig: unable to GET /api/v4/config: ${getResp.status()} ${await getResp.text()}`);
    }
    const config = await getResp.json() as Record<string, Record<string, unknown>>;

    // Patch only the settings we care about; leave everything else intact.
    config.ServiceSettings = {...config.ServiceSettings, CollapsedThreads: 'disabled'};
    config.TeamSettings = {...config.TeamSettings, EnableOpenServer: true};

    const putResp = await apiContext.put('/api/v4/config', {
        ...requestedWith,
        data: config,
    });
    if (!putResp.ok()) {
        throw new Error(
            `ensureServerConfig: unable to PUT /api/v4/config ` +
            `(server may have ReadOnlyConfig=true): ${putResp.status()} ${await putResp.text()}`,
        );
    }
}

export async function ensureAdminHasTeam(apiContext: APIRequestContext): Promise<Team> {
    await loginAsAdmin(apiContext);

    const currentUser = await getCurrentUser(apiContext);
    const teams = await getTeamsForUser(apiContext, currentUser.id);

    const existingDefaultTeam = teams.find((team) => team.name === defaultTeam.name);
    if (existingDefaultTeam) {
        return existingDefaultTeam;
    }

    if (teams.length > 0) {
        return teams[0];
    }

    const team = await getTeamByName(apiContext, defaultTeam.name) || await createDefaultTeam(apiContext);
    await addUserToTeam(apiContext, team.id, currentUser.id);

    return team;
}

export default async function globalSetup(config: FullConfig) {
    const projectUse = config.projects[0]?.use as {baseURL?: string} | undefined;
    const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || projectUse?.baseURL || 'http://localhost:8065';
    const apiContext = await request.newContext({baseURL});

    try {
        await ensureAdminHasTeam(apiContext);
        await ensureServerConfig(apiContext);
    } finally {
        await apiContext.dispose();
    }
}
