// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {APIResponse, Page} from '@playwright/test';

interface CurrentUser {
    id: string;
    username: string;
}

interface Team {
    id: string;
    name: string;
}

interface Checklist {
    title: string;
    items: Array<{title: string}>;
}

interface Playbook {
    id: string;
    title: string;
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

export interface SeededUser {
    id: string;
    username: string;
    password: string;
}

export interface SeededNavigationData {
    playbookTitle: string;
    runName: string;
    teamName: string;
}

export interface SeededCreationData {
    teamName: string;

    // The seeded user is a member of a second team as well, so the creation
    // specs exercise the "multiple teams" path (playbook must land in the
    // current team's LHS).
    secondTeamName: string;
    user: SeededUser;

    // A playbook seeded via the API so the backstage list view renders
    // immediately. This mirrors the Cypress creation spec, which seeds a
    // playbook to avoid the empty-list -> list-view flicker that makes
    // clicking "Create playbook" flaky.
    existingPlaybookTitle: string;
}

export interface SeededRestrictedCreationData {
    // A team scoped to a scheme whose member role cannot create playbooks.
    emptyTeamName: string;

    // A second restricted team that already contains a playbook (seeded by an
    // admin), used to assert the create button is hidden even when playbooks
    // are visible.
    populatedTeamName: string;
    populatedPlaybookTitle: string;

