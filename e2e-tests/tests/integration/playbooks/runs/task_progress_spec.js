// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > task progress', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testRun;

    const TOTAL_TASKS = 4;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a playbook with a checklist containing 4 tasks
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Task Progress Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [
                    {
                        title: 'Stage 1',
                        items: [
                            {title: 'Task 1'},
                            {title: 'Task 2'},
                            {title: 'Task 3'},
                            {title: 'Task 4'},
                        ],
                    },
                ],
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    after(() => {
        cy.apiLogin(testUser);
        cy.apiArchivePlaybook(testPlaybook.id);
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport
        cy.viewport('macbook-13');

        // # Start a fresh run for each test
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Task Progress Run (' + getRandomId() + ')',
            ownerUserId: testUser.id,
        }).then((run) => {
            testRun = run;
        });
    });

    it('shows 0/4 progress in runs list when no tasks completed', () => {
        // # Visit the runs list
        cy.visit('/playbooks/runs');

        // # Find the run in the list and assert task progress
        cy.playbooksGetRunListRow(testRun.name).within(() => {
            // * Assert progress is visible before any action
            cy.findByTestId('task-progress-indicator').should('be.visible').and('contain', `0/${TOTAL_TASKS}`);
        });

        // * Assert backend state: all items are uncompleted
        cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
            const items = run.checklists[0].items;
            expect(items[0].state).to.equal('');
            expect(items[1].state).to.equal('');
            expect(items[2].state).to.equal('');
            expect(items[3].state).to.equal('');
        });
    });

    it('shows 2/4 progress after completing 2 tasks', () => {
        // # Complete tasks 0 and 1 via UI
        cy.playbooksVisitRun(testRun.id);
        cy.playbooksCompleteTaskAtIndex(0);
        cy.playbooksCompleteTaskAtIndex(1);

        // # Visit the runs list
        cy.visit('/playbooks/runs');

        // # Find the run in the list and assert task progress
        cy.playbooksGetRunListRow(testRun.name).within(() => {
            // * Assert task progress shows 2/4
            cy.findByTestId('task-progress-indicator').should('contain', `2/${TOTAL_TASKS}`);
        });

        // * Assert backend state: items 0 and 1 are closed, items 2 and 3 are open
        cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
            const items = run.checklists[0].items;
            expect(items[0].state).to.equal('closed');
            expect(items[1].state).to.equal('closed');
            expect(items[2].state).to.equal('');
            expect(items[3].state).to.equal('');
        });
    });

    it('shows 3/4 progress after skipping a task (skipped counts as completed)', () => {
        // # Complete tasks 0 and 1 via UI
        cy.playbooksVisitRun(testRun.id);
        cy.playbooksCompleteTaskAtIndex(0);
        cy.playbooksCompleteTaskAtIndex(1);

        // # Skip task 2 via API — no UI skip command available
        cy.apiSetChecklistItemState(testRun.id, 0, 2, 'skipped');

        // # Visit the runs list
        cy.visit('/playbooks/runs');

        // # Find the run in the list and assert task progress
        cy.playbooksGetRunListRow(testRun.name).within(() => {
            // * Assert task progress shows 3/4 (skipped counts toward completion)
            cy.findByTestId('task-progress-indicator').should('contain', `3/${TOTAL_TASKS}`);
        });

        // * Assert backend state: items 0 and 1 are closed, item 2 is skipped, item 3 is open
        cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
            const items = run.checklists[0].items;
            expect(items[2].state).to.equal('skipped');
            expect(items[3].state).to.equal('');
        });
    });

    it('shows 4/4 progress after all tasks are completed', () => {
        // # Complete all 4 tasks via UI
        cy.playbooksVisitRun(testRun.id);
        cy.playbooksCompleteTaskAtIndex(0);
        cy.playbooksCompleteTaskAtIndex(1);
        cy.playbooksCompleteTaskAtIndex(2);
        cy.playbooksCompleteTaskAtIndex(3);

        // # Visit the runs list
        cy.visit('/playbooks/runs');

        // # Find the run in the list and assert task progress
        cy.playbooksGetRunListRow(testRun.name).within(() => {
            // * Assert task progress shows 4/4
            cy.findByTestId('task-progress-indicator').should('contain', `${TOTAL_TASKS}/${TOTAL_TASKS}`);
        });

        // * Assert backend state: all 4 items are closed
        cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
            const items = run.checklists[0].items;
            expect(items[0].state).to.equal('closed');
            expect(items[1].state).to.equal('closed');
            expect(items[2].state).to.equal('closed');
            expect(items[3].state).to.equal('closed');
        });
    });
});
