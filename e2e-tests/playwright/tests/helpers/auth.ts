// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {APIResponse, Page} from '@playwright/test';

interface CurrentUser {
    id: string;
}

interface Team {
    id: string;
    name: string;
}

interface SeededUser {
    id: string;
    username: string;
    password: string;
}

interface ChecklistItem {
    id?: string;
    title: string;
    assignee_id?: string;
    condition_id?: string;
}

interface Checklist {
    title: string;
    items: ChecklistItem[];
}

interface Playbook {
    id: string;
    title: string;
    checklists: Checklist[];
}

interface PlaybookCondition {
    id: string;
}

interface PropertyField {
    id: string;
}

export interface SeededNavigationData {
    playbookTitle: string;
    runName: string;
    teamName: string;
}

export interface SeededBulkEditTeamData {
    teamId: string;
    teamName: string;
    adminUserId: string;
    assigneeUser: SeededUser;
}

export interface SeededBulkEditPlaybookData {
    playbookId: string;
    playbookTitle: string;
    teamName: string;
    assigneeUser: SeededUser;
    conditionMatcher: string;
    checklistTitles: {
        primary: string;
        secondary: string;
    };
    taskTitles: {
        conditionAnchor: string;
        clearSelectionA: string;
        clearSelectionB: string;
        deleteA: string;
        deleteB: string;
        assignA: string;
        assignB: string;
        conditionTarget: string;
    };
}

interface SeedPlaybookOutlineBulkEditDataOptions {
    archived?: boolean;
    includeCondition?: boolean;
}

const requestedWith = {headers: {'X-Requested-With': 'XMLHttpRequest'}};
const requestedWithJson = {
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
};

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

function makePlaybookTitle(prefix: string, suffix: string) {
    return `PW ${prefix} ${suffix}`;
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

async function createUser(page: Page, prefix: string): Promise<SeededUser> {
    const suffix = buildUniqueSuffix().replace(/-/g, '');
    const normalizedPrefix = sanitizeTeamName(prefix) || 'playwright-user';
    const truncatedPrefix = normalizedPrefix.slice(0, Math.max(1, 40 - suffix.length - 1));
    const username = `${truncatedPrefix}-${suffix}`;
    const password = 'Passwd123!';

    const response = await page.request.post('/api/v4/users', {
        ...requestedWith,
        data: {
            email: `${username}@sample.mattermost.com`,
            username,
            password,
            first_name: username,
            last_name: '',
            nickname: '',
        },
    });

    const user = await readJsonOrThrow<SeededUser>(response, 'Unable to create user');
    return {
        ...user,
        password,
    };
}

async function addUserToTeam(page: Page, teamId: string, userId: string) {
    const response = await page.request.post(`/api/v4/teams/${teamId}/members`, {
        ...requestedWith,
        data: {
            team_id: teamId,
            user_id: userId,
        },
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

async function updatePlaybook(page: Page, playbook: Playbook): Promise<Playbook> {
    const response = await page.request.put(`/plugins/playbooks/api/v0/playbooks/${playbook.id}`, {
        ...requestedWithJson,
        data: JSON.stringify(playbook),
    });

    if (!response.ok()) {
        throw new Error(`Unable to update playbook ${playbook.id}: ${response.status()} ${await response.text()}`);
    }

    return playbook;
}

async function archivePlaybook(page: Page, playbookId: string) {
    const response = await page.request.delete(`/plugins/playbooks/api/v0/playbooks/${playbookId}`, requestedWith);
    if (response.status() !== 204) {
        throw new Error(`Unable to archive playbook ${playbookId}: ${response.status()} ${await response.text()}`);
    }
}

async function createPlaybookPropertyField(page: Page, playbookId: string, name: string): Promise<PropertyField> {
    const response = await page.request.post(`/plugins/playbooks/api/v0/playbooks/${playbookId}/property_fields`, {
        ...requestedWith,
        data: {
            name,
            type: 'text',
        },
    });

    return readJsonOrThrow<PropertyField>(response, `Unable to create property field for playbook ${playbookId}`);
}

async function createPlaybookCondition(page: Page, playbookId: string, fieldId: string, conditionValue: string): Promise<PlaybookCondition> {
    const response = await page.request.post(`/plugins/playbooks/api/v0/playbooks/${playbookId}/conditions`, {
        ...requestedWith,
        data: {
            version: 1,
            playbook_id: playbookId,
            condition_expr: {
                is: {
                    field_id: fieldId,
                    value: conditionValue,
                },
            },
        },
    });

    return readJsonOrThrow<PlaybookCondition>(response, `Unable to create condition for playbook ${playbookId}`);
}

export async function seedBulkEditTeamData(page: Page, teamPrefix: string): Promise<SeededBulkEditTeamData> {
    const currentUser = await getCurrentUser(page);
    const team = await createTeam(page, teamPrefix);
    const assigneeUser = await createUser(page, `${teamPrefix}-assignee`);

    await addUserToTeam(page, team.id, assigneeUser.id);

    return {
        teamId: team.id,
        teamName: team.name,
        adminUserId: currentUser.id,
        assigneeUser,
    };
}

export async function seedPlaybookOutlineBulkEditData(
    page: Page,
    teamData: SeededBulkEditTeamData,
    playbookPrefix: string,
    options: SeedPlaybookOutlineBulkEditDataOptions = {},
): Promise<SeededBulkEditPlaybookData> {
    const suffix = buildUniqueSuffix();
    const labelPrefix = makePlaybookTitle(playbookPrefix, suffix);
    const checklistTitles = {
        primary: `${labelPrefix} Primary Tasks`,
        secondary: `${labelPrefix} Secondary Tasks`,
    };
    const taskTitles = {
        conditionAnchor: `${labelPrefix} Condition Anchor`,
        clearSelectionA: `${labelPrefix} Clear Selection A`,
        clearSelectionB: `${labelPrefix} Clear Selection B`,
        deleteA: `${labelPrefix} Delete A`,
        deleteB: `${labelPrefix} Delete B`,
        assignA: `${labelPrefix} Assign A`,
        assignB: `${labelPrefix} Assign B`,
        conditionTarget: `${labelPrefix} Condition Target`,
    };
    const checklists: Checklist[] = [
        {
            title: checklistTitles.primary,
            items: [
                {title: taskTitles.conditionAnchor},
                {title: taskTitles.clearSelectionA},
                {title: taskTitles.clearSelectionB},
                {title: taskTitles.deleteA},
                {title: taskTitles.deleteB},
                {title: taskTitles.assignA},
                {title: taskTitles.conditionTarget},
            ],
        },
        {
            title: checklistTitles.secondary,
            items: [
                {title: taskTitles.assignB},
            ],
        },
    ];
    const conditionMatcher = `${labelPrefix} Property`;

    let playbook = await createPlaybook(page, teamData.teamId, `${labelPrefix} Playbook`, checklists);

    if (options.includeCondition !== false) {
        const propertyField = await createPlaybookPropertyField(page, playbook.id, conditionMatcher);
        const condition = await createPlaybookCondition(page, playbook.id, propertyField.id, labelPrefix);

        playbook.checklists[0].items[0] = {
            ...playbook.checklists[0].items[0],
            condition_id: condition.id,
        };
        playbook = await updatePlaybook(page, playbook);
    }

    if (options.archived) {
        await archivePlaybook(page, playbook.id);
    }

    return {
        playbookId: playbook.id,
        playbookTitle: playbook.title,
        teamName: teamData.teamName,
        assigneeUser: teamData.assigneeUser,
        conditionMatcher,
        checklistTitles,
        taskTitles,
    };
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
