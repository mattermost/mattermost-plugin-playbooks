// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks @conditions @actions

import {getRandomId} from '../../utils';

describe('Playbook Conditional Actions', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testCondition;
    let priorityField;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');

        // # Create a fresh playbook with a condition for each test
        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Conditional Actions Test ' + getRandomId(),
            userId: testUser.id,
        }).then((playbook) => {
            testPlaybook = playbook;
        });

        cy.then(() => {
            cy.apiAddPropertyField(testPlaybook.id, {
                name: 'Priority',
                type: 'select',
                attrs: {
                    visibility: 'always',
                    sortOrder: 1,
                    options: [
                        {name: 'High'},
                        {name: 'Medium'},
                        {name: 'Low'},
                    ],
                },
            });

            cy.apiGetPropertyFieldByName(testPlaybook.id, 'Priority').then((field) => {
                priorityField = field;
            });
        });

        cy.then(() => {
            const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

            cy.apiCreatePlaybookCondition(testPlaybook.id, {
                is: {field_id: priorityField.id, value: [highOptionId]},
            }).then((condition) => {
                testCondition = condition;
            });
        });

        cy.then(() => {
            return cy.apiGetPlaybook(testPlaybook.id);
        }).then((playbook) => {
            playbook.checklists[0].items[0].title = 'Conditional Task';
            playbook.checklists[0].items[0].condition_id = testCondition.id;
            return cy.apiUpdatePlaybook(playbook);
        });
    });

    describe('Condition UI with Actions', () => {
        it('displays action editor in edit mode', () => {
            // # Navigate to playbook outline
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Find the condition header and click edit
            cy.findByTestId('condition-header-edit-button').click();

            // * Verify "Then" section is visible for actions
            cy.findByText('Then').should('be.visible');

            // * Verify "Add action" button is visible
            cy.findByText('Add action').should('be.visible');
        });

        it('hides action editor in read-only mode', () => {
            // # Navigate to playbook outline
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // * Verify condition header is in read-only mode (no "Then" visible)
            cy.findByTestId('condition-header').should('exist');
            cy.findByText('Then').should('not.exist');
        });
    });

    describe('Set Owner Action', () => {
        it('can add set_owner action via edit mode', () => {
            // # Navigate to playbook outline
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Click edit on the condition
            cy.findByTestId('condition-header-edit-button').click();

            // # Click "Add action"
            cy.findByText('Add action').click();

            // * Verify action row is added with "Set owner" as default
            cy.findByText('Set owner').should('be.visible');
        });

        it('can change action type to notify_channel', () => {
            // # Navigate to playbook outline
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Click edit on the condition
            cy.findByTestId('condition-header-edit-button').click();

            // # Click "Add action"
            cy.findByText('Add action').click();

            // # Change action type to Notify channel via the select
            cy.get('select').last().select('notify_channel');

            // * Verify "Notify channel" is now selected
            cy.findByText('Select channels').should('be.visible');
        });
    });

    describe('Action Management', () => {
        it('can remove an action', () => {
            // # Navigate to playbook outline
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Click edit on the condition
            cy.findByTestId('condition-header-edit-button').click();

            // # Add an action
            cy.findByText('Add action').click();

            // * Verify action exists
            cy.findByText('Set owner').should('be.visible');

            // # Remove the action by clicking the close icon
            cy.get('.icon-close').last().click();

            // * Verify action is removed and "Add action" is still available
            cy.findByText('Add action').should('be.visible');
        });
    });
});
