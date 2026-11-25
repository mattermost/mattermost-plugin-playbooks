// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {APIResponse, Page} from '@playwright/test';

import {readJsonOrThrow, requestedWith} from './client';

const runsApi = '/plugins/playbooks/api/v0/runs';

interface CreateRunOptions {
    name: string;
    ownerUserId: string;
    teamId: string;
    playbookId: string;
}

export type PhaseStatus = 'not_started' | 'started' | 'done' | 'blocked' | 'skipped';

export interface RunPhase {
    checklist_id: string;
    title: string;
    status: PhaseStatus;
    current: boolean;
    tasks_open: number;
    tasks_total: number;
    started_at: number;
    ended_at: number;
}

export interface TimelineEvent {
    id: string;
    event_type: string;
    event_at: number;
    delete_at: number;
    summary: string;
    details: string;
    subject_user_id: string;
}

interface RunChecklist {
    id: string;
    title: string;
    items: Array<{id: string; title: string; state: string}>;
}

export interface Run {
    id: string;
    name: string;
    owner_user_id: string;
    create_at: number;
    channel_id: string;
    end_at: number;
    use_checklists_as_phases: boolean;
    custom_phases?: Array<{id: string; title: string}>;
    checklists: RunChecklist[];
    phases?: RunPhase[];
    phase_override?: {checklist_id: string; set_by: string; set_at: number};
    timeline_events: TimelineEvent[];
}

export function phaseOf(run: Run, title: string): RunPhase {
    const phase = run.phases?.find((candidate) => candidate.title === title);
    if (!phase) {
        throw new Error(`Run has no phase ${title}`);
    }
    return phase;
}

export function checklistId(run: Run, title: string): string {
    const checklist = run.checklists.find((candidate) => candidate.title === title);
    if (!checklist) {
        throw new Error(`Run has no checklist ${title}`);
    }
    return checklist.id;
}

export async function createRun(page: Page, options: CreateRunOptions): Promise<Run> {
    const response = await page.request.post(runsApi, {
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

    const location = response.headers()['location'];
    if (!location) {
        throw new Error('Run create response did not include a location header');
    }

    // The location header does not carry the plugin's route prefix, so only its id is used.
    const runId = location.split('/').pop() ?? '';
    return getRun(page, runId);
}

export async function getRun(page: Page, runId: string): Promise<Run> {
    const response = await page.request.get(`${runsApi}/${runId}`, requestedWith);
    return readJsonOrThrow<Run>(response, `Unable to fetch run ${runId}`);
}

async function expectOk(response: APIResponse, message: string) {
    if (!response.ok()) {
        throw new Error(`${message}: ${response.status()} ${await response.text()}`);
    }
}

// Sets the state ('open', 'in_progress', 'closed', ...) of a task, addressed by its
// position in the run's checklists.
export async function setTaskState(page: Page, runId: string, checklistIndex: number, itemIndex: number, state: string) {
    const response = await page.request.put(`${runsApi}/${runId}/checklists/${checklistIndex}/item/${itemIndex}/state`, {
        ...requestedWith,
        data: {new_state: state},
    });
    await expectOk(response, `Unable to set task ${checklistIndex}/${itemIndex} to ${state}`);
}

export async function skipTask(page: Page, runId: string, checklistIndex: number, itemIndex: number) {
    const response = await page.request.put(`${runsApi}/${runId}/checklists/${checklistIndex}/item/${itemIndex}/skip`, requestedWith);
    await expectOk(response, `Unable to skip task ${checklistIndex}/${itemIndex}`);
}

// Closes every task of a checklist.
export async function closeChecklist(page: Page, runId: string, checklistIndex: number, taskCount: number) {
    for (let itemIndex = 0; itemIndex < taskCount; itemIndex++) {
        await setTaskState(page, runId, checklistIndex, itemIndex, 'closed');
    }
}

// Raw responses are returned by the calls below so tests can assert on the status code.
export function setRunPhase(page: Page, runId: string, checklistId: string) {
    return page.request.put(`${runsApi}/${runId}/phase`, {...requestedWith, data: {checklist_id: checklistId}});
}

// Moves a run with phases of its own to the next phase. Without a body the phase it leaves is
// finished, the same as {close_current: true}.
export function moveRunToNextPhase(page: Page, runId: string, body?: {close_current?: boolean}) {
    return page.request.post(`${runsApi}/${runId}/phases/move`, {...requestedWith, ...(body === undefined ? {} : {data: body})});
}

// Marks a phase of a run with phases of its own done ('done') or reopens it ('started').
export function setRunPhaseState(page: Page, runId: string, phaseId: string, state: string) {
    return page.request.put(`${runsApi}/${runId}/phases/${phaseId}/state`, {...requestedWith, data: {state}});
}

export function moveChecklist(page: Page, runId: string, sourceIndex: number, destIndex: number) {
    return page.request.post(`${runsApi}/${runId}/checklists/move`, {
        ...requestedWith,
        data: {source_checklist_idx: sourceIndex, dest_checklist_idx: destIndex},
    });
}

export function removeChecklist(page: Page, runId: string, checklistIndex: number) {
    return page.request.delete(`${runsApi}/${runId}/checklists/${checklistIndex}`, requestedWith);
}

export function deleteTimelineEvent(page: Page, runId: string, eventId: string) {
    return page.request.delete(`${runsApi}/${runId}/timeline/${eventId}`, requestedWith);
}

export async function finishRun(page: Page, runId: string) {
    await expectOk(await page.request.put(`${runsApi}/${runId}/finish`, requestedWith), `Unable to finish run ${runId}`);
}

export async function restoreRun(page: Page, runId: string) {
    await expectOk(await page.request.put(`${runsApi}/${runId}/restore`, requestedWith), `Unable to restore run ${runId}`);
}

export function graphqlQuery(page: Page, query: string) {
    return page.request.post('/plugins/playbooks/api/v0/query', {...requestedWith, data: {query}});
}

// Events written at the same moment have no recorded order, so they are put in the order things
// happen: a phase is done, then the current phase is moved, then a phase starts, then is reopened.
const phaseEventRank: Record<string, number> = {
    phase_done: 0,
    current_phase_changed: 1,
    phase_started: 2,
    phase_reopened: 3,
};

// The timeline events of a run that concern its phases, oldest first.
export function phaseTimelineEvents(run: Run): TimelineEvent[] {
    return run.timeline_events.
        filter((event) => event.event_type.startsWith('phase_') || event.event_type === 'current_phase_changed').
        sort((a, b) => (a.event_at - b.event_at) || (phaseEventRank[a.event_type] - phaseEventRank[b.event_type]));
}

// The phase events of a run, oldest first, as {type, title}.
export function phaseEvents(run: Run): Array<{type: string; title: string}> {
    return phaseTimelineEvents(run).
        map((event) => {
            const details = JSON.parse(event.details) as {title?: string; to_title?: string};
            return {type: event.event_type, title: details.title ?? details.to_title ?? ''};
        });
}
