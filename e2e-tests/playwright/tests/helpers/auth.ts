// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

interface CurrentUser {
    id: string;
}

interface Team {
    id: string;
    name: string;
}

interface Playbook {
    id: string;
}

export interface SeededNavigationData {
    playbookTitle: string;
    runName: string;
    teamName: string;
}

const requestedWith = {headers: {'X-Requested-With': 'XMLHttpRequest'}};

function sanitizeTeamName(prefix: string) {
    return prefix.
        toLowerCase().
        replace(/[^a-z0-9-]+/g, '-').
        replace(/-{2,}/g, '-').
        replace(/^-|-$/g, '');
}

async function createTeam(page: Page, teamPrefix: string): Promise<Team> {
    const suffix = Date.now().toString(36);
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
    if (response.status() !== 201) {
        throw new Error(`Unable to create team: ${response.status()} ${await response.text()}`);
    }

    return await response.json() as Team;
}

export async function seedPlaybookNavigationData(page: Page, teamPrefix: string): Promise<SeededNavigationData> {
    const currentUserResponse = await page.request.get('/api/v4/users/me');
    if (!currentUserResponse.ok()) {
        throw new Error(`Unable to fetch current user: ${currentUserResponse.status()}`);
    }
    const currentUser = await currentUserResponse.json() as CurrentUser;

    const team = await createTeam(page, teamPrefix);
    const now = Date.now();
    const playbookTitle = `PW Playbook ${now}`;
    const runName = `PW Run ${now}`;

    const createPlaybookResponse = await page.request.post('/plugins/playbooks/api/v0/playbooks', {
        ...requestedWith,
        data: {
            title: playbookTitle,
            team_id: team.id,
            public: true,
            members: [],
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
    if (!playbookResponse.ok()) {
        throw new Error(`Unable to fetch created playbook: ${playbookResponse.status()}`);
    }
    const playbook = await playbookResponse.json() as Playbook;

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
