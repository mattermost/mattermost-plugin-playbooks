// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Covers "Use task lists as phases": the playbook setting, the phase timeline on the run page,
// how phases move on their own, how a person takes over the current phase, and the REST/GraphQL
// contract around phases and their timeline events.

import {expect, test, type Page} from '@playwright/test';

import {loginAs, loginAsAdmin} from '../helpers/auth';
import {uniqueSuffix} from '../helpers/client';
import {archivePlaybook, createPlaybook, getPlaybook} from '../helpers/playbook';
import {
    closeChecklist,
    createRun,
    deleteTimelineEvent,
    finishRun,
    getRun,
    graphqlQuery,
    moveChecklist,
    phaseEvents,
    removeChecklist,
    restoreRun,
    setRunPhase,
    setTaskState,
    skipTask,
    type Run,
} from '../helpers/run';
import {addUserToTeam, createTeam} from '../helpers/team';
import {type SeededUser, createUser} from '../helpers/user';
import {PlaybookEditorPage} from '../pages/playbook_editor_page';
import {PlaybookRunPage} from '../pages/playbook_run_page';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

interface PhasesData {
    teamName: string;
    teamId: string;
    owner: SeededUser;
    outsider: SeededUser;
}

const incidentChecklists = [
    {title: 'Triage', items: [{title: 'Assess impact'}, {title: 'Page on-call'}]},
    {title: 'Containment', items: [{title: 'Isolate service'}, {title: 'Rotate keys'}]},
    {title: 'Recovery', items: [{title: 'Restore backups'}]},
];

const initialLabels = [
    'Triage: In progress, current phase',
    'Containment: Not started',
    'Recovery: Not started',
];

