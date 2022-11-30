// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('playbooks > edit > task actions', () => {
    let testTeam;
    let testSysadmin;
    let testUser;
    let featureFlagPrevValue;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateCustomAdmin().then(({sysadmin}) => {
                testSysadmin = sysadmin;
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

    });

    describe('modal', () => {
        let testPlaybook;

        beforeEach(() => {
            // # Create a playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook (' + Date.now() + ')',
                checklists: [{
                    title: 'Test Checklist',
                    items: [
                        {title: 'Test Task'},
                    ],
                }],
                memberIDs: [
                    testUser.id,
                ],
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            });
        });

        const editTask = () => {
            cy.findByTestId('checkbox-item-container').within(() => {
                cy.findByText('Test Task').trigger('mouseover');
                cy.findByTestId('hover-menu-edit-button').click();
            });
        };

        it('disallows no keywords', () => {
            // Open the task actions modal
            editTask();
            cy.findByText('Task Actions').click();

            // Attempt to enable the trigger
            cy.findByText('Mark the task as done').click();

            // Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // Verify no actions are configured
            cy.findByText('Task Actions').should('exist');
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                expect(playbook.checklists[0].items[0].task_actions).to.be.null;
            });
        });

        it('allows a single keyword', () => {
            // Open the task actions modal
            editTask();
            cy.findByText('Task Actions').click();

            // Add a keyword
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
            });

            // Enable the trigger
            cy.findByText('Mark the task as done').click();

            // Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // Verify configured actions
            cy.findByText('1 action');
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.isArray(trigger.keywords, ['keyword1']);
                assert.isTrue(actions.enabled);
            });
        });

        it('allows multiple keywords', () => {
            // Open the task actions modal
            editTask();
            cy.findByText('Task Actions').click();

            // Add multiple keywords
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
                cy.get('input').eq(0).type('keyword2{enter}', {force: true});
            });

            // Enable the trigger
            cy.findByText('Mark the task as done').click();

            // Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // Verify configured actions
            cy.findByText('1 action');
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.isArray(trigger.keywords, ['keyword1', 'keyword2']);
                assert.isTrue(actions.enabled);
            });
        });

        it('allows multi-word phrases', () => {
            // Open the task actions modal
            editTask();
            cy.findByText('Task Actions').click();

            // Add a phrase
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('a phrase with multiple words{enter}', {force: true});
            });

            // Enable the trigger
            cy.findByText('Mark the task as done').click();

            // Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // Verify configured actions
            cy.findByText('1 action');
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.isArray(trigger.keywords, ['a phrase with multiple words']);
                assert.isTrue(actions.enabled);
            });
        });

        it('allows removing previously configured keywords', () => {
            // Open the task actions modal
            editTask();
            cy.findByText('Task Actions').click();

            // Add multiple keywords
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
                cy.get('input').eq(0).type('keyword2{enter}', {force: true});
            });

            // Enable the trigger
            cy.findByText('Mark the task as done').click();

            // Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // Re-open the dialog
            cy.findByText('1 action').click();

            // Remove one trigger keyword
            cy.get('.modal-body').within(() => {
                cy.findByText('keyword1').next().click();
            });

            // Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // Verify configured actions
            cy.findByText('1 action');
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.isArray(trigger.keywords, ['keyword2']);
                assert.isTrue(actions.enabled);
            });
        });

        // TODO: This test actually fails, because the UI thinks there is still one action configured.
        it('disables when all keywords removed', () => {
            // Open the task actions modal
            editTask();
            cy.findByText('Task Actions').click();

            // Add multiple keywords
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
                cy.get('input').eq(0).type('keyword2{enter}', {force: true});
            });

            // Enable the trigger
            cy.findByText('Mark the task as done').click();

            // Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // Re-open the dialog
            cy.findByText('1 action').click();

            // Remove all trigger keywords
            cy.get('.modal-body').within(() => {
                cy.findByText('keyword1').next().click();
                cy.findByText('keyword2').next().click();
            });

            // Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // Verify configured actions
            cy.findByText('Task Actions');
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.isArray(trigger.keywords, ['']);
                assert.isFalse(actions.enabled);
            });
        });

//         it('allows no user', () => {
//         });

//         it('allows a single user', () => {
//         });

//         it('allows configuring multiple users', () => {
//         });

//         it('rejects unknown user', () => {
//         });

//         it('allows removing previously configured users', () => {
//         });
    });
});
