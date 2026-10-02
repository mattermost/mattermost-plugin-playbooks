// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {readJsonOrThrow, requestedWith} from './client';

interface CreateRunOptions {
    name: string;
    ownerUserId: string;
    teamId: string;
    playbookId: string;
}

export interface Run {
    id: string;
    name: string;
    channel_id: string;
    team_id: string;
    playbook_id: string;
    owner_user_id: string;
    current_status: string;
    participant_ids: string[];
}

export async function createRun(page: Page, options: CreateRunOptions): Promise<Run> {
    const response = await page.request.post('/plugins/playbooks/api/v0/runs', {
        ...requestedWith,
        data: {
            name: options.name,
            owner_user_id: options.ownerUserId,
            team_id: options.teamId,
            playbook_id: options.playbookId,
        },
    });

    if (response.status() !== 201) {
        throw new Error(`Unable to create run: ${response.status()} ${await response.text()}`);
    }

    return await response.json() as Run;
}

export async function getRun(page: Page, runId: string): Promise<Run> {
    const response = await page.request.get(`/plugins/playbooks/api/v0/runs/${runId}`, requestedWith);
    return readJsonOrThrow<Run>(response, `Unable to fetch run ${runId}`);
}

export async function finishRun(page: Page, runId: string) {
    const response = await page.request.put(`/plugins/playbooks/api/v0/runs/${runId}/finish`, requestedWith);

    if (!response.ok()) {
        throw new Error(`Unable to finish run ${runId}: ${response.status()} ${await response.text()}`);
    }
}

export async function restoreRun(page: Page, runId: string) {
    const response = await page.request.put(`/plugins/playbooks/api/v0/runs/${runId}/restore`, requestedWith);

    if (!response.ok()) {
        throw new Error(`Unable to restore run ${runId}: ${response.status()} ${await response.text()}`);
    }
}

// Posts a status update. reminderSeconds is ignored by the server when the run
// is being finished in the same call (finishRun=false here; use finishRun() to end a run).
export async function updateStatus(page: Page, runId: string, message: string, reminderSeconds: number) {
    const response = await page.request.post(`/plugins/playbooks/api/v0/runs/${runId}/status`, {
        ...requestedWith,
        data: {
            message,
            reminder: reminderSeconds,
            finish_run: false,
        },
    });

    if (!response.ok()) {
        throw new Error(`Unable to post status update for run ${runId}: ${response.status()} ${await response.text()}`);
    }
}

// Adds participants to a run. There is no REST endpoint for this yet, only the
// (deprecated but functional) GraphQL mutation `addRunParticipants` — see
// server/api/schema.graphqls.
// Searches for runs in a team by name. Returns the first run matching the given name,
// or undefined if none found. Use for post-UI-action API verification.
export async function getRunByName(page: Page, teamId: string, runName: string): Promise<Run | undefined> {
    const response = await page.request.get('/plugins/playbooks/api/v0/runs', {
        ...requestedWith,
        params: {team_id: teamId, search_term: runName, per_page: 100},
    });

    if (!response.ok()) {
        throw new Error(`Unable to search runs by name: ${response.status()} ${await response.text()}`);
    }

    const body = await response.json() as {items: Run[]};
    return body.items.find((r) => r.name === runName);
}

export async function addParticipants(page: Page, runId: string, userIds: string[]) {
    const response = await page.request.post('/plugins/playbooks/api/v0/query', {
        ...requestedWith,
        data: {
            query: `mutation AddRunParticipants($runID: String!, $userIDs: [String!]!) {
                addRunParticipants(runID: $runID, userIDs: $userIDs)
            }`,
            variables: {runID: runId, userIDs: userIds},
        },
    });

    if (!response.ok()) {
        throw new Error(`Unable to add participants to run ${runId}: ${response.status()} ${await response.text()}`);
    }

    const body = await response.json() as {errors?: Array<{message: string}>};
    if (body.errors && body.errors.length > 0) {
        throw new Error(`Unable to add participants to run ${runId}: ${body.errors.map((e) => e.message).join(', ')}`);
    }
}