test.describe('run phases', () => {
    let seededData: PhasesData;
    const createdPlaybookIds: string[] = [];

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        // Seed (as admin) a team with the playbook owner, and a team member who is
        // neither a run owner nor a playbook admin.
        await loginAsAdmin(page);
        const team = await createTeam(page, 'pb-phases');
        const owner = await createUser(page, 'pb-phases-owner');
        const outsider = await createUser(page, 'pb-phases-outsider');
        await addUserToTeam(page, team.id, owner.id);
        await addUserToTeam(page, team.id, outsider.id);
        seededData = {teamName: team.name, teamId: team.id, owner, outsider};

        await context.close();
    });

    test.afterAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAs(page, seededData.owner.username, seededData.owner.password);
        for (const playbookId of createdPlaybookIds) {
            await archivePlaybook(page, playbookId);
        }

        await context.close();
    });

    // Logs in as the playbook owner and starts a run from a new playbook. The owner becomes
    // both the playbook admin and the run owner.
    async function startRun(page: Page, options: {phases: boolean; checklists?: typeof incidentChecklists}) {
        await loginAs(page, seededData.owner.username, seededData.owner.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Phases ${uniqueSuffix()}`, {
            checklists: options.checklists ?? incidentChecklists,
            useChecklistsAsPhases: options.phases,
        });
        createdPlaybookIds.push(playbook.id);

        const run = await createRun(page, {
            name: `PW Phases Run ${uniqueSuffix()}`,
            ownerUserId: seededData.owner.id,
            teamId: seededData.teamId,
            playbookId: playbook.id,
        });
        return {playbook, run};
    }

    function checklistId(run: Run, title: string): string {
        const checklist = run.checklists.find((candidate) => candidate.title === title);
        if (!checklist) {
            throw new Error(`Run has no checklist ${title}`);
        }
        return checklist.id;
    }

    function phaseOf(run: Run, title: string) {
        const phase = run.phases?.find((candidate) => candidate.title === title);
        if (!phase) {
            throw new Error(`Run has no phase ${title}`);
        }
        return phase;
    }

    test.describe('playbook editor', () => {
        /**
         * @objective Enable "Use task lists as phases" in the editor and keep it after a reload.
         */
        test('persists the use task lists as phases toggle after reload', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open the outline of a playbook that does not use phases
            await loginAs(page, seededData.owner.username, seededData.owner.password);
            const playbook = await createPlaybook(page, seededData.teamId, `PW Phases Editor ${uniqueSuffix()}`);
            createdPlaybookIds.push(playbook.id);
            await editor.goto(seededData.teamName, playbook.id);

            // * The toggle starts off
            await expect(editor.usePhasesCheckbox).not.toBeChecked();

            // # Turn it on
            await editor.toggleUsePhases();

            // * The toggle is on and the playbook is saved with the setting
            await expect(editor.usePhasesCheckbox).toBeChecked();
            await expect.poll(async () => (await getPlaybook(page, playbook.id)).use_checklists_as_phases).toBe(true);

            // * The toggle is still on after a reload
            await page.reload();
            await editor.title.waitFor();
            await expect(editor.usePhasesCheckbox).toBeChecked();
        });

        /**
         * @objective Toggling the phases setting only changes that setting.
         */
        test('does not change other playbook settings when toggling use task lists as phases', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open the outline of a playbook with some content
            await loginAs(page, seededData.owner.username, seededData.owner.password);
            const playbook = await createPlaybook(page, seededData.teamId, `PW Phases Settings ${uniqueSuffix()}`, {
                checklists: incidentChecklists,
                description: 'Settings must survive the toggle',
            });
            createdPlaybookIds.push(playbook.id);
            await editor.goto(seededData.teamName, playbook.id);
            const before = await getPlaybook(page, playbook.id);

            // # Turn the setting on
            await editor.toggleUsePhases();
            await expect.poll(async () => (await getPlaybook(page, playbook.id)).use_checklists_as_phases).toBe(true);

            // * Every other setting is exactly as before
            const after = await getPlaybook(page, playbook.id);
            const withoutChangedFields = (playbook: Record<string, unknown>) => {
                const copy = {...playbook};
                delete copy.use_checklists_as_phases;
                delete copy.update_at;
                return copy;
            };
            expect(withoutChangedFields(after)).toEqual(withoutChangedFields(before));
        });
    });

    test.describe('phase timeline', () => {
        /**
         * @objective A run started from a playbook with the setting shows one step per task list.
         */
        test('shows a step per task list on a run from a playbook that uses phases', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Start a run from a playbook that uses task lists as phases and open it
            const {run} = await startRun(page, {phases: true});
            await runPage.goto(seededData.teamName, run.id);

            // * One step per task list, the first one in progress and current
            await expect.poll(() => runPage.phases.labels()).toEqual(initialLabels);
            await expect(runPage.phases.currentChip).toHaveText('Triage');
            await expect(runPage.phases.nextButton).toHaveText('Move to Containment');

            // * The first phase has been running since the run started, and nobody moved it
            await expect(runPage.phases.detail).toHaveText(/^for \d+s, started with the run$/);

            // * The run exposes the same phases over REST
            const restRun = await getRun(page, run.id);
            expect(restRun.use_checklists_as_phases).toBe(true);
            expect(restRun.phases?.map((phase) => [phase.title, phase.status, phase.current])).toEqual([
                ['Triage', 'started', true],
                ['Containment', 'not_started', false],
                ['Recovery', 'not_started', false],
            ]);
        });

        /**
         * @objective A run from a playbook without the setting has no timeline and no phases.
         */
        test('shows no timeline on a run from a playbook that does not use phases', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Start a run from a playbook without the setting and open it
            const {run} = await startRun(page, {phases: false});
            await runPage.goto(seededData.teamName, run.id);

            // * The run page lists its tasks but has no phase timeline
            await expect(page.getByText('Assess impact')).toBeVisible();
            await expect(runPage.phases.root).toHaveCount(0);

            // * The run has no phases over REST
            const restRun = await getRun(page, run.id);
            expect(restRun.use_checklists_as_phases).toBe(false);
            expect(restRun).not.toHaveProperty('phases');
        });
    });

    test.describe('automatic phases', () => {
        /**
         * @objective Finishing the tasks of a phase completes it and moves the run to the next phase.
         */
        test('moves to the next phase when every task of the current phase is closed', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run that is in its first phase
            const {run} = await startRun(page, {phases: true});
            await runPage.goto(seededData.teamName, run.id);
            await expect.poll(() => runPage.phases.labels()).toEqual(initialLabels);

            // # Close both tasks of the first phase, without reloading the page
            await closeChecklist(page, run.id, 0, 2);

            // * The timeline updates over the websocket: the first phase is done, the second current
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Triage: Done',
                'Containment: In progress, current phase',
                'Recovery: Not started',
            ]);
            await expect(runPage.phases.currentChip).toHaveText('Containment');
            await expect(runPage.phases.nextButton).toHaveText('Move to Recovery');

            // * The timeline events were recorded in order
            const restRun = await getRun(page, run.id);
            expect(phaseEvents(restRun)).toEqual([
                {type: 'phase_started', title: 'Triage'},
                {type: 'phase_done', title: 'Triage'},
                {type: 'phase_started', title: 'Containment'},
            ]);

            // * The next phase started at the moment the previous one was done, and is still running
            const triage = phaseOf(restRun, 'Triage');
            const containment = phaseOf(restRun, 'Containment');
            expect(triage.status).toBe('done');
            expect(triage.ended_at).toBeGreaterThanOrEqual(triage.started_at);
            expect(containment.started_at).toBe(triage.ended_at);
            expect(containment.ended_at).toBe(0);
            expect(phaseOf(restRun, 'Recovery')).toMatchObject({status: 'not_started', started_at: 0, ended_at: 0});

            // * The timeline events carry those same times
            const eventTime = (type: string, title: string) => restRun.timeline_events.find((event) => event.event_type === type && event.details.includes(`"title":"${title}"`))?.event_at;
            expect(eventTime('phase_done', 'Triage')).toBe(triage.ended_at);
            expect(eventTime('phase_started', 'Containment')).toBe(containment.started_at);
        });

        /**
         * @objective A phase the run started and moved past stays in progress, not "Not started".
         */
        test('keeps an untouched phase in progress after the run moved past it', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Finish the first phase, so the second one starts on its own
            const {run} = await startRun(page, {phases: true});
            await runPage.goto(seededData.teamName, run.id);
            await closeChecklist(page, run.id, 0, 2);
            await expect.poll(() => runPage.phases.labels()).toContain('Containment: In progress, current phase');

            // # Start working in the third phase without touching the second
            await setTaskState(page, run.id, 2, 0, 'in_progress');

            // * The run moved on to the third phase, but the second is still in progress
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Triage: Done',
                'Containment: In progress',
                'Recovery: In progress, current phase',
            ]);
            await expect(runPage.phases.currentChip).toHaveText('Recovery');

            // * Moving on did not stop the second phase's clock, and the third phase is running too
            const restRun = await getRun(page, run.id);
            expect(restRun.phases?.map((phase) => phase.status)).toEqual(['done', 'started', 'started']);
            expect(phaseOf(restRun, 'Containment').started_at).toBe(phaseOf(restRun, 'Triage').ended_at);
            expect(phaseOf(restRun, 'Containment').ended_at).toBe(0);
            expect(phaseOf(restRun, 'Recovery').started_at).toBeGreaterThan(0);
            expect(phaseOf(restRun, 'Recovery').ended_at).toBe(0);
            expect(phaseOf(restRun, 'Recovery').current).toBe(true);
            expect(phaseOf(restRun, 'Containment').current).toBe(false);
        });

        /**
         * @objective A phase whose tasks were all skipped is shown as skipped and passed over.
         */
        test('passes over a phase whose tasks are all skipped', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run whose middle phase has a single task
            const {run} = await startRun(page, {
                phases: true,
                checklists: [
                    {title: 'Triage', items: [{title: 'Assess impact'}]},
                    {title: 'Optional review', items: [{title: 'Ask legal'}]},
                    {title: 'Recovery', items: [{title: 'Restore backups'}]},
                ],
            });
            await runPage.goto(seededData.teamName, run.id);

            // # Skip the middle phase's task, then close the first phase's task
            await skipTask(page, run.id, 1, 0);
            await setTaskState(page, run.id, 0, 0, 'closed');

            // * The middle phase is skipped and the run went straight to the last phase
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Triage: Done',
                'Optional review: Skipped',
                'Recovery: In progress, current phase',
            ]);
            await expect(runPage.phases.step('Optional review')).toHaveAttribute('data-status', 'skipped');
            await expect(runPage.phases.currentChip).toHaveText('Recovery');

            // * The skipped phase never started
            const restRun = await getRun(page, run.id);
            expect(phaseOf(restRun, 'Optional review')).toMatchObject({status: 'skipped', started_at: 0, ended_at: 0, current: false});
            expect(phaseOf(restRun, 'Recovery').started_at).toBe(phaseOf(restRun, 'Triage').ended_at);
            expect(phaseEvents(restRun)).toEqual([
                {type: 'phase_started', title: 'Triage'},
                {type: 'phase_done', title: 'Triage'},
                {type: 'phase_started', title: 'Recovery'},
            ]);
        });
    });

    test.describe('task lists without tasks', () => {
        /**
         * @objective A task list with no tasks is never started or current, and the run goes past it.
         */
        test('passes over empty task lists, at the start and in the middle', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run whose first and third lists have no tasks
            const {run} = await startRun(page, {
                phases: true,
                checklists: [
                    {title: 'Intro', items: []},
                    {title: 'Triage', items: [{title: 'Assess impact'}]},
                    {title: 'Notes', items: []},
                    {title: 'Recovery', items: [{title: 'Restore backups'}]},
                ],
            });
            await runPage.goto(seededData.teamName, run.id);

            // * The run starts in the first list that has a task, and the empty lists do not run
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Intro: Not started',
                'Triage: In progress, current phase',
                'Notes: Not started',
                'Recovery: Not started',
            ]);
            const started = await getRun(page, run.id);
            expect(phaseOf(started, 'Intro')).toMatchObject({status: 'not_started', started_at: 0, ended_at: 0, current: false});

            // # Finish the only task of the second list
            await setTaskState(page, run.id, 1, 0, 'closed');

            // * The run goes past the empty list to the last one, which starts when the second was done
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Intro: Not started',
                'Triage: Done',
                'Notes: Not started',
                'Recovery: In progress, current phase',
            ]);
            const restRun = await getRun(page, run.id);
            expect(phaseOf(restRun, 'Notes')).toMatchObject({status: 'not_started', started_at: 0, ended_at: 0, current: false});
            expect(phaseOf(restRun, 'Recovery').started_at).toBe(phaseOf(restRun, 'Triage').ended_at);
            expect(phaseEvents(restRun)).toEqual([
                {type: 'phase_started', title: 'Triage'},
                {type: 'phase_done', title: 'Triage'},
                {type: 'phase_started', title: 'Recovery'},
            ]);
        });

        /**
         * @objective A first phase whose tasks were all skipped has no time, not even after the run is finished.
         */
        test('gives a skipped first phase no time, also when the run is finished', {tag: '@playbooks'}, async ({page}) => {
            // # Skip every task of the first list, then finish the run
            const {run} = await startRun(page, {phases: true});
            await skipTask(page, run.id, 0, 0);
            await skipTask(page, run.id, 0, 1);
            await finishRun(page, run.id);

            // * The first phase is skipped and never had a time to stop
            const restRun = await getRun(page, run.id);
            expect(phaseOf(restRun, 'Triage')).toMatchObject({status: 'skipped', started_at: 0, ended_at: 0, current: false});
        });
    });

    test.describe('phases the run reached', () => {
        /**
         * @objective A done phase that gets an open task again is reopened and runs again from its original start.
         */
        test('reopens a done phase when one of its tasks is opened again', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Finish the first phase, so the second one is current
            const {run} = await startRun(page, {phases: true});
            await runPage.goto(seededData.teamName, run.id);
            await closeChecklist(page, run.id, 0, 2);
            await expect.poll(() => runPage.phases.labels()).toContain('Triage: Done');
            const done = phaseOf(await getRun(page, run.id), 'Triage');

            // # Open one of its tasks again
            await setTaskState(page, run.id, 0, 0, '');

            // * The first phase is in progress again, while the run stays in the second phase
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Triage: In progress',
                'Containment: In progress, current phase',
                'Recovery: Not started',
            ]);

            // * It keeps its original start and runs again, and the timeline says it was reopened
            const restRun = await getRun(page, run.id);
            expect(phaseOf(restRun, 'Triage')).toMatchObject({status: 'started', started_at: done.started_at, ended_at: 0});
            expect(phaseEvents(restRun)).toEqual([
                {type: 'phase_started', title: 'Triage'},
                {type: 'phase_done', title: 'Triage'},
                {type: 'phase_started', title: 'Containment'},
                {type: 'phase_reopened', title: 'Triage'},
            ]);

            // # Finish the phase again
            await setTaskState(page, run.id, 0, 0, 'closed');

            // * It is done again, ending when its last task was closed
            await expect.poll(() => runPage.phases.labels()).toContain('Triage: Done');
            const again = await getRun(page, run.id);
            expect(phaseOf(again, 'Triage').started_at).toBe(done.started_at);
            expect(phaseOf(again, 'Triage').ended_at).toBeGreaterThan(done.ended_at);
            expect(phaseEvents(again).filter((event) => event.type === 'phase_done')).toEqual([
                {type: 'phase_done', title: 'Triage'},
                {type: 'phase_done', title: 'Triage'},
            ]);
        });

        /**
         * @objective A phase the run reached keeps running from that moment when a person moves on, and
         * is done only when its tasks are, however late that is.
         */
        test('times a phase from when the run reached it, even if a person moved on and finished it later', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Finish the first phase, so the run reaches the second one
            const {run} = await startRun(page, {phases: true});
            await runPage.goto(seededData.teamName, run.id);
            await closeChecklist(page, run.id, 0, 2);
            await expect.poll(() => runPage.phases.labels()).toContain('Containment: In progress, current phase');
            const reached = phaseOf(await getRun(page, run.id), 'Containment').started_at;

            // # A person moves on to the last phase without doing anything in the second
            expect((await setRunPhase(page, run.id, checklistId(run, 'Recovery'))).ok()).toBe(true);
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Triage: Done',
                'Containment: In progress',
                'Recovery: In progress, current phase',
            ]);

            // * The second phase is still running from the moment the run reached it
            const moved = await getRun(page, run.id);
            expect(phaseOf(moved, 'Containment')).toMatchObject({status: 'started', started_at: reached, ended_at: 0});

            // # Finish the second phase later
            await closeChecklist(page, run.id, 1, 2);
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Triage: Done',
                'Containment: Done',
                'Recovery: In progress, current phase',
            ]);

            // * It started when the run reached it and ended when its last task was closed
            const finished = await getRun(page, run.id);
            const containment = phaseOf(finished, 'Containment');
            expect(containment.started_at).toBe(reached);
            expect(containment.ended_at).toBeGreaterThan(phaseOf(moved, 'Recovery').started_at);

            // * The timeline says the same: reached, started in the last phase by hand, then done
            const doneEvent = finished.timeline_events.find((event) => event.event_type === 'phase_done' && event.details.includes('"title":"Containment"'));
            expect(doneEvent?.event_at).toBe(containment.ended_at);
            expect(phaseEvents(finished).map((event) => `${event.type} ${event.title}`)).toEqual([
                'phase_started Triage',
                'phase_done Triage',
                'phase_started Containment',
                'current_phase_changed Recovery',
                'phase_started Recovery',
                'phase_done Containment',
            ]);
        });
    });

    test.describe('manual phases', () => {
        /**
         * @objective The run owner moves the current phase by hand and phases stop moving on their own.
         */
        test('lets the run owner take over the current phase after a confirmation', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run in its first phase
            const {run} = await startRun(page, {phases: true});
            await runPage.goto(seededData.teamName, run.id);
            await expect(runPage.phases.nextButton).toHaveText('Move to Containment');

            // # Move to the next phase
            await runPage.phases.moveToNext();

            // * A confirmation explains the takeover
            await expect(runPage.phases.confirmModal).toContainText('Phases will no longer move on their own');

            // # Confirm
            await runPage.phases.confirmManualPhase();

            // * The second phase is current and the header says who set it
            await expect(runPage.phases.currentChip).toHaveText('Containment');
            await expect(runPage.phases.detail).toContainText(`set by @${seededData.owner.username}`);
            await expect(runPage.phases.confirmModal).toHaveCount(0);

            // * The run records the override and the move, and the phase counts as started
            const moved = await getRun(page, run.id);
            expect(moved.phase_override?.checklist_id).toBe(checklistId(run, 'Containment'));
            expect(phaseEvents(moved)).toHaveLength(3);
            expect(phaseEvents(moved)).toEqual(expect.arrayContaining([
                {type: 'phase_started', title: 'Triage'},
                {type: 'current_phase_changed', title: 'Containment'},
                {type: 'phase_started', title: 'Containment'},
            ]));
            const manualStart = moved.timeline_events.find((event) => event.event_type === 'phase_started' && event.details.includes('Containment'));
            expect(JSON.parse(manualStart?.details ?? '{}')).toMatchObject({source: 'manual'});
            expect(phaseOf(moved, 'Containment').status).toBe('started');

            // # Finish the first phase's tasks
            await closeChecklist(page, run.id, 0, 2);

            // * The first phase is done, but the current phase stays where the owner put it
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Triage: Done',
                'Containment: In progress, current phase',
                'Recovery: Not started',
            ]);
            await expect(runPage.phases.currentChip).toHaveText('Containment');
            await expect(runPage.phases.detail).toContainText('set by');

            // # Finish the pinned phase's tasks too
            await closeChecklist(page, run.id, 1, 2);

            // * Phases are still computed (the next one starts when this one is done), but the
            // * current phase never moves on its own
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Triage: Done',
                'Containment: Done, current phase',
                'Recovery: In progress',
            ]);
            const afterwards = await getRun(page, run.id);
            expect(phaseOf(afterwards, 'Containment').current).toBe(true);
            expect(phaseOf(afterwards, 'Recovery').current).toBe(false);
            expect(afterwards.phase_override?.checklist_id).toBe(checklistId(run, 'Containment'));
        });

        /**
         * @objective Moving the phase again after the takeover does not ask for confirmation again.
         */
        test('does not ask for confirmation on a second manual move', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Take over the current phase once
            const {run} = await startRun(page, {phases: true});
            await runPage.goto(seededData.teamName, run.id);
            await runPage.phases.moveToNext();
            await runPage.phases.confirmManualPhase();
            await expect(runPage.phases.currentChip).toHaveText('Containment');
            await expect(runPage.phases.nextButton).toHaveText('Move to Recovery');

            // # Move to the next phase again
            await runPage.phases.moveToNext();

            // * The phase moved right away, without a confirmation
            await expect(runPage.phases.currentChip).toHaveText('Recovery');
            await expect(runPage.phases.confirmModal).toHaveCount(0);
            expect((await getRun(page, run.id)).phase_override?.checklist_id).toBe(checklistId(run, 'Recovery'));
        });

        /**
         * @objective Only the run owner or a playbook admin can move the current phase.
         */
        test('hides the move button and rejects the API for someone who is neither run owner nor playbook admin', {tag: '@playbooks'}, async ({page, browser}) => {
            // # Start a run as the owner
            const {run} = await startRun(page, {phases: true});

            const outsiderContext = await browser.newContext({baseURL});
            try {
                const outsiderPage = await outsiderContext.newPage();
                const outsiderRunPage = new PlaybookRunPage(outsiderPage);

                // # Open the run as a team member who is neither owner nor playbook admin
                await loginAs(outsiderPage, seededData.outsider.username, seededData.outsider.password);
                await outsiderRunPage.goto(seededData.teamName, run.id);

                // * The timeline is shown, without a way to move the phase
                await expect.poll(() => outsiderRunPage.phases.labels()).toEqual(initialLabels);
                await expect(outsiderRunPage.phases.currentChip).toHaveText('Triage');
                await expect(outsiderRunPage.phases.nextButton).toHaveCount(0);

                // * The API refuses the move
                const response = await setRunPhase(outsiderPage, run.id, checklistId(run, 'Containment'));
                expect(response.status()).toBe(403);
            } finally {
                await outsiderContext.close();
            }

            // * The current phase did not change
            const restRun = await getRun(page, run.id);
            expect(restRun.phase_override).toBeUndefined();
            expect(phaseOf(restRun, 'Triage').current).toBe(true);
        });

        /**
         * @objective Moving the phase is refused for unknown task lists, for runs without phases and for finished runs.
         */
        test('rejects moving to an unknown phase, on a run without phases and on a finished run', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run with phases, a run without, and finish a third one
            const {run} = await startRun(page, {phases: true});
            const {run: plainRun} = await startRun(page, {phases: false});
            const {run: finishedRun} = await startRun(page, {phases: true});
            await finishRun(page, finishedRun.id);

            // * An unknown task list is a bad request
            expect((await setRunPhase(page, run.id, 'doesnotexist')).status()).toBe(400);

            // * A run that does not use phases is a bad request
            expect((await setRunPhase(page, plainRun.id, plainRun.checklists[0].id)).status()).toBe(400);

            // * A finished run is a bad request
            expect((await setRunPhase(page, finishedRun.id, checklistId(finishedRun, 'Containment'))).status()).toBe(400);
        });
    });

    test.describe('task lists of a phases run', () => {
        /**
         * @objective Reordering the task lists is refused for a phases run only.
         */
        test('rejects reordering task lists of a phases run but not of a normal run', {tag: '@playbooks'}, async ({page}) => {
            // # Start one run with phases and one without
            const {run} = await startRun(page, {phases: true});
            const {run: plainRun} = await startRun(page, {phases: false});

            // * Reordering the phases run is a bad request and keeps the order
            expect((await moveChecklist(page, run.id, 0, 1)).status()).toBe(400);
            expect((await getRun(page, run.id)).checklists.map((checklist) => checklist.title)).toEqual(['Triage', 'Containment', 'Recovery']);

            // * Reordering the other run still works
            expect((await moveChecklist(page, plainRun.id, 0, 1)).ok()).toBe(true);
            expect((await getRun(page, plainRun.id)).checklists.map((checklist) => checklist.title)).toEqual(['Containment', 'Triage', 'Recovery']);
        });

        /**
         * @objective The run page offers no drag handle on the task lists of a phases run.
         */
        test('hides the task list drag handle on a phases run', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            const dragHandle = (title: string) => runPage.checklistHeader(title).getByTitle('Drag to reorder checklist');

            // # Open a run without phases and hover over a task list
            const {run: plainRun} = await startRun(page, {phases: false});
            await runPage.goto(seededData.teamName, plainRun.id);
            await runPage.hoverChecklistHeader('Triage');

            // * The task list can be dragged
            await expect(dragHandle('Triage')).toBeVisible();

            // # Open a run with phases and hover over a task list
            const {run} = await startRun(page, {phases: true});
            await runPage.goto(seededData.teamName, run.id);
            await runPage.hoverChecklistHeader('Triage');

            // * The task list menu is open, but without a drag handle
            await expect(runPage.checklistHeader('Triage').getByTitle('More')).toBeVisible();
            await expect(dragHandle('Triage')).toHaveCount(0);
        });

        /**
         * @objective Moving a task between task lists is still allowed on a phases run.
         */
        test('still allows moving a task between task lists of a phases run', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run with phases
            const {run} = await startRun(page, {phases: true});

            // # Move the first task of the first list to the last list
            const response = await page.request.post(`/plugins/playbooks/api/v0/runs/${run.id}/checklists/move-item`, {
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                data: {source_checklist_idx: 0, source_item_idx: 0, dest_checklist_idx: 2, dest_item_idx: 0},
            });

            // * The task moved
            expect(response.ok()).toBe(true);
            const restRun = await getRun(page, run.id);
            expect(restRun.checklists[0].items.map((item) => item.title)).toEqual(['Page on-call']);
            expect(restRun.checklists[2].items.map((item) => item.title)).toEqual(['Assess impact', 'Restore backups']);
        });

        /**
         * @objective The task list the current phase was set to cannot be deleted, other task lists can.
         */
        test('rejects deleting the task list a person set as the current phase', {tag: '@playbooks'}, async ({page}) => {
            // # Take over the current phase, pinning the second task list
            const {run} = await startRun(page, {phases: true});
            expect((await setRunPhase(page, run.id, checklistId(run, 'Containment'))).ok()).toBe(true);

            // * Deleting the pinned task list is a bad request and keeps it
            expect((await removeChecklist(page, run.id, 1)).status()).toBe(400);
            expect((await getRun(page, run.id)).checklists.map((checklist) => checklist.title)).toEqual(['Triage', 'Containment', 'Recovery']);

            // * Another task list can still be deleted
            expect((await removeChecklist(page, run.id, 2)).ok()).toBe(true);
            const restRun = await getRun(page, run.id);
            expect(restRun.checklists.map((checklist) => checklist.title)).toEqual(['Triage', 'Containment']);
            expect(restRun.phases?.map((phase) => phase.title)).toEqual(['Triage', 'Containment']);
        });
    });

    test.describe('phase timeline events', () => {
        /**
         * @objective Phase events are part of the record and cannot be deleted.
         */
        test('rejects deleting a phase timeline event', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run with phases and move the phase by hand, so every kind of event exists
            const {run} = await startRun(page, {phases: true});
            await closeChecklist(page, run.id, 0, 2);
            expect((await setRunPhase(page, run.id, checklistId(run, 'Recovery'))).ok()).toBe(true);
            const restRun = await getRun(page, run.id);
            const events = restRun.timeline_events.filter((event) => event.event_type.startsWith('phase_') || event.event_type === 'current_phase_changed');
            expect(new Set(events.map((event) => event.event_type))).toEqual(new Set(['phase_started', 'phase_done', 'current_phase_changed']));

            // * None of them can be deleted
            for (const event of events) {
                expect((await deleteTimelineEvent(page, run.id, event.id)).status(), `deleting ${event.event_type}`).toBe(400);
            }

            // * They are all still in the timeline
            const after = await getRun(page, run.id);
            expect(after.timeline_events.filter((event) => events.some((original) => original.id === event.id) && event.delete_at === 0)).toHaveLength(events.length);
        });
    });

    test.describe('finished runs', () => {
        // Starts a run whose first phase is done and second one running, and returns it with the
        // phases it had just before it is finished.
        async function startRunWithPhaseRunning(page: Page) {
            const {run} = await startRun(page, {phases: true});
            await closeChecklist(page, run.id, 0, 2);
            await expect.poll(async () => phaseOf(await getRun(page, run.id), 'Containment').status).toBe('started');
            return {run, before: await getRun(page, run.id)};
        }

        /**
         * @objective Finishing a run stops the clocks of running phases without marking them done.
         */
        test('stops the running phases when the run is finished without marking them done', {tag: '@playbooks'}, async ({page}) => {
            // # Finish a run while its second phase is running
            const {run, before} = await startRunWithPhaseRunning(page);
            await finishRun(page, run.id);

            // * The running phase ended with the run, and is not done
            const finished = await getRun(page, run.id);
            expect(finished.end_at).toBeGreaterThan(0);
            expect(phaseOf(finished, 'Containment').status).toBe('started');
            expect(phaseOf(finished, 'Containment').ended_at).toBe(finished.end_at);

            // * Statuses are unchanged and the finished phase kept its end
            expect(finished.phases?.map((phase) => phase.status)).toEqual(before.phases?.map((phase) => phase.status));
            expect(phaseOf(finished, 'Triage').ended_at).toBe(phaseOf(before, 'Triage').ended_at);
            expect(phaseOf(finished, 'Recovery').ended_at).toBe(0);

            // * No phase was marked done by finishing
            expect(phaseEvents(finished).filter((event) => event.type === 'phase_done')).toEqual([{type: 'phase_done', title: 'Triage'}]);
        });

        /**
         * @objective Restoring a finished run resumes its phases' clocks.
         */
        test('resumes the phases when a finished run is restored', {tag: '@playbooks'}, async ({page}) => {
            // # Finish a run while its second phase is running, then restore it
            const {run, before} = await startRunWithPhaseRunning(page);
            await finishRun(page, run.id);
            expect(phaseOf(await getRun(page, run.id), 'Containment').ended_at).toBeGreaterThan(0);
            await restoreRun(page, run.id);

            // * The run is active again and the second phase is running again
            const restored = await getRun(page, run.id);
            expect(restored.end_at).toBe(0);
            expect(phaseOf(restored, 'Containment').ended_at).toBe(0);
            expect(phaseOf(restored, 'Containment').started_at).toBe(phaseOf(before, 'Containment').started_at);
            expect(restored.phases?.map((phase) => phase.status)).toEqual(before.phases?.map((phase) => phase.status));
            expect(phaseEvents(restored).filter((event) => event.type === 'phase_done')).toEqual([{type: 'phase_done', title: 'Triage'}]);
        });

        /**
         * @objective The time shown for a running phase advances, and the time of a finished run's phase does not.
         */
        test('stops the time shown for a running phase once the run is finished', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // The page's clock is faked so a long wait takes no real time. It still runs
            // in real time unless advanced.
            await page.clock.install();
            const advanceClock = async (milliseconds: number) => {
                await page.clock.fastForward(milliseconds);

                // Let the page render what the timers changed.
                await page.evaluate(() => new Promise<void>((resolve) => {
                    setTimeout(resolve, 0);
                }));
            };

            // # Open a run whose second phase is running
            const {run} = await startRunWithPhaseRunning(page);
            await runPage.goto(seededData.teamName, run.id);
            await expect(runPage.phases.detail).toHaveText(/^for \d+s, moved automatically$/);
            const runningTime = await runPage.phases.detail.textContent() ?? '';

            // * The time of the running phase advances (seconds under a minute, whole minutes after)
            await advanceClock(5 * 60 * 1000);
            await expect(runPage.phases.detail).not.toHaveText(runningTime);
            await expect(runPage.phases.detail).toHaveText(/^for \d+m, moved automatically$/);

            // # Finish the run and open it again
            await finishRun(page, run.id);
            const finished = await getRun(page, run.id);
            await runPage.goto(seededData.teamName, run.id);
            await expect(runPage.phases.detail).toHaveText(/^for \d+s, moved automatically$/);
            const stoppedTime = await runPage.phases.detail.textContent() ?? '';
            const elapsedSeconds = Math.floor((phaseOf(finished, 'Containment').ended_at - phaseOf(finished, 'Containment').started_at) / 1000);
            expect(stoppedTime).toBe(`for ${elapsedSeconds}s, moved automatically`);

            // * Ten minutes later the time of the finished run's phase is the same
            await advanceClock(10 * 60 * 1000);
            await expect(runPage.phases.detail).toHaveText(stoppedTime);
        });
    });

    test.describe('finished runs on an open page', () => {
        /**
         * @objective A page that is already open stops the running time when the run is finished, and
         * resumes it when the run is restored, without reloading.
         */
        test('stops and resumes the time shown without reloading the page', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // The page's clock is faked so a long wait takes no real time.
            await page.clock.install();
            const advanceClock = async (milliseconds: number) => {
                await page.clock.fastForward(milliseconds);
                await page.evaluate(() => new Promise<void>((resolve) => {
                    setTimeout(resolve, 0);
                }));
            };

            // # Open a run whose second phase is running
            const {run} = await startRun(page, {phases: true});
            await closeChecklist(page, run.id, 0, 2);
            await expect.poll(async () => phaseOf(await getRun(page, run.id), 'Containment').status).toBe('started');
            await runPage.goto(seededData.teamName, run.id);
            await expect(runPage.phases.detail).toHaveText(/^for \d+s, moved automatically$/);

            // # Finish the run while the page stays open
            await finishRun(page, run.id);
            const finished = phaseOf(await getRun(page, run.id), 'Containment');
            const stoppedAt = `for ${Math.floor((finished.ended_at - finished.started_at) / 1000)}s, moved automatically`;

            // * The shown time is the one the run finished with, and it no longer advances
            await expect(runPage.phases.detail).toHaveText(stoppedAt);
            await advanceClock(10 * 60 * 1000);
            await expect(runPage.phases.detail).toHaveText(stoppedAt);
            await expect(runPage.phases.step('Containment')).toHaveAttribute('data-status', 'started');

            // # Restore the run while the page stays open
            await restoreRun(page, run.id);

            // * The time runs again
            await advanceClock(5 * 60 * 1000);
            await expect(runPage.phases.detail).toHaveText(/^for \d+m, moved automatically$/);
            await expect(runPage.phases.detail).not.toHaveText(stoppedAt);
        });
    });

    test.describe('graphql', () => {
        /**
         * @objective Phases are only exposed over REST, not over GraphQL.
         */
        test('does not expose phases in the GraphQL run query', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run with phases
            const {run} = await startRun(page, {phases: true});

            // * The run can be queried without phases
            const control = await graphqlQuery(page, `{run(id: "${run.id}") {id name}}`);
            expect(control.ok()).toBe(true);
            expect((await control.json()).data.run.id).toBe(run.id);

            // * Asking for the phases is an error
            const response = await graphqlQuery(page, `{run(id: "${run.id}") {id phases {title}}}`);
            const body = await response.json();
            expect(body.errors).toHaveLength(1);
            expect(body.data?.run).toBeFalsy();

            // * The schema has no phases field on a run
            const schemaResponse = await graphqlQuery(page, '{__type(name: "Run") {fields {name}}}');
            const fieldNames = ((await schemaResponse.json()).data.__type.fields as Array<{name: string}>).map((field) => field.name);
            expect(fieldNames).toContain('checklists');
            expect(fieldNames).not.toContain('phases');
        });
    });
});
