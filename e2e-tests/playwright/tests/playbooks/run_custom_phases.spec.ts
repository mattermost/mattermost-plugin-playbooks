// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Covers custom phases: phases a playbook defines by name instead of using its task lists. The
// editor of the list, the snapshot a run takes when it starts, how people move a run through its
// phases, and the REST contract and timeline events around it.

import {expect, test, type Page} from '@playwright/test';

import {loginAs, loginAsAdmin} from '../helpers/auth';
import {uniqueSuffix} from '../helpers/client';
import {archivePlaybook, createPlaybook, getCustomPhases, getPlaybook, updatePlaybook, type CreatePlaybookOptions} from '../helpers/playbook';
import {
    createRun,
    deleteTimelineEvent,
    finishRun,
    getRun,
    graphqlQuery,
    moveChecklist,
    moveRunToNextPhase,
    phaseEvents,
    phaseOf,
    phaseTimelineEvents,
    removeChecklist,
    restoreRun,
    setRunPhaseState,
    type Run,
} from '../helpers/run';
import {addUserToTeam, createTeam} from '../helpers/team';
import {type SeededUser, createUser} from '../helpers/user';
import {PlaybookEditorPage} from '../pages/playbook_editor_page';
import {PlaybookRunPage} from '../pages/playbook_run_page';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

interface CustomPhasesData {
    teamName: string;
    teamId: string;
    owner: SeededUser;
    outsider: SeededUser;
}

const articleChecklists = [
    {title: 'Prepare', items: [{title: 'Write outline'}, {title: 'Collect sources'}]},
    {title: 'Polish', items: [{title: 'Proofread'}]},
];

const articlePhases = ['Draft', 'Review', 'Publish'];

const initialLabels = [
    'Draft: In progress, current phase',
    'Review: Not started',
    'Publish: Not started',
];