    // A restricted user that is a member of both teams above.
    user: SeededUser;
}

const seededUserPassword = 'Passwd123!';

const requestedWith = {headers: {'X-Requested-With': 'XMLHttpRequest'}};

function sanitizeTeamName(prefix: string) {
    return prefix.
        toLowerCase().
        replace(/[^a-z0-9-]+/g, '-').
        replace(/-{2,}/g, '-').
        replace(/^-|-$/g, '');
}

function buildUniqueSuffix() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readJsonOrThrow<T>(response: APIResponse, message: string): Promise<T> {
    if (!response.ok()) {
        throw new Error(`${message}: ${response.status()} ${await response.text()}`);
    }

    return await response.json() as T;
}

async function getCurrentUser(page: Page): Promise<CurrentUser> {
    const response = await page.request.get('/api/v4/users/me', requestedWith);
    return readJsonOrThrow<CurrentUser>(response, 'Unable to fetch current user');
}

async function createTeam(page: Page, teamPrefix: string): Promise<Team> {
    const suffix = buildUniqueSuffix();
    const normalizedPrefix = sanitizeTeamName(teamPrefix) || 'playwright';
    const teamNamespace = 'pw';
    const truncatedPrefix = normalizedPrefix.slice(0, Math.max(1, 60 - teamNamespace.length - suffix.length - 2));
    const name = `${teamNamespace}-${truncatedPrefix}-${suffix}`;

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

async function createUser(page: Page, userPrefix: string): Promise<SeededUser> {
    const suffix = buildUniqueSuffix().replace(/-/g, '');
    const normalizedPrefix = sanitizeTeamName(userPrefix) || 'playwright-user';
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

async function addUserToTeam(page: Page, teamId: string, userId: string) {
    const response = await page.request.post(`/api/v4/teams/${teamId}/members`, {
        ...requestedWith,
        data: {team_id: teamId, user_id: userId},
    });

    if (response.status() !== 201) {
        throw new Error(`Unable to add user ${userId} to team ${teamId}: ${response.status()} ${await response.text()}`);
    }
}

async function createPlaybook(page: Page, teamId: string, title: string, checklists: Checklist[]): Promise<Playbook> {
    const createPlaybookResponse = await page.request.post('/plugins/playbooks/api/v0/playbooks', {
        ...requestedWith,
        data: {
            title,
            team_id: teamId,
            public: true,
            members: [],
            checklists,
            reminder_timer_default_seconds: 86400,
            create_channel_member_on_new_participant: true,
        },
    });
    if (createPlaybookResponse.status() !== 201) {
        throw new Error(`Unable to create playbook: ${createPlaybookResponse.status()} ${await createPlaybookResponse.text()}`);
    }

    const playbookLocation = createPlaybookResponse.headers()['location'];
    if (!playbookLocation) {
        throw new Error('Playbook create response did not include a location header');
    }

    const playbookResponse = await page.request.get(playbookLocation, requestedWith);
    return readJsonOrThrow<Playbook>(playbookResponse, 'Unable to fetch created playbook');
}

async function createTeamScheme(page: Page, namePrefix: string): Promise<Scheme> {
    const response = await page.request.post('/api/v4/schemes', {
        ...requestedWith,
        data: {
            display_name: `${namePrefix} ${buildUniqueSuffix()}`,
            scope: 'team',
            description: 'Playwright restricted team scheme',
        },
    });

    if (response.status() !== 201) {
        throw new Error(`Unable to create team scheme: ${response.status()} ${await response.text()}`);
    }

    return await response.json() as Scheme;
}

async function setTeamScheme(page: Page, teamId: string, schemeId: string) {
    const response = await page.request.put(`/api/v4/teams/${teamId}/scheme`, {
        ...requestedWith,
        data: {scheme_id: schemeId},
    });

    if (!response.ok()) {
        throw new Error(`Unable to set scheme ${schemeId} on team ${teamId}: ${response.status()} ${await response.text()}`);
    }
}

async function getRoleByName(page: Page, roleName: string): Promise<Role> {
    const response = await page.request.post('/api/v4/roles/names', {
        ...requestedWith,
        data: [roleName],
    });

    const roles = await readJsonOrThrow<Role[]>(response, `Unable to fetch role ${roleName}`);
    if (roles.length === 0) {
        throw new Error(`Role ${roleName} not found`);
    }

    return roles[0];
}

async function patchRolePermissions(page: Page, roleId: string, permissions: string[]) {
    const response = await page.request.put(`/api/v4/roles/${roleId}/patch`, {
        ...requestedWith,
        data: {permissions},
    });

    if (!response.ok()) {
        throw new Error(`Unable to patch role ${roleId}: ${response.status()} ${await response.text()}`);
    }
}

// Logs in (via API) on the page's browser context, so subsequent navigations
// are authenticated. Used to test as a non-admin user without driving the
// Mattermost login UI.
export async function loginAs(page: Page, loginId: string, password: string) {
    const response = await page.request.post('/api/v4/users/login', {
        ...requestedWith,
        data: {login_id: loginId, password},
    });

    if (!response.ok()) {
        throw new Error(`Unable to login as ${loginId}: ${response.status()} ${await response.text()}`);
    }
}

export async function seedPlaybookNavigationData(page: Page, teamPrefix: string): Promise<SeededNavigationData> {
    const currentUser = await getCurrentUser(page);
    const team = await createTeam(page, teamPrefix);
    const playbookTitle = `PW Playbook ${buildUniqueSuffix()}`;
    const runName = `PW Run ${buildUniqueSuffix()}`;
    const playbook = await createPlaybook(page, team.id, playbookTitle, []);

    const createRunResponse = await page.request.post('/plugins/playbooks/api/v0/runs', {
        ...requestedWith,
        data: {
            name: runName,
            owner_user_id: currentUser.id,
            team_id: team.id,
            playbook_id: playbook.id,
        },
    });
    if (createRunResponse.status() !== 201) {
        throw new Error(`Unable to create run: ${createRunResponse.status()} ${await createRunResponse.text()}`);
    }

    return {
        playbookTitle,
        runName,
        teamName: team.name,
    };
}

// Seeds (as admin) the data the creation specs run against: a regular user that
// belongs to two teams, plus an existing playbook so the list view renders.
export async function seedPlaybookCreationData(adminPage: Page, prefix: string): Promise<SeededCreationData> {
    const team = await createTeam(adminPage, prefix);
    const secondTeam = await createTeam(adminPage, `${prefix}-second`);
    const user = await createUser(adminPage, `${prefix}-user`);

    await addUserToTeam(adminPage, team.id, user.id);
    await addUserToTeam(adminPage, secondTeam.id, user.id);

    const existingPlaybookTitle = `PW Existing Playbook ${buildUniqueSuffix()}`;
    await createPlaybook(adminPage, team.id, existingPlaybookTitle, []);

    return {
        teamName: team.name,
        secondTeamName: secondTeam.name,
        user,
        existingPlaybookTitle,
    };
}

// Seeds (as admin) a restricted user whose team member role cannot create
// playbooks: one empty team and one team that already holds a playbook.
export async function seedRestrictedCreationData(adminPage: Page, prefix: string): Promise<SeededRestrictedCreationData> {
    const scheme = await createTeamScheme(adminPage, `${prefix} scheme`);

    const emptyTeam = await createTeam(adminPage, `${prefix}-empty`);
    const populatedTeam = await createTeam(adminPage, `${prefix}-populated`);
    await setTeamScheme(adminPage, emptyTeam.id, scheme.id);
    await setTeamScheme(adminPage, populatedTeam.id, scheme.id);

    const user = await createUser(adminPage, `${prefix}-user`);
    await addUserToTeam(adminPage, emptyTeam.id, user.id);
    await addUserToTeam(adminPage, populatedTeam.id, user.id);

    const memberRole = await getRoleByName(adminPage, scheme.default_team_user_role);
    const permissions = memberRole.permissions.filter((perm) => !(/playbook_(private|public)_create/).test(perm));
    await patchRolePermissions(adminPage, memberRole.id, permissions);

    const populatedPlaybookTitle = `PW Restricted Playbook ${buildUniqueSuffix()}`;
    await createPlaybook(adminPage, populatedTeam.id, populatedPlaybookTitle, []);

    return {
        emptyTeamName: emptyTeam.name,
        populatedTeamName: populatedTeam.name,
        populatedPlaybookTitle,
        user,
    };
}