test.describe('run custom phases', () => {
    let seededData: CustomPhasesData;
    const createdPlaybookIds: string[] = [];

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        // Seed (as admin) a team with the playbook owner, and a team member who is
        // neither a run owner nor a playbook admin.
        await loginAsAdmin(page);
        const team = await createTeam(page, 'pb-custom-phases');
        const owner = await createUser(page, 'pb-cphases-owner');
        const outsider = await createUser(page, 'pb-cphases-outsider');
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

    // Logs in as the playbook owner and creates a playbook, by default with the custom phases
    // Draft, Review and Publish. The owner becomes the playbook admin.
    async function createOwnedPlaybook(page: Page, options: CreatePlaybookOptions = {customPhases: articlePhases}) {
        await loginAs(page, seededData.owner.username, seededData.owner.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Custom Phases ${uniqueSuffix()}`, {
            checklists: articleChecklists,
            ...options,
        });
        createdPlaybookIds.push(playbook.id);
        return playbook;
    }

    // Starts a run from a new playbook. The owner becomes both the playbook admin and the run owner,
    // unless another run owner is given.
    async function startRun(page: Page, options: CreatePlaybookOptions = {customPhases: articlePhases}, runOwner: SeededUser = seededData.owner) {
        const playbook = await createOwnedPlaybook(page, options);
        const run = await createRun(page, {
            name: `PW Custom Phases Run ${uniqueSuffix()}`,
            ownerUserId: runOwner.id,
            teamId: seededData.teamId,
            playbookId: playbook.id,
        });
        return {playbook, run};
    }

    // Moves a run on by the given number of phases, finishing each phase it leaves.
    async function moveOn(page: Page, runId: string, count: number) {
        for (let i = 0; i < count; i++) {
            const response = await moveRunToNextPhase(page, runId);
            expect(response.status(), `moving on #${i + 1}`).toBe(200);
        }
    }

    // The phase events of a run, oldest first, with who made them and how.
    function phaseEventsWithAuthor(run: Run) {
        return phaseTimelineEvents(run).map((event) => {
            const details = JSON.parse(event.details) as {title?: string; to_title?: string; source?: string};
            return {type: event.event_type, title: details.title ?? details.to_title ?? '', source: details.source, user: event.subject_user_id};
        });
    }

    const phaseStatuses = (run: Run) => run.phases?.map((phase) => [phase.title, phase.status, phase.current]);

    test.describe('playbook editor', () => {
        /**
         * @objective Activating phases on a playbook without custom phases uses the task lists, and the
         * custom list can be chosen instead.
         */
        test('activates phases with task lists first and offers the custom list once they are not used', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open the outline of a playbook that does not use phases
            const playbook = await createOwnedPlaybook(page, {});
            await editor.goto(seededData.teamName, playbook.id);

            // * Phases are off and neither the task lists toggle nor the custom list is offered
            await expect(editor.activatePhasesCheckbox).not.toBeChecked();
            await expect(editor.usePhasesToggle).toHaveCount(0);
            await expect(editor.customPhases.root).toHaveCount(0);

            // # Activate phases
            await editor.toggleActivatePhases();

            // * The task lists are used as phases, so there is no custom list to edit
            await expect(editor.usePhasesCheckbox).toBeChecked();
            await expect(editor.customPhases.root).toHaveCount(0);
            await expect.poll(async () => {
                const saved = await getPlaybook(page, playbook.id);
                return [saved.phases_enabled, saved.use_checklists_as_phases];
            }).toEqual([true, true]);

            // # Stop using the task lists as phases
            await editor.toggleUsePhases();

            // * The custom list shows up, empty with a hint, and the setting is saved
            await expect(editor.usePhasesCheckbox).not.toBeChecked();
            await expect(editor.customPhases.root).toBeVisible();
            await expect(editor.customPhases.empty).toBeVisible();
            await expect(editor.customPhases.rows).toHaveCount(0);
            await expect.poll(async () => {
                const saved = await getPlaybook(page, playbook.id);
                return [saved.phases_enabled, saved.use_checklists_as_phases, saved.custom_phases ?? []];
            }).toEqual([true, false, []]);

            // # Turn the task lists back on
            await editor.toggleUsePhases();

            // * The custom list is gone again
            await expect(editor.usePhasesCheckbox).toBeChecked();
            await expect(editor.customPhases.root).toHaveCount(0);
        });

        /**
         * @objective Activating phases on a playbook that has custom phases keeps using them, not the task lists.
         */
        test('activates a playbook that already has custom phases with its custom list', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open a playbook with phases turned off that kept a custom list
            const playbook = await createOwnedPlaybook(page, {phasesEnabled: false, customPhases: articlePhases});
            await editor.goto(seededData.teamName, playbook.id);
            await expect(editor.activatePhasesCheckbox).not.toBeChecked();
            await expect(editor.customPhases.root).toHaveCount(0);

            // # Activate phases
            await editor.toggleActivatePhases();

            // * The task lists are not used and the list it kept is shown
            await expect(editor.usePhasesCheckbox).not.toBeChecked();
            await expect.poll(() => editor.customPhases.titles()).toEqual(articlePhases);
            await expect.poll(async () => {
                const saved = await getPlaybook(page, playbook.id);
                return [saved.phases_enabled, saved.use_checklists_as_phases, (saved.custom_phases ?? []).map((phase) => phase.title)];
            }).toEqual([true, false, articlePhases]);

            // # Deactivate phases
            await editor.toggleActivatePhases();

            // * Both the toggle and the list are gone, and the list is kept in the playbook
            await expect(editor.usePhasesToggle).toHaveCount(0);
            await expect(editor.customPhases.root).toHaveCount(0);
            await expect.poll(async () => (await getPlaybook(page, playbook.id)).phases_enabled).toBe(false);
            expect((await getCustomPhases(page, playbook.id)).map((phase) => phase.title)).toEqual(articlePhases);
        });

        /**
         * @objective Phases can be added with the add button and with Enter, trimmed, and each is saved at once.
         */
        test('adds phases with the button and with Enter, trimming their names', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open the custom list of a playbook with phases on and task lists off
            const playbook = await createOwnedPlaybook(page, {customPhases: []});
            await editor.goto(seededData.teamName, playbook.id);
            await expect(editor.customPhases.empty).toBeVisible();

            // * Nothing can be added while the name is empty or only spaces
            await expect(editor.customPhases.addButton).toBeDisabled();
            await editor.customPhases.typeName('   ');
            await expect(editor.customPhases.addButton).toBeDisabled();

            // # Add a phase with the button, with spaces around its name
            await editor.customPhases.addWithButton('  Draft  ');

            // * It is listed trimmed, the field is empty again and the hint is gone
            await expect.poll(() => editor.customPhases.titles()).toEqual(['Draft']);
            await expect(editor.customPhases.input).toHaveValue('');
            await expect(editor.customPhases.empty).toHaveCount(0);

            // # Add two more with Enter
            await editor.customPhases.addWithEnter('Review');
            await editor.customPhases.addWithEnter(' Publish ');

            // * They are listed in the order they were added
            await expect.poll(() => editor.customPhases.titles()).toEqual(articlePhases);

            // * The playbook is saved with them, each with an id the server accepts
            await expect.poll(async () => (await getCustomPhases(page, playbook.id)).map((phase) => phase.title)).toEqual(articlePhases);
            const saved = await getCustomPhases(page, playbook.id);
            for (const phase of saved) {
                expect(phase.id).toMatch(/^[a-z0-9]{26}$/);
            }
            expect(new Set(saved.map((phase) => phase.id)).size).toBe(3);
        });

        /**
         * @objective A phase name that is already used, in any letter case, is refused.
         */
        test('rejects a duplicate phase name, ignoring letter case', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open the custom list of a playbook that has phases
            const playbook = await createOwnedPlaybook(page);
            await editor.goto(seededData.teamName, playbook.id);
            await expect.poll(() => editor.customPhases.titles()).toEqual(articlePhases);

            // # Type a name that exists, in another letter case
            await editor.customPhases.typeName('rEVIEW');

            // * An alert says so and the phase cannot be added
            await expect(editor.customPhases.duplicateAlert).toHaveText('There is already a phase with this name.');
            await expect(editor.customPhases.addButton).toBeDisabled();
            await editor.customPhases.input.press('Enter');
            await expect(editor.customPhases.rows).toHaveCount(3);

            // # Change the name to a new one
            await editor.customPhases.typeName('Archive');

            // * The alert is gone and the phase can be added
            await expect(editor.customPhases.duplicateAlert).toHaveCount(0);
            await expect(editor.customPhases.addButton).toBeEnabled();
            await editor.customPhases.addButton.click();
            await expect.poll(() => editor.customPhases.titles()).toEqual([...articlePhases, 'Archive']);

            // * Only the valid phase was saved
            await expect.poll(async () => (await getCustomPhases(page, playbook.id)).map((phase) => phase.title)).toEqual([...articlePhases, 'Archive']);
        });

        /**
         * @objective A phase can be deleted and the others stay in order.
         */
        test('deletes a phase and saves the rest', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open the custom list of a playbook that has phases
            const playbook = await createOwnedPlaybook(page);
            await editor.goto(seededData.teamName, playbook.id);
            const before = (await getCustomPhases(page, playbook.id));

            // # Delete the middle phase
            await editor.customPhases.remove('Review');

            // * It is gone from the list and the playbook, and the others kept their ids
            await expect.poll(() => editor.customPhases.titles()).toEqual(['Draft', 'Publish']);
            await expect.poll(async () => (await getCustomPhases(page, playbook.id))).toEqual([before[0], before[2]]);

            // # Delete the others
            await editor.customPhases.remove('Draft');
            await editor.customPhases.remove('Publish');

            // * The list is empty with its hint, and the playbook has no phases
            await expect(editor.customPhases.empty).toBeVisible();
            await expect.poll(async () => (await getCustomPhases(page, playbook.id))).toEqual([]);
        });

        /**
         * @objective Renaming a phase in place saves with Enter and when leaving the field, Escape
         * and an invalid name put the old name back, and the phase keeps its id.
         */
        test('renames a phase with Enter or by leaving the field, and reverts with Escape or a duplicate', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open the custom list of a playbook that has phases
            const playbook = await createOwnedPlaybook(page);
            await editor.goto(seededData.teamName, playbook.id);
            const before = (await getCustomPhases(page, playbook.id));

            // # Type another name and press Escape
            await editor.customPhases.renameAt(0, 'Outline', 'Escape');

            // * The old name is back and nothing was saved
            await expect.poll(() => editor.customPhases.titles()).toEqual(articlePhases);
            expect((await getCustomPhases(page, playbook.id))).toEqual(before);

            // # Type a name another phase has and press Enter
            await editor.customPhases.renameAt(0, 'review', 'Enter');

            // * The old name is back and nothing was saved
            await expect.poll(() => editor.customPhases.titles()).toEqual(articlePhases);
            expect((await getCustomPhases(page, playbook.id))).toEqual(before);

            // # Rename the first phase with Enter, with spaces around the name
            await editor.customPhases.renameAt(0, '  Outline  ', 'Enter');

            // * It is renamed, trimmed, and saved
            await expect.poll(() => editor.customPhases.titles()).toEqual(['Outline', 'Review', 'Publish']);
            await expect.poll(async () => (await getCustomPhases(page, playbook.id))[0].title).toBe('Outline');

            // # Rename the last phase by leaving its field
            await editor.customPhases.renameAt(2, 'Release', 'Tab');

            // * It is renamed and saved
            await expect.poll(() => editor.customPhases.titles()).toEqual(['Outline', 'Review', 'Release']);
            await expect.poll(async () => (await getCustomPhases(page, playbook.id)).map((phase) => phase.title)).toEqual(['Outline', 'Review', 'Release']);

            // * Renaming kept every phase's id
            expect((await getCustomPhases(page, playbook.id)).map((phase) => phase.id)).toEqual(before.map((phase) => phase.id));
        });

        /**
         * @objective Phases are reordered with the keyboard on the drag handle, and the order is saved.
         */
        test('reorders phases with the keyboard and saves the order', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open the custom list of a playbook that has phases
            const playbook = await createOwnedPlaybook(page);
            await editor.goto(seededData.teamName, playbook.id);
            await expect.poll(() => editor.customPhases.titles()).toEqual(articlePhases);
            const before = (await getCustomPhases(page, playbook.id));

            // # Move the first phase down by two places
            await editor.customPhases.moveWithKeyboard('Draft', 2);

            // * The list shows the new order and it is saved, every phase with its own id
            await expect.poll(() => editor.customPhases.titles()).toEqual(['Review', 'Publish', 'Draft']);
            await expect.poll(async () => (await getCustomPhases(page, playbook.id))).toEqual([before[1], before[2], before[0]]);

            // # Move the last phase up by one place
            await editor.customPhases.moveWithKeyboard('Draft', -1);

            // * The order changes again
            await expect.poll(() => editor.customPhases.titles()).toEqual(['Review', 'Draft', 'Publish']);
            await expect.poll(async () => (await getCustomPhases(page, playbook.id))).toEqual([before[1], before[0], before[2]]);
        });

        /**
         * @objective Everything set in the editor is still there after a reload.
         */
        test('keeps the activation, the task lists setting and the phases after a reload', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Build a custom list from scratch in the editor
            const playbook = await createOwnedPlaybook(page, {});
            await editor.goto(seededData.teamName, playbook.id);
            await editor.toggleActivatePhases();
            await expect(editor.usePhasesCheckbox).toBeChecked();
            await editor.toggleUsePhases();
            await editor.customPhases.addWithButton('Draft');
            await editor.customPhases.addWithEnter('Review');
            await editor.customPhases.addWithEnter('Publish');
            await editor.customPhases.moveWithKeyboard('Publish', -2);
            await editor.customPhases.renameAt(2, 'Review copy', 'Enter');
            await expect.poll(() => editor.customPhases.titles()).toEqual(['Publish', 'Draft', 'Review copy']);
            await expect.poll(async () => (await getCustomPhases(page, playbook.id)).map((phase) => phase.title)).toEqual(['Publish', 'Draft', 'Review copy']);

            // # Reload the page
            await page.reload();
            await editor.title.waitFor();

            // * The toggles and the list, in order, are as they were
            await expect(editor.activatePhasesCheckbox).toBeChecked();
            await expect(editor.usePhasesCheckbox).not.toBeChecked();
            await expect.poll(() => editor.customPhases.titles()).toEqual(['Publish', 'Draft', 'Review copy']);
        });

        /**
         * @objective The custom list is kept while the task lists are used as phases, and is back when they are not.
         */
        test('keeps the custom list when switching to task lists and back', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open a playbook with a custom list
            const playbook = await createOwnedPlaybook(page);
            await editor.goto(seededData.teamName, playbook.id);
            await expect.poll(() => editor.customPhases.titles()).toEqual(articlePhases);
            const before = (await getCustomPhases(page, playbook.id));

            // # Use the task lists as phases
            await editor.toggleUsePhases();

            // * The list is hidden but still saved with the playbook
            await expect(editor.usePhasesCheckbox).toBeChecked();
            await expect(editor.customPhases.root).toHaveCount(0);
            await expect.poll(async () => (await getPlaybook(page, playbook.id)).use_checklists_as_phases).toBe(true);
            expect((await getCustomPhases(page, playbook.id))).toEqual(before);

            // # Go back to the custom list, also after a reload
            await page.reload();
            await editor.title.waitFor();
            await editor.toggleUsePhases();

            // * The same list is back, in order, with the same ids
            await expect.poll(() => editor.customPhases.titles()).toEqual(articlePhases);
            await expect.poll(async () => (await getPlaybook(page, playbook.id)).use_checklists_as_phases).toBe(false);
            expect((await getCustomPhases(page, playbook.id))).toEqual(before);
        });

        /**
         * @objective A list of 20 phases is full: nothing more can be added. Names are limited to 64 characters.
         */
        test('stops adding at 20 phases and limits a name to 64 characters', {tag: '@playbooks'}, async ({page}) => {
            const editor = new PlaybookEditorPage(page);

            // # Open a playbook that has 20 phases
            const twentyPhases = Array.from({length: 20}, (_, i) => `Phase ${i + 1}`);
            const playbook = await createOwnedPlaybook(page, {customPhases: twentyPhases});
            await editor.goto(seededData.teamName, playbook.id);

            // * The list is full: a hint says so and nothing can be added
            await expect(editor.customPhases.rows).toHaveCount(20);
            await expect(editor.customPhases.root).toContainText('A playbook can have up to 20 phases.');
            await expect(editor.customPhases.input).toBeDisabled();
            await expect(editor.customPhases.addButton).toBeDisabled();

            // # Delete one phase
            await editor.customPhases.remove('Phase 20');

            // * A phase can be added again, and a name takes at most 64 characters
            await expect(editor.customPhases.input).toBeEnabled();
            await expect(editor.customPhases.input).toHaveAttribute('maxlength', '64');
            await expect(editor.customPhases.names.first()).toHaveAttribute('maxlength', '64');
            await editor.customPhases.addWithButton('x'.repeat(64));
            await expect(editor.customPhases.rows).toHaveCount(20);
            await expect.poll(async () => (await getCustomPhases(page, playbook.id)).map((phase) => phase.title)).toEqual([...twentyPhases.slice(0, 19), 'x'.repeat(64)]);
        });

        /**
         * @objective A playbook without custom phases returns an empty list, not null.
         */
        test('returns an empty list of custom phases for a playbook that has none', {tag: '@playbooks'}, async ({page}) => {
            // # Create a playbook without any custom phase
            const playbook = await createOwnedPlaybook(page, {});

            // * The list is empty, not null
            expect((await getPlaybook(page, playbook.id)).custom_phases).toEqual([]);
        });

        /**
         * @objective The playbook API refuses custom phases that are duplicated, empty, too long or too many,
         * and keeps what it had.
         */
        test('rejects invalid custom phases with a 400 and keeps the saved ones', {tag: '@playbooks'}, async ({page}) => {
            // # Create a playbook with phases
            const playbook = await createOwnedPlaybook(page);
            const saved = (await getCustomPhases(page, playbook.id));
            const phase = (title: string, index: number) => ({id: `${'a'.repeat(25)}${index}`, title});

            // * Duplicate names are refused, in any letter case and with spaces around
            expect((await updatePlaybook(page, playbook.id, {custom_phases: [phase('Draft', 1), phase('draft', 2)]})).status()).toBe(400);
            expect((await updatePlaybook(page, playbook.id, {custom_phases: [phase('Draft', 1), phase(' DRAFT ', 2)]})).status()).toBe(400);

            // * An empty name or one of spaces is refused
            expect((await updatePlaybook(page, playbook.id, {custom_phases: [phase('', 1)]})).status()).toBe(400);
            expect((await updatePlaybook(page, playbook.id, {custom_phases: [phase('   ', 1)]})).status()).toBe(400);

            // * A name of 65 characters is refused
            expect((await updatePlaybook(page, playbook.id, {custom_phases: [phase('x'.repeat(65), 1)]})).status()).toBe(400);

            // * 21 phases are refused
            const tooMany = Array.from({length: 21}, (_, i) => phase(`Phase ${i}`, i));
            expect((await updatePlaybook(page, playbook.id, {custom_phases: tooMany})).status()).toBe(400);

            // * Creating a playbook with invalid phases is refused too
            const createResponse = await page.request.post('/plugins/playbooks/api/v0/playbooks', {
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                data: {title: `PW Invalid Phases ${uniqueSuffix()}`, team_id: seededData.teamId, public: true, phases_enabled: true, custom_phases: [phase('Same', 1), phase('same', 2)]},
            });
            expect(createResponse.status()).toBe(400);

            // * Nothing changed in the playbook
            expect((await getCustomPhases(page, playbook.id))).toEqual(saved);

            // * The limits themselves are allowed: 20 phases, and a name of 64 characters
            expect((await updatePlaybook(page, playbook.id, {custom_phases: tooMany.slice(0, 20)})).status()).toBe(200);
            expect((await updatePlaybook(page, playbook.id, {custom_phases: [phase('x'.repeat(64), 1)]})).status()).toBe(200);
            expect((await getCustomPhases(page, playbook.id)).map((item) => item.title)).toEqual(['x'.repeat(64)]);
        });
    });

    test.describe('run snapshot', () => {
        /**
         * @objective A run from a playbook with custom phases takes a copy of them, and starts in the first one.
         */
        test('copies the custom phases into the run and starts the first one with the run', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run from a playbook with custom phases
            const {playbook, run} = await startRun(page);

            // * The run has a copy of the playbook's phases, and does not use its task lists as phases
            const savedPhases = await getCustomPhases(page, playbook.id);
            expect(run.custom_phases).toEqual(savedPhases);
            expect(run.custom_phases?.map((phase) => phase.title)).toEqual(articlePhases);
            expect(run.use_checklists_as_phases).toBe(false);
            expect(run.phase_override).toBeUndefined();

            // * The first phase has started with the run, and the others have not
            expect(run.phases?.map((phase) => [phase.checklist_id, phase.title, phase.status, phase.current, phase.ended_at])).toEqual([
                [savedPhases[0].id, 'Draft', 'started', true, 0],
                [savedPhases[1].id, 'Review', 'not_started', false, 0],
                [savedPhases[2].id, 'Publish', 'not_started', false, 0],
            ]);
            expect(phaseOf(run, 'Review').started_at).toBe(0);
            expect(phaseOf(run, 'Publish').started_at).toBe(0);

            // * The start is recorded as a timeline event, written for the run and not for a person's move
            expect(phaseEventsWithAuthor(run)).toEqual([expect.objectContaining({type: 'phase_started', title: 'Draft', source: 'automatic'})]);
            const [startEvent] = phaseTimelineEvents(run);
            expect(phaseOf(run, 'Draft').started_at).toBe(startEvent.event_at);
            expect(startEvent.event_at).toBeGreaterThanOrEqual(run.create_at);
        });

        /**
         * @objective The run page shows the custom phases as a timeline with the move controls, and no
         * wording that belongs to task list phases.
         */
        test('shows the timeline with its labels and move buttons', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Start a run from a playbook with custom phases and open it
            const {run} = await startRun(page);
            await runPage.goto(seededData.teamName, run.id);

            // * One step per phase, the first in progress and current
            await expect.poll(() => runPage.phases.labels()).toEqual(initialLabels);
            await expect(runPage.phases.currentChip).toHaveText('Draft');
            await expect(runPage.phases.step('Draft')).toHaveAttribute('data-current', 'true');
            await expect(runPage.phases.step('Review')).toHaveAttribute('data-current', 'false');

            // * The header says how long the phase has gone and nothing about who or what moved it
            await expect(runPage.phases.detail).toHaveText(/^for \d+s$/);
            await expect(runPage.phases.detail).not.toContainText('moved automatically');
            await expect(runPage.phases.detail).not.toContainText('set by');
            await expect(runPage.phases.detail).not.toContainText('started with the run');

            // * The run owner can move on, with a menu next to the button for keeping the phase open
            await expect(runPage.phases.nextButton).toHaveText('Move to Review');
            await expect(runPage.phases.nextMenuButton).toBeVisible();
            await expect(runPage.phases.finishButton).toHaveCount(0);

            // * Only the circle of the started phase is a button
            await expect(runPage.phases.markers).toHaveCount(1);
            await expect(runPage.phases.marker('Draft')).toBeVisible();
            await expect(runPage.phases.marker('Review')).toHaveCount(0);
            await expect(runPage.phases.marker('Publish')).toHaveCount(0);

            // * The task lists of the run are still there next to the timeline
            await expect(page.getByText('Write outline')).toBeVisible();
        });

        /**
         * @objective Changing the playbook after a run started never changes that run.
         */
        test('does not change a run in progress when the playbook is edited afterwards', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Start a run and move it to its second phase
            const {playbook, run} = await startRun(page);
            await moveOn(page, run.id, 1);
            const before = await getRun(page, run.id);

            // # Rename, delete and add phases in the playbook, then use the task lists as phases
            const edited = [
                {...(await getCustomPhases(page, playbook.id))[0], title: 'Outline'},
                {id: 'b'.repeat(26), title: 'Archive'},
            ];
            expect((await updatePlaybook(page, playbook.id, {custom_phases: edited})).status()).toBe(200);
            expect((await updatePlaybook(page, playbook.id, {use_checklists_as_phases: true})).status()).toBe(200);

            // * The run still has its own phases, with their statuses and times
            const after = await getRun(page, run.id);
            expect(after.custom_phases).toEqual(before.custom_phases);
            expect(after.use_checklists_as_phases).toBe(false);
            expect(after.phases).toEqual(before.phases);
            expect(phaseEvents(after)).toEqual(phaseEvents(before));

            // * The run page shows the same timeline
            await runPage.goto(seededData.teamName, run.id);
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: Done',
                'Review: In progress, current phase',
                'Publish: Not started',
            ]);

            // * Moving still works with the run's own phases
            await moveOn(page, run.id, 1);
            expect(phaseStatuses(await getRun(page, run.id))).toEqual([['Draft', 'done', false], ['Review', 'done', false], ['Publish', 'started', true]]);

            // * A new run from the edited playbook uses the new setting, not the old phases
            const newRun = await createRun(page, {name: `PW Custom Phases Run ${uniqueSuffix()}`, ownerUserId: seededData.owner.id, teamId: seededData.teamId, playbookId: playbook.id});
            expect(newRun.use_checklists_as_phases).toBe(true);
            expect(newRun.custom_phases ?? []).toEqual([]);
            expect(newRun.phases?.map((phase) => phase.title)).toEqual(['Prepare', 'Polish']);
        });

        /**
         * @objective A new run takes the phases the playbook has at that moment.
         */
        test('gives a run started after an edit the edited phases', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run, then change the phases of the playbook and start another run
            const {playbook, run} = await startRun(page);
            const current = (await getCustomPhases(page, playbook.id));
            expect((await updatePlaybook(page, playbook.id, {custom_phases: [{...current[2], title: 'Release'}, current[0]]})).status()).toBe(200);
            const newRun = await createRun(page, {name: `PW Custom Phases Run ${uniqueSuffix()}`, ownerUserId: seededData.owner.id, teamId: seededData.teamId, playbookId: playbook.id});

            // * The new run has the edited list, started at its first phase
            expect(newRun.custom_phases).toEqual([{...current[2], title: 'Release'}, current[0]]);
            expect(phaseStatuses(newRun)).toEqual([['Release', 'started', true], ['Draft', 'not_started', false]]);

            // * The first run is as it was
            expect((await getRun(page, run.id)).custom_phases?.map((phase) => phase.title)).toEqual(articlePhases);
        });

        /**
         * @objective A playbook with phases off gives its runs no phases, whatever else it keeps.
         */
        test('gives runs no phases when the playbook has them off, even with a custom list or task lists setting', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Start runs from playbooks with phases off that keep a custom list, or the task lists setting, or both
            const {run: withList} = await startRun(page, {phasesEnabled: false, customPhases: articlePhases});
            const {run: withTaskLists} = await startRun(page, {phasesEnabled: false, useChecklistsAsPhases: true});
            const {run: withBoth} = await startRun(page, {phasesEnabled: false, useChecklistsAsPhases: true, customPhases: articlePhases});

            // * None of them has phases or a copy of the list
            for (const run of [withList, withTaskLists, withBoth]) {
                const restRun = await getRun(page, run.id);
                expect(restRun.use_checklists_as_phases).toBe(false);
                expect(restRun.custom_phases ?? []).toEqual([]);
                expect(restRun).not.toHaveProperty('phases');
            }

            // * The run page has no timeline
            await runPage.goto(seededData.teamName, withList.id);
            await expect(page.getByText('Write outline')).toBeVisible();
            await expect(runPage.phases.root).toHaveCount(0);

            // * Moving a run that has no phases is refused
            expect((await moveRunToNextPhase(page, withList.id)).status()).toBe(400);
        });

        /**
         * @objective Task lists win over a kept custom list, and phases on without any custom phases give no timeline.
         */
        test('uses the task lists when they are on and shows no timeline for an empty custom list', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Start a run from a playbook that uses task lists and keeps a custom list, and one with an empty custom list
            const {run: taskListRun} = await startRun(page, {useChecklistsAsPhases: true, customPhases: articlePhases});
            const {run: emptyRun} = await startRun(page, {phasesEnabled: true, useChecklistsAsPhases: false, customPhases: []});

            // * The first run uses its task lists as phases and does not copy the custom list
            const restTaskListRun = await getRun(page, taskListRun.id);
            expect(restTaskListRun.use_checklists_as_phases).toBe(true);
            expect(restTaskListRun.custom_phases ?? []).toEqual([]);
            expect(restTaskListRun.phases?.map((phase) => phase.title)).toEqual(['Prepare', 'Polish']);

            // * The second run has no phases, so no timeline
            const restEmptyRun = await getRun(page, emptyRun.id);
            expect(restEmptyRun.use_checklists_as_phases).toBe(false);
            expect(restEmptyRun).not.toHaveProperty('phases');
            await runPage.goto(seededData.teamName, emptyRun.id);
            await expect(page.getByText('Write outline')).toBeVisible();
            await expect(runPage.phases.root).toHaveCount(0);
        });
    });

    test.describe('moving to the next phase', () => {
        /**
         * @objective The main button finishes the current phase and starts the next, with no confirmation.
         */
        test('moves to the next phase and finishes the one it leaves', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run in its first phase and move to the next phase
            const {run} = await startRun(page);
            await runPage.goto(seededData.teamName, run.id);
            await expect(runPage.phases.nextButton).toHaveText('Move to Review');
            await runPage.phases.moveToNext();

            // * The first phase is done and the second one current, without any confirmation
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: Done',
                'Review: In progress, current phase',
                'Publish: Not started',
            ]);
            await expect(runPage.phases.currentChip).toHaveText('Review');
            await expect(runPage.phases.nextButton).toHaveText('Move to Publish');
            await expect(runPage.phases.confirmModal).toHaveCount(0);
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await expect(runPage.phases.detail).toHaveText(/^for \d+s$/);

            // * The run says the same over REST, and the phase times follow each other
            const restRun = await getRun(page, run.id);
            expect(phaseStatuses(restRun)).toEqual([['Draft', 'done', false], ['Review', 'started', true], ['Publish', 'not_started', false]]);
            expect(restRun.phase_override).toBeUndefined();
            const draft = phaseOf(restRun, 'Draft');
            const review = phaseOf(restRun, 'Review');
            expect(draft.ended_at).toBeGreaterThanOrEqual(draft.started_at);
            expect(review.started_at).toBe(draft.ended_at);
            expect(review.ended_at).toBe(0);
            expect(phaseOf(restRun, 'Publish')).toMatchObject({started_at: 0, ended_at: 0});

            // * The events are written in this order, the new ones by the person moving, manually
            expect(phaseEventsWithAuthor(restRun)).toEqual([
                expect.objectContaining({type: 'phase_started', title: 'Draft', source: 'automatic'}),
                {type: 'phase_done', title: 'Draft', source: 'manual', user: seededData.owner.id},
                {type: 'current_phase_changed', title: 'Review', source: undefined, user: seededData.owner.id},
                {type: 'phase_started', title: 'Review', source: 'manual', user: seededData.owner.id},
            ]);

            // * The move event names both phases, and the events carry the phase times
            const changed = phaseTimelineEvents(restRun).find((event) => event.event_type === 'current_phase_changed');
            expect(JSON.parse(changed?.details ?? '{}')).toMatchObject({from_title: 'Draft', to_title: 'Review', from_checklist_id: draft.checklist_id, to_checklist_id: review.checklist_id});
            const eventTime = (type: string, title: string) => phaseTimelineEvents(restRun).find((event) => event.event_type === type && event.details.includes(`"title":"${title}"`))?.event_at;
            expect(eventTime('phase_done', 'Draft')).toBe(draft.ended_at);
            expect(eventTime('phase_started', 'Review')).toBe(review.started_at);
        });

        /**
         * @objective The menu next to the main button moves on and leaves the current phase open.
         */
        test('moves to the next phase and keeps the current one open from the menu', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run in its first phase and open the menu next to the main button
            const {run} = await startRun(page);
            await runPage.goto(seededData.teamName, run.id);
            const started = phaseOf(await getRun(page, run.id), 'Draft').started_at;
            await runPage.phases.nextMenuButton.click();

            // * The menu offers to keep the current phase open
            await expect(runPage.phases.keepOpenItem).toHaveText('Move to Review and keep Draft open');

            // # Pick it
            await runPage.phases.keepOpenItem.click();

            // * Both phases are in progress and the second one is current
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: In progress',
                'Review: In progress, current phase',
                'Publish: Not started',
            ]);
            await expect(runPage.phases.currentChip).toHaveText('Review');
            await expect(runPage.phases.nextButton).toHaveText('Move to Publish');
            await expect(runPage.phases.keepOpenItem).toHaveCount(0);
            await expect(runPage.phases.confirmModal).toHaveCount(0);

            // * The first phase kept its start and is still running
            const restRun = await getRun(page, run.id);
            expect(phaseOf(restRun, 'Draft')).toMatchObject({status: 'started', started_at: started, ended_at: 0, current: false});
            expect(phaseOf(restRun, 'Review')).toMatchObject({status: 'started', ended_at: 0, current: true});
            expect(phaseOf(restRun, 'Review').started_at).toBeGreaterThanOrEqual(started);

            // * Only the move and the start were written, no phase was done
            expect(phaseEventsWithAuthor(restRun)).toEqual([
                expect.objectContaining({type: 'phase_started', title: 'Draft', source: 'automatic'}),
                {type: 'current_phase_changed', title: 'Review', source: undefined, user: seededData.owner.id},
                {type: 'phase_started', title: 'Review', source: 'manual', user: seededData.owner.id},
            ]);
        });

        /**
         * @objective The menu with the keep open choice is only offered while the current phase is open.
         */
        test('offers no keep open choice once the current phase is done', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run in its first phase, with the first phase marked done by hand
            const {run} = await startRun(page);
            await runPage.goto(seededData.teamName, run.id);
            await runPage.phases.openMarkerMenu('Draft');
            await runPage.phases.chooseMarkerAction();
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: Done, current phase',
                'Review: Not started',
                'Publish: Not started',
            ]);

            // * The main button is still there but not the menu next to it
            await expect(runPage.phases.nextButton).toHaveText('Move to Review');
            await expect(runPage.phases.nextMenuButton).toHaveCount(0);

            // # Move on
            await runPage.phases.moveToNext();

            // * The next phase started, and the finished one was not finished a second time
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: Done',
                'Review: In progress, current phase',
                'Publish: Not started',
            ]);
            expect(phaseEvents(await getRun(page, run.id))).toEqual([
                {type: 'phase_started', title: 'Draft'},
                {type: 'phase_done', title: 'Draft'},
                {type: 'current_phase_changed', title: 'Review'},
                {type: 'phase_started', title: 'Review'},
            ]);
        });

        /**
         * @objective Moving on always goes to the phase after the current one, never back or ahead,
         * even when an earlier phase was reopened.
         */
        test('always moves to the phase after the current one, also after reopening an earlier phase', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Move to the second phase, then reopen the first
            const {run} = await startRun(page);
            await runPage.goto(seededData.teamName, run.id);
            await moveOn(page, run.id, 1);
            await expect.poll(() => runPage.phases.labels()).toContain('Draft: Done');
            const draft = phaseOf(await getRun(page, run.id), 'Draft');
            await runPage.phases.openMarkerMenu('Draft');
            await runPage.phases.chooseMarkerAction();

            // * The first phase is in progress again and the second one is still current
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: In progress',
                'Review: In progress, current phase',
                'Publish: Not started',
            ]);
            expect(phaseOf(await getRun(page, run.id), 'Draft')).toMatchObject({status: 'started', started_at: draft.started_at, ended_at: 0, current: false});

            // * The main button goes to the third phase, not back to the first
            await expect(runPage.phases.nextButton).toHaveText('Move to Publish');
            await runPage.phases.moveToNext();
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: In progress',
                'Review: Done',
                'Publish: In progress, current phase',
            ]);
            expect(phaseStatuses(await getRun(page, run.id))).toEqual([['Draft', 'started', false], ['Review', 'done', false], ['Publish', 'started', true]]);
        });
    });

    test.describe('the last phase', () => {
        /**
         * @objective On the last phase the button finishes it, and afterwards there is no button.
         * Finishing the last phase does not finish the run.
         */
        test('finishes the last phase without finishing the run, then offers no button', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run in its last phase
            const {run} = await startRun(page);
            await moveOn(page, run.id, 2);
            await runPage.goto(seededData.teamName, run.id);
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: Done',
                'Review: Done',
                'Publish: In progress, current phase',
            ]);

            // * The button finishes the phase, and there is nothing to move to
            await expect(runPage.phases.finishButton).toHaveText('Finish Publish');
            await expect(runPage.phases.nextButton).toHaveCount(0);
            await expect(runPage.phases.nextMenuButton).toHaveCount(0);

            // # Finish the last phase
            await runPage.phases.finishLastPhase();

            // * It is done and still the current phase, and no button is left
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: Done',
                'Review: Done',
                'Publish: Done, current phase',
            ]);
            await expect(runPage.phases.currentChip).toHaveText('Publish');
            await expect(runPage.phases.finishButton).toHaveCount(0);
            await expect(runPage.phases.nextButton).toHaveCount(0);
            await expect(runPage.phases.nextMenuButton).toHaveCount(0);
            await expect(runPage.phases.confirmModal).toHaveCount(0);

            // * The run itself is still going
            const restRun = await getRun(page, run.id);
            expect(restRun.end_at).toBe(0);
            const publish = phaseOf(restRun, 'Publish');
            expect(publish).toMatchObject({status: 'done', current: true});
            expect(publish.ended_at).toBeGreaterThanOrEqual(publish.started_at);
            expect(phaseOf(restRun, 'Review').ended_at).toBe(publish.started_at);

            // * The last event is the phase done by the owner, and no other phase event was added
            expect(phaseEventsWithAuthor(restRun).slice(-1)).toEqual([{type: 'phase_done', title: 'Publish', source: 'manual', user: seededData.owner.id}]);
            expect(phaseEvents(restRun).map((event) => event.type)).toEqual([
                'phase_started',
                'phase_done', 'current_phase_changed', 'phase_started',
                'phase_done', 'current_phase_changed', 'phase_started',
                'phase_done',
            ]);

            // * The finished phase can be reopened from its circle
            await runPage.phases.openMarkerMenu('Publish');
            await expect(runPage.phases.markerAction).toHaveText('Reopen');
            await runPage.phases.chooseMarkerAction();
            await expect.poll(() => runPage.phases.labels()).toContain('Publish: In progress, current phase');
            await expect(runPage.phases.finishButton).toHaveText('Finish Publish');
        });

        /**
         * @objective A run with a single phase starts in it and offers to finish it.
         */
        test('offers to finish the only phase of a run', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run whose playbook has one custom phase
            const {run} = await startRun(page, {customPhases: ['Only']});
            await runPage.goto(seededData.teamName, run.id);

            // * The phase is current and the button finishes it
            await expect.poll(() => runPage.phases.labels()).toEqual(['Only: In progress, current phase']);
            await expect(runPage.phases.finishButton).toHaveText('Finish Only');
            await expect(runPage.phases.nextButton).toHaveCount(0);

            // # Finish it
            await runPage.phases.finishLastPhase();

            // * It is done and the run is still active
            await expect.poll(() => runPage.phases.labels()).toEqual(['Only: Done, current phase']);
            expect((await getRun(page, run.id)).end_at).toBe(0);
        });
    });

    test.describe('phase circles', () => {
        /**
         * @objective A started phase is marked done from its circle, and a done phase is reopened from it.
         */
        test('marks a phase done and reopens it from its circle', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run with the first two phases in progress
            const {run} = await startRun(page);
            await runPage.goto(seededData.teamName, run.id);
            await runPage.phases.moveToNextKeepingCurrentOpen();
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: In progress',
                'Review: In progress, current phase',
                'Publish: Not started',
            ]);
            const started = phaseOf(await getRun(page, run.id), 'Draft').started_at;

            // * The circles of the phases that started are buttons, and the circle of the last is not
            await expect(runPage.phases.markers).toHaveCount(2);
            await expect(runPage.phases.marker('Publish')).toHaveCount(0);

            // # Open the circle of the first phase
            await runPage.phases.openMarkerMenu('Draft');

            // * The menu has one action, to mark it done
            await expect(runPage.phases.markerAction).toHaveCount(1);
            await expect(runPage.phases.markerAction).toHaveText('Mark as done');

            // # Pick it
            await runPage.phases.chooseMarkerAction();

            // * The first phase is done, the second one stays current, and the menu is closed
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: Done',
                'Review: In progress, current phase',
                'Publish: Not started',
            ]);
            await expect(runPage.phases.markerAction).toHaveCount(0);
            await expect(runPage.phases.confirmModal).toHaveCount(0);
            const done = await getRun(page, run.id);
            const draft = phaseOf(done, 'Draft');
            expect(draft).toMatchObject({status: 'done', started_at: started, current: false});
            expect(draft.ended_at).toBeGreaterThanOrEqual(started);
            expect(phaseOf(done, 'Review')).toMatchObject({status: 'started', ended_at: 0, current: true});
            expect(phaseEventsWithAuthor(done).slice(-1)).toEqual([{type: 'phase_done', title: 'Draft', source: 'manual', user: seededData.owner.id}]);
            expect(phaseTimelineEvents(done).find((event) => event.event_type === 'phase_done')?.event_at).toBe(draft.ended_at);

            // # Open the circle of the done phase
            await runPage.phases.openMarkerMenu('Draft');

            // * The action is now to reopen it
            await expect(runPage.phases.markerAction).toHaveCount(1);
            await expect(runPage.phases.markerAction).toHaveText('Reopen');

            // # Pick it
            await runPage.phases.chooseMarkerAction();

            // * The phase runs again from its original start and the second one stays current
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: In progress',
                'Review: In progress, current phase',
                'Publish: Not started',
            ]);
            const reopened = await getRun(page, run.id);
            expect(phaseOf(reopened, 'Draft')).toMatchObject({status: 'started', started_at: started, ended_at: 0, current: false});
            expect(phaseEventsWithAuthor(reopened).slice(-2)).toEqual([
                {type: 'phase_done', title: 'Draft', source: 'manual', user: seededData.owner.id},
                {type: 'phase_reopened', title: 'Draft', source: 'manual', user: seededData.owner.id},
            ]);
        });

        /**
         * @objective The circle of a phase that has not started cannot be used, and a done current phase can be reopened.
         */
        test('gives a phase that has not started no menu, and reopens a done current phase', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run in its first phase
            const {run} = await startRun(page);
            await runPage.goto(seededData.teamName, run.id);

            // * Clicking the circle of the second phase opens nothing
            await expect.poll(() => runPage.phases.labels()).toEqual(initialLabels);
            await expect(runPage.phases.marker('Review')).toHaveCount(0);
            await runPage.phases.step('Review').getByTitle('Not started').click();
            await expect(runPage.phases.markerAction).toHaveCount(0);

            // # Mark the first phase done, which is also the current one
            await runPage.phases.openMarkerMenu('Draft');
            await runPage.phases.chooseMarkerAction();
            await expect.poll(() => runPage.phases.labels()).toContain('Draft: Done, current phase');

            // * The phase after it is still not started, with no button on its circle
            await expect(runPage.phases.marker('Review')).toHaveCount(0);
            await expect(runPage.phases.markers).toHaveCount(1);

            // # Reopen the first phase
            await runPage.phases.openMarkerMenu('Draft');
            await runPage.phases.chooseMarkerAction();

            // * It is in progress and current again, and the events say so in order
            await expect.poll(() => runPage.phases.labels()).toEqual(initialLabels);
            expect(phaseEvents(await getRun(page, run.id))).toEqual([
                {type: 'phase_started', title: 'Draft'},
                {type: 'phase_done', title: 'Draft'},
                {type: 'phase_reopened', title: 'Draft'},
            ]);
        });

        /**
         * @objective Several phases can be active at once, and the current phase is the furthest one started.
         */
        test('keeps several phases active and makes the furthest started phase current', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Move through the phases, keeping each one open
            const {run} = await startRun(page);
            await runPage.goto(seededData.teamName, run.id);
            await runPage.phases.moveToNextKeepingCurrentOpen();
            await expect(runPage.phases.currentChip).toHaveText('Review');
            await runPage.phases.moveToNextKeepingCurrentOpen();

            // * All three are in progress and the last one is current
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: In progress',
                'Review: In progress',
                'Publish: In progress, current phase',
            ]);
            await expect(runPage.phases.currentChip).toHaveText('Publish');
            const active = await getRun(page, run.id);
            expect(phaseStatuses(active)).toEqual([['Draft', 'started', false], ['Review', 'started', false], ['Publish', 'started', true]]);
            for (const phase of active.phases ?? []) {
                expect(phase.ended_at, phase.title).toBe(0);
            }
            expect(phaseOf(active, 'Draft').started_at).toBeLessThanOrEqual(phaseOf(active, 'Review').started_at);
            expect(phaseOf(active, 'Review').started_at).toBeLessThanOrEqual(phaseOf(active, 'Publish').started_at);

            // # Finish the middle phase from its circle
            await runPage.phases.openMarkerMenu('Review');
            await runPage.phases.chooseMarkerAction();

            // * The current phase is still the last one
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: In progress',
                'Review: Done',
                'Publish: In progress, current phase',
            ]);

            // # Finish the current phase, which is the last
            await runPage.phases.finishLastPhase();

            // * It stays current while the first phase still runs
            await expect.poll(() => runPage.phases.labels()).toEqual([
                'Draft: In progress',
                'Review: Done',
                'Publish: Done, current phase',
            ]);

            // * The events are exactly what was done, in order
            expect(phaseEvents(await getRun(page, run.id))).toEqual([
                {type: 'phase_started', title: 'Draft'},
                {type: 'current_phase_changed', title: 'Review'},
                {type: 'phase_started', title: 'Review'},
                {type: 'current_phase_changed', title: 'Publish'},
                {type: 'phase_started', title: 'Publish'},
                {type: 'phase_done', title: 'Review'},
                {type: 'phase_done', title: 'Publish'},
            ]);
        });

        /**
         * @objective A phase is timed from its start until now while it is active, and from its start until
         * it ended once it is done.
         */
        test('times active phases until now and done phases until they ended', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // The page's clock is faked so a long wait takes no real time.
            await page.clock.install();
            const advanceClock = async (milliseconds: number) => {
                await page.clock.fastForward(milliseconds);
                await page.evaluate(() => new Promise<void>((resolve) => {
                    setTimeout(resolve, 0);
                }));
            };

            // # Open a run with its first two phases in progress
            const {run} = await startRun(page);
            await runPage.goto(seededData.teamName, run.id);
            await runPage.phases.moveToNextKeepingCurrentOpen();
            await expect(runPage.phases.currentChip).toHaveText('Review');
            await expect(runPage.phases.detail).toHaveText(/^for \d+s$/);

            // # Let five minutes go by
            await advanceClock(5 * 60 * 1000);

            // * The current phase and the first phase, both active, have been going for five minutes
            await expect(runPage.phases.detail).toHaveText(/^for [56]m$/);
            await expect(runPage.phases.step('Draft')).toContainText(/[56]m/);
            await expect(runPage.phases.step('Review')).toContainText(/[56]m/);

            // # Mark the first phase done, then let ten more minutes go by
            await runPage.phases.openMarkerMenu('Draft');
            await runPage.phases.chooseMarkerAction();
            await expect(runPage.phases.step('Draft')).toHaveAttribute('data-status', 'done');
            const finished = phaseOf(await getRun(page, run.id), 'Draft');
            const doneText = `${Math.floor((finished.ended_at - finished.started_at) / 1000)}s`;
            await expect(runPage.phases.step('Draft')).toContainText(doneText);
            await advanceClock(10 * 60 * 1000);

            // * The current phase keeps counting while the done phase stays at the time it had when it ended
            await expect(runPage.phases.detail).toHaveText(/^for 1[56]m$/);
            await expect(runPage.phases.step('Draft')).toContainText(doneText);
            await expect(runPage.phases.step('Draft')).not.toContainText(/\d+m/);
        });
    });

    test.describe('permissions', () => {
        /**
         * @objective Someone who is neither the run owner nor a playbook admin sees no way to move the
         * phases, and the API refuses them.
         */
        test('hides the controls and rejects all phase endpoints for someone who is neither run owner nor playbook admin', {tag: '@playbooks'}, async ({page, browser}) => {
            // # Start a run as the owner, with its first phase kept open next to the second
            const {run} = await startRun(page);
            expect((await moveRunToNextPhase(page, run.id, {close_current: false})).status()).toBe(200);
            const before = await getRun(page, run.id);

            const outsiderContext = await browser.newContext({baseURL});
            try {
                const outsiderPage = await outsiderContext.newPage();
                const outsiderRunPage = new PlaybookRunPage(outsiderPage);

                // # Open the run as a team member who is neither owner nor playbook admin
                await loginAs(outsiderPage, seededData.outsider.username, seededData.outsider.password);
                await outsiderRunPage.goto(seededData.teamName, run.id);

                // * The timeline is shown without any control
                await expect.poll(() => outsiderRunPage.phases.labels()).toEqual([
                    'Draft: In progress',
                    'Review: In progress, current phase',
                    'Publish: Not started',
                ]);
                await expect(outsiderRunPage.phases.currentChip).toHaveText('Review');
                await expect(outsiderRunPage.phases.nextButton).toHaveCount(0);
                await expect(outsiderRunPage.phases.nextMenuButton).toHaveCount(0);
                await expect(outsiderRunPage.phases.finishButton).toHaveCount(0);
                await expect(outsiderRunPage.phases.markers).toHaveCount(0);

                // * The API refuses every phase change
                expect((await moveRunToNextPhase(outsiderPage, run.id)).status()).toBe(403);
                expect((await moveRunToNextPhase(outsiderPage, run.id, {close_current: false})).status()).toBe(403);
                expect((await setRunPhaseState(outsiderPage, run.id, phaseOf(run, 'Draft').checklist_id, 'done')).status()).toBe(403);
                expect((await setRunPhaseState(outsiderPage, run.id, phaseOf(run, 'Review').checklist_id, 'started')).status()).toBe(403);
            } finally {
                await outsiderContext.close();
            }

            // * Nothing changed
            const after = await getRun(page, run.id);
            expect(after.phases).toEqual(before.phases);
            expect(phaseEvents(after)).toEqual(phaseEvents(before));
        });

        /**
         * @objective The run owner can move the phases even if they are not a playbook admin, and a playbook
         * admin can even if they are not the run owner.
         */
        test('lets the run owner and a playbook admin move the phases', {tag: '@playbooks'}, async ({page, browser}) => {
            // # Start a run owned by the team member, from a playbook the other user administers
            const {run} = await startRun(page, {customPhases: articlePhases}, seededData.outsider);
            expect(run.owner_user_id).toBe(seededData.outsider.id);

            // * The playbook admin, who does not own the run, can move it
            expect((await moveRunToNextPhase(page, run.id)).status()).toBe(200);
            expect(phaseStatuses(await getRun(page, run.id))).toEqual([['Draft', 'done', false], ['Review', 'started', true], ['Publish', 'not_started', false]]);

            const ownerContext = await browser.newContext({baseURL});
            try {
                const ownerPage = await ownerContext.newPage();
                const ownerRunPage = new PlaybookRunPage(ownerPage);

                // # Open the run as its owner, who is not a playbook admin
                await loginAs(ownerPage, seededData.outsider.username, seededData.outsider.password);
                await ownerRunPage.goto(seededData.teamName, run.id);
                await expect.poll(() => ownerRunPage.phases.labels()).toEqual([
                    'Draft: Done',
                    'Review: In progress, current phase',
                    'Publish: Not started',
                ]);

                // * The run owner has the controls and can move the run
                await expect(ownerRunPage.phases.nextButton).toHaveText('Move to Publish');
                await ownerRunPage.phases.moveToNext();
                await expect.poll(() => ownerRunPage.phases.labels()).toEqual([
                    'Draft: Done',
                    'Review: Done',
                    'Publish: In progress, current phase',
                ]);

                // * The run owner can also use the API directly
                expect((await setRunPhaseState(ownerPage, run.id, phaseOf(run, 'Review').checklist_id, 'started')).status()).toBe(200);
            } finally {
                await ownerContext.close();
            }

            // * The people who moved the run are on the events
            const restRun = await getRun(page, run.id);
            expect(phaseEventsWithAuthor(restRun).filter((event) => event.source === 'manual').map((event) => [event.type, event.title, event.user])).toEqual([
                ['phase_done', 'Draft', seededData.owner.id],
                ['phase_started', 'Review', seededData.owner.id],
                ['phase_done', 'Review', seededData.outsider.id],
                ['phase_started', 'Publish', seededData.outsider.id],
                ['phase_reopened', 'Review', seededData.outsider.id],
            ]);
        });
    });

    test.describe('REST errors', () => {
        /**
         * @objective Phase changes are refused, with a 400, for runs that have no custom phases of their own.
         */
        test('rejects moving and marking phases on a run without custom phases', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run with task list phases and one without phases
            const {run: taskListRun} = await startRun(page, {useChecklistsAsPhases: true});
            const {run: plainRun} = await startRun(page, {});
            const taskListPhase = phaseOf(taskListRun, 'Prepare');

            // * Task list phases cannot be moved this way
            expect((await moveRunToNextPhase(page, taskListRun.id)).status()).toBe(400);
            expect((await moveRunToNextPhase(page, taskListRun.id, {close_current: false})).status()).toBe(400);
            expect((await setRunPhaseState(page, taskListRun.id, taskListPhase.checklist_id, 'done')).status()).toBe(400);
            expect((await setRunPhaseState(page, taskListRun.id, taskListPhase.checklist_id, 'started')).status()).toBe(400);

            // * A run without phases cannot be moved either
            expect((await moveRunToNextPhase(page, plainRun.id)).status()).toBe(400);
            expect((await setRunPhaseState(page, plainRun.id, plainRun.checklists[0].id, 'done')).status()).toBe(400);

            // * Nothing was recorded for the task list phases run
            const after = await getRun(page, taskListRun.id);
            expect(phaseEvents(after)).toEqual([{type: 'phase_started', title: 'Prepare'}]);
            expect(phaseOf(after, 'Prepare').status).toBe('started');
        });

        /**
         * @objective A finished run's phases cannot be changed.
         */
        test('rejects moving and marking phases on a finished run', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run with its second phase current, and finish it
            const {run} = await startRun(page);
            await moveOn(page, run.id, 1);
            await finishRun(page, run.id);
            const before = await getRun(page, run.id);

            // * Every phase change is a bad request
            expect((await moveRunToNextPhase(page, run.id)).status()).toBe(400);
            expect((await moveRunToNextPhase(page, run.id, {close_current: false})).status()).toBe(400);
            expect((await setRunPhaseState(page, run.id, phaseOf(run, 'Review').checklist_id, 'done')).status()).toBe(400);
            expect((await setRunPhaseState(page, run.id, phaseOf(run, 'Draft').checklist_id, 'started')).status()).toBe(400);

            // * Nothing changed
            const after = await getRun(page, run.id);
            expect(after.phases).toEqual(before.phases);
            expect(phaseEvents(after)).toEqual(phaseEvents(before));
        });

        /**
         * @objective There is no moving past the last phase, finishing a phase that has not started,
         * an unknown phase or an invalid state.
         */
        test('rejects moving past the last phase, finishing a phase not started, unknown phases and invalid states', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run in its last phase
            const {run} = await startRun(page);
            await moveOn(page, run.id, 2);
            const before = await getRun(page, run.id);
            const publish = phaseOf(before, 'Publish');

            // * There is no phase after the last one
            expect((await moveRunToNextPhase(page, run.id)).status()).toBe(400);
            expect((await moveRunToNextPhase(page, run.id, {close_current: false})).status()).toBe(400);

            // * An unknown phase is a bad request
            expect((await setRunPhaseState(page, run.id, 'doesnotexist', 'done')).status()).toBe(400);
            expect((await setRunPhaseState(page, run.id, 'doesnotexist', 'started')).status()).toBe(400);

            // * An invalid state is a bad request
            for (const state of ['', 'closed', 'DONE', 'in_progress']) {
                expect((await setRunPhaseState(page, run.id, publish.checklist_id, state)).status(), `state "${state}"`).toBe(400);
            }
            const badBody = await page.request.put(`/plugins/playbooks/api/v0/runs/${run.id}/phases/${publish.checklist_id}/state`, {
                headers: {'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json'},
                data: '{not json',
            });
            expect(badBody.status()).toBe(400);
            const badMoveBody = await page.request.post(`/plugins/playbooks/api/v0/runs/${run.id}/phases/move`, {
                headers: {'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json'},
                data: '{not json',
            });
            expect(badMoveBody.status()).toBe(400);

            // # Start a fresh run, whose second phase has not started
            const {run: freshRun} = await startRun(page);
            const freshReview = phaseOf(freshRun, 'Review');

            // * A phase that has not started cannot be marked done
            expect((await setRunPhaseState(page, freshRun.id, freshReview.checklist_id, 'done')).status()).toBe(400);
            expect(phaseOf(await getRun(page, freshRun.id), 'Review')).toMatchObject({status: 'not_started', started_at: 0, ended_at: 0});

            // * Nor can one that has not started be reopened
            expect((await setRunPhaseState(page, freshRun.id, freshReview.checklist_id, 'started')).status()).toBe(400);
            expect(phaseOf(await getRun(page, freshRun.id), 'Review')).toMatchObject({status: 'not_started', started_at: 0, ended_at: 0});

            // * Nothing changed in either run
            const after = await getRun(page, run.id);
            expect(after.phases).toEqual(before.phases);
            expect(phaseEvents(after)).toEqual(phaseEvents(before));
            expect(phaseEvents(await getRun(page, freshRun.id))).toEqual([{type: 'phase_started', title: 'Draft'}]);
        });

        /**
         * @objective Marking a done phase done, or reopening a started one, changes nothing and succeeds.
         */
        test('treats marking a done phase done and reopening a started phase as no-ops that succeed', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run with its first phase done and the second one started
            const {run} = await startRun(page);
            await moveOn(page, run.id, 1);
            const before = await getRun(page, run.id);

            // * Marking the done phase done again succeeds without changing it
            expect((await setRunPhaseState(page, run.id, phaseOf(run, 'Draft').checklist_id, 'done')).status()).toBe(200);

            // * Reopening the phase that is already started succeeds without changing it
            expect((await setRunPhaseState(page, run.id, phaseOf(run, 'Review').checklist_id, 'started')).status()).toBe(200);

            // * The phases and the events are exactly as before
            const after = await getRun(page, run.id);
            expect(after.phases).toEqual(before.phases);
            expect(phaseEvents(after)).toEqual(phaseEvents(before));
            expect(after.timeline_events.map((event) => event.id).sort()).toEqual(before.timeline_events.map((event) => event.id).sort());
        });

        /**
         * @objective Moving without a body, or with an empty one, finishes the current phase; only an explicit
         * false keeps it open.
         */
        test('finishes the current phase when the move has no body or no close_current, and keeps it open only when asked', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run with four phases
            const {run} = await startRun(page, {customPhases: ['One', 'Two', 'Three', 'Four']});

            // # Move on without a body
            expect((await moveRunToNextPhase(page, run.id)).status()).toBe(200);

            // * The phase it left is done
            expect(phaseStatuses(await getRun(page, run.id))).toEqual([['One', 'done', false], ['Two', 'started', true], ['Three', 'not_started', false], ['Four', 'not_started', false]]);

            // # Move on with a body without close_current
            expect((await moveRunToNextPhase(page, run.id, {})).status()).toBe(200);

            // * The phase it left is done again
            expect(phaseStatuses(await getRun(page, run.id))).toEqual([['One', 'done', false], ['Two', 'done', false], ['Three', 'started', true], ['Four', 'not_started', false]]);

            // # Move on with close_current false
            expect((await moveRunToNextPhase(page, run.id, {close_current: false})).status()).toBe(200);

            // * The phase it left is still open
            const restRun = await getRun(page, run.id);
            expect(phaseStatuses(restRun)).toEqual([['One', 'done', false], ['Two', 'done', false], ['Three', 'started', false], ['Four', 'started', true]]);
            expect(phaseEvents(restRun).map((event) => `${event.type} ${event.title}`)).toEqual([
                'phase_started One',
                'phase_done One',
                'current_phase_changed Two',
                'phase_started Two',
                'phase_done Two',
                'current_phase_changed Three',
                'phase_started Three',
                'current_phase_changed Four',
                'phase_started Four',
            ]);
        });

        /**
         * @objective Moving on when the current phase was already finished does not finish it again.
         */
        test('does not write a second done event when moving on from a phase that is already done', {tag: '@playbooks'}, async ({page}) => {
            // # Finish the first phase by hand, then move on
            const {run} = await startRun(page);
            expect((await setRunPhaseState(page, run.id, phaseOf(run, 'Draft').checklist_id, 'done')).status()).toBe(200);
            const done = phaseOf(await getRun(page, run.id), 'Draft');
            expect((await moveRunToNextPhase(page, run.id)).status()).toBe(200);

            // * The first phase has one done event and kept the time it ended, and the next one started
            const restRun = await getRun(page, run.id);
            expect(phaseEvents(restRun)).toEqual([
                {type: 'phase_started', title: 'Draft'},
                {type: 'phase_done', title: 'Draft'},
                {type: 'current_phase_changed', title: 'Review'},
                {type: 'phase_started', title: 'Review'},
            ]);
            expect(phaseOf(restRun, 'Draft')).toMatchObject({status: 'done', ended_at: done.ended_at});
            expect(phaseOf(restRun, 'Review').current).toBe(true);
        });
    });

    test.describe('phase timeline events', () => {
        /**
         * @objective Phase events are part of the record and cannot be deleted.
         */
        test('rejects deleting any kind of phase timeline event', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run and do everything a person can, so every kind of event exists
            const {run} = await startRun(page);
            expect((await moveRunToNextPhase(page, run.id)).status()).toBe(200);
            expect((await setRunPhaseState(page, run.id, phaseOf(run, 'Draft').checklist_id, 'started')).status()).toBe(200);
            const restRun = await getRun(page, run.id);
            const events = phaseTimelineEvents(restRun);
            expect(new Set(events.map((event) => event.event_type))).toEqual(new Set(['phase_started', 'phase_done', 'current_phase_changed', 'phase_reopened']));

            // * None of them can be deleted
            for (const event of events) {
                expect((await deleteTimelineEvent(page, run.id, event.id)).status(), `deleting ${event.event_type}`).toBe(400);
            }

            // * They are all still in the timeline
            const after = await getRun(page, run.id);
            expect(after.timeline_events.filter((event) => events.some((original) => original.id === event.id) && event.delete_at === 0)).toHaveLength(events.length);
            expect(phaseEvents(after)).toEqual(phaseEvents(restRun));
        });
    });

    test.describe('finished runs', () => {
        // Starts a run whose first phase is still open, second phase done and third phase running, and
        // returns it with the phases it had just before it is finished.
        async function startRunWithPhasesRunning(page: Page) {
            const {run} = await startRun(page);
            expect((await moveRunToNextPhase(page, run.id, {close_current: false})).status()).toBe(200);
            expect((await moveRunToNextPhase(page, run.id)).status()).toBe(200);
            return {run, before: await getRun(page, run.id)};
        }

        /**
         * @objective Finishing a run stops the clocks of running phases without marking them done.
         */
        test('stops the running phases when the run is finished without marking them done', {tag: '@playbooks'}, async ({page}) => {
            // # Finish a run while two phases are running and one is done
            const {run, before} = await startRunWithPhasesRunning(page);
            expect(phaseStatuses(before)).toEqual([['Draft', 'started', false], ['Review', 'done', false], ['Publish', 'started', true]]);
            await finishRun(page, run.id);

            // * The running phases ended with the run, and are not done
            const finished = await getRun(page, run.id);
            expect(finished.end_at).toBeGreaterThan(0);
            expect(phaseOf(finished, 'Draft')).toMatchObject({status: 'started', ended_at: finished.end_at});
            expect(phaseOf(finished, 'Publish')).toMatchObject({status: 'started', ended_at: finished.end_at, current: true});

            // * The phase that was done kept its own end, and the statuses are unchanged
            expect(phaseOf(finished, 'Review').ended_at).toBe(phaseOf(before, 'Review').ended_at);
            expect(finished.phases?.map((phase) => phase.status)).toEqual(before.phases?.map((phase) => phase.status));
            expect(finished.phases?.map((phase) => phase.started_at)).toEqual(before.phases?.map((phase) => phase.started_at));

            // * No phase was marked done by finishing
            expect(phaseEvents(finished)).toEqual(phaseEvents(before));
            expect(phaseEvents(finished).filter((event) => event.type === 'phase_done')).toEqual([{type: 'phase_done', title: 'Review'}]);
        });

        /**
         * @objective Restoring a finished run resumes the clocks of its phases.
         */
        test('resumes the phases when a finished run is restored', {tag: '@playbooks'}, async ({page}) => {
            // # Finish a run while two phases are running, then restore it
            const {run, before} = await startRunWithPhasesRunning(page);
            await finishRun(page, run.id);
            expect(phaseOf(await getRun(page, run.id), 'Publish').ended_at).toBeGreaterThan(0);
            await restoreRun(page, run.id);

            // * The run is active again and the two phases are running again from their starts
            const restored = await getRun(page, run.id);
            expect(restored.end_at).toBe(0);
            expect(phaseOf(restored, 'Draft')).toMatchObject({status: 'started', started_at: phaseOf(before, 'Draft').started_at, ended_at: 0});
            expect(phaseOf(restored, 'Publish')).toMatchObject({status: 'started', started_at: phaseOf(before, 'Publish').started_at, ended_at: 0, current: true});
            expect(phaseOf(restored, 'Review')).toMatchObject({status: 'done', ended_at: phaseOf(before, 'Review').ended_at});

            // * Nothing was added to the timeline, and the run can be moved again
            expect(phaseEvents(restored)).toEqual(phaseEvents(before));
            expect((await setRunPhaseState(page, run.id, phaseOf(run, 'Publish').checklist_id, 'done')).status()).toBe(200);
            expect(phaseOf(await getRun(page, run.id), 'Publish').status).toBe('done');
        });

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

            // # Open a run whose third phase is running
            const {run} = await startRunWithPhasesRunning(page);
            await runPage.goto(seededData.teamName, run.id);
            await expect(runPage.phases.currentChip).toHaveText('Publish');
            await expect(runPage.phases.detail).toHaveText(/^for \d+s$/);

            // # Finish the run while the page stays open
            await finishRun(page, run.id);
            const finished = phaseOf(await getRun(page, run.id), 'Publish');
            const stoppedAt = `for ${Math.floor((finished.ended_at - finished.started_at) / 1000)}s`;

            // * The shown time is the one the run finished with, it no longer advances, and no phase is done
            await expect(runPage.phases.detail).toHaveText(stoppedAt);
            await advanceClock(10 * 60 * 1000);
            await expect(runPage.phases.detail).toHaveText(stoppedAt);
            await expect(runPage.phases.step('Publish')).toHaveAttribute('data-status', 'started');
            await expect(runPage.phases.step('Draft')).toHaveAttribute('data-status', 'started');

            // # Restore the run while the page stays open
            await restoreRun(page, run.id);

            // * The time runs again
            await advanceClock(5 * 60 * 1000);
            await expect(runPage.phases.detail).toHaveText(/^for \d+m$/);
            await expect(runPage.phases.detail).not.toHaveText(stoppedAt);
        });
    });

    test.describe('task lists of a custom phases run', () => {
        /**
         * @objective Task lists belong to no phase, so they can be reordered and deleted without
         * touching the phases.
         */
        test('allows reordering and deleting task lists without changing the phases', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run with phases, moved to its second phase
            const {run} = await startRun(page);
            await moveOn(page, run.id, 1);
            const before = await getRun(page, run.id);

            // * Reordering the task lists works, and the phases are not affected
            expect((await moveChecklist(page, run.id, 0, 1)).ok()).toBe(true);
            const reordered = await getRun(page, run.id);
            expect(reordered.checklists.map((checklist) => checklist.title)).toEqual(['Polish', 'Prepare']);
            expect(reordered.phases).toEqual(before.phases);

            // * Deleting a task list works, and the phases are not affected
            expect((await removeChecklist(page, run.id, 0)).ok()).toBe(true);
            const removed = await getRun(page, run.id);
            expect(removed.checklists.map((checklist) => checklist.title)).toEqual(['Prepare']);
            expect(removed.phases).toEqual(before.phases);
            expect(phaseEvents(removed)).toEqual(phaseEvents(before));
        });

        /**
         * @objective The run page keeps the drag handle on task lists of a custom phases run.
         */
        test('shows the task list drag handle on a custom phases run', {tag: '@playbooks'}, async ({page}) => {
            const runPage = new PlaybookRunPage(page);

            // # Open a run with custom phases and hover over a task list
            const {run} = await startRun(page);
            await runPage.goto(seededData.teamName, run.id);
            await runPage.hoverChecklistHeader('Prepare');

            // * The task list can be dragged
            await expect(runPage.checklistHeader('Prepare').getByTitle('Drag to reorder checklist')).toBeVisible();
        });
    });

    test.describe('graphql', () => {
        /**
         * @objective Phases, custom ones included, are only exposed over REST, not over GraphQL.
         */
        test('does not expose custom phases in the GraphQL run query', {tag: '@playbooks'}, async ({page}) => {
            // # Start a run with custom phases
            const {run} = await startRun(page);

            // * The run can be queried without phases
            const control = await graphqlQuery(page, `{run(id: "${run.id}") {id name}}`);
            expect(control.ok()).toBe(true);
            expect((await control.json()).data.run.id).toBe(run.id);

            // * Asking for the phases or the custom phases is an error
            for (const field of ['phases {title}', 'customPhases {title}', 'custom_phases {title}']) {
                const response = await graphqlQuery(page, `{run(id: "${run.id}") {id ${field}}}`);
                const body = await response.json();
                expect(body.errors, field).toHaveLength(1);
                expect(body.data?.run, field).toBeFalsy();
            }

            // * The schema of a run has no field about phases
            const schemaResponse = await graphqlQuery(page, '{__type(name: "Run") {fields {name}}}');
            const fieldNames = ((await schemaResponse.json()).data.__type.fields as Array<{name: string}>).map((field) => field.name);
            expect(fieldNames).toContain('checklists');
            expect(fieldNames.filter((name) => /phase/i.test(name))).toEqual([]);
        });
    });
});
