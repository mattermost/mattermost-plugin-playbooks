// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > edit > conditions > admin', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let priorityField;
    let statusField;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);

        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Condition Test Playbook ' + Date.now(),
            userId: testUser.id,
        }).then((playbook) => {
            testPlaybook = playbook;

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
            }).then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Status',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 2,
                        options: [
                            {name: 'Active'},
                            {name: 'Inactive'},
                        ],
                    },
                }).then(() => {
                    cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                        priorityField = fields.find((f) => f.name === 'Priority');
                        statusField = fields.find((f) => f.name === 'Status');
                    });
                });
            });
        });

        cy.viewport('macbook-16');
    });

    describe('create condition', () => {
        it('can create a condition from task menu', () => {
            navigateToPlaybook(testPlaybook.id);

            cy.findAllByTestId('checkbox-item-container').eq(0).trigger('mouseover');

            cy.findAllByTestId('checkbox-item-container').eq(0).within(() => {
                cy.findByTitle('More').click();
            });

            // # Intercept the UpdatePlaybook mutation triggered by creating a condition and assigning it to the task
            cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');

            cy.findByTestId('task-menu-add-condition').click();

            // * Wait for the playbook save to complete before asserting
            cy.wait('@UpdatePlaybook');

            cy.findByTestId('condition-header').should('be.visible');

            cy.reload();

            cy.findByTestId('condition-header').should('be.visible');
        });
    });

    describe('edit condition', () => {
        it('can edit condition expression', () => {
            const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

            cy.apiCreatePlaybookCondition(testPlaybook.id, {
                is: {
                    field_id: priorityField.id,
                    value: [highOptionId],
                },
            }).then((condition) => {
                cy.apiAttachConditionToTask(testPlaybook.id, 0, 0, condition.id);

                navigateToPlaybook(testPlaybook.id);

                cy.findByTestId('condition-header').should('be.visible');

                cy.findByTestId('condition-header').within(() => {
                    cy.findByText('Priority').should('be.visible');
                    cy.findByText('High').should('be.visible');
                });

                cy.findByTestId('condition-header-edit-button').click();

                // * Wait for the condition editor to open
                cy.contains('.condition-select__single-value', 'is').should('be.visible');

                // # Intercept condition update REST calls triggered by expression changes
                cy.intercept('PUT', '/plugins/playbooks/api/v0/playbooks/*/conditions/*').as('updateCondition');

                cy.contains('.condition-select__single-value', 'is').click();
                cy.get('.condition-select__menu').contains('is not').click();

                // * Wait for the condition update to complete before proceeding
                cy.wait('@updateCondition');

                cy.contains('.condition-select__single-value', 'High').click();
                cy.get('.condition-select__menu').contains('Medium').click();

                // * Wait for the second condition update to complete before reloading
                cy.wait('@updateCondition');

                cy.reload();

                cy.findByTestId('condition-header').within(() => {
                    cy.findByText('Priority').should('be.visible');
                    cy.findByText('is not').should('be.visible');
                    cy.findByText('Medium').should('be.visible');
                });
            });
        });

        it('can add second condition with OR operator', () => {
            const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

            cy.apiCreatePlaybookCondition(testPlaybook.id, {
                is: {
                    field_id: priorityField.id,
                    value: [highOptionId],
                },
            }).then((condition) => {
                cy.apiAttachConditionToTask(testPlaybook.id, 0, 0, condition.id);

                navigateToPlaybook(testPlaybook.id);

                cy.findByTestId('condition-header-edit-button').click();

                // * Wait for the condition editor to open
                cy.findByTestId('condition-add-button').should('be.visible');

                cy.findByTestId('condition-add-button').click();

                cy.findAllByTestId('condition-remove-button').should('have.length', 2);

                // # Intercept condition update REST call triggered by selecting a field
                cy.intercept('PUT', '/plugins/playbooks/api/v0/playbooks/*/conditions/*').as('updateCondition');

                cy.contains('.condition-select__single-value', 'Priority').last().click();
                cy.get('.condition-select__menu').contains('Status').click();

                // * Wait for the condition update to save
                cy.wait('@updateCondition');

                cy.contains('.condition-select__single-value', 'OR').should('be.visible');

                cy.reload();

                cy.findByTestId('condition-header').within(() => {
                    cy.findByText('Priority').should('be.visible');
                    cy.findByText('Status').should('be.visible');
                });
            });
        });

        it('can change logical operator from AND to OR', () => {
            const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;
            const activeOptionId = statusField.attrs.options.find((o) => o.name === 'Active').id;

            cy.apiCreatePlaybookCondition(testPlaybook.id, {
                and: [
                    {is: {field_id: priorityField.id, value: [highOptionId]}},
                    {is: {field_id: statusField.id, value: [activeOptionId]}},
                ],
            }).then((condition) => {
                cy.apiAttachConditionToTask(testPlaybook.id, 0, 0, condition.id);

                navigateToPlaybook(testPlaybook.id);

                cy.findByTestId('condition-header-edit-button').click();

                // * Wait for the condition editor to open
                cy.contains('.condition-select__single-value', 'AND').should('be.visible');

                // # Intercept condition update REST call triggered by changing the logical operator
                cy.intercept('PUT', '/plugins/playbooks/api/v0/playbooks/*/conditions/*').as('updateCondition');

                cy.contains('.condition-select__single-value', 'AND').click();
                cy.get('.condition-select__menu').contains('OR').click();

                // * Wait for the condition update to complete before reloading
                cy.wait('@updateCondition');

                cy.reload();

                cy.findByTestId('condition-header').within(() => {
                    cy.findByText(/\bor\b/i).should('be.visible');
                });
            });
        });
    });

    describe('delete condition', () => {
        it('can delete condition', () => {
            const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

            cy.apiCreatePlaybookCondition(testPlaybook.id, {
                is: {
                    field_id: priorityField.id,
                    value: [highOptionId],
                },
            }).then((condition) => {
                cy.apiAttachConditionToTask(testPlaybook.id, 0, 0, condition.id);

                navigateToPlaybook(testPlaybook.id);

                cy.findByTestId('condition-header').should('be.visible');

                cy.findByTestId('condition-header-delete-button').click();

                // # Intercept the UpdatePlaybook mutation triggered after condition deletion
                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');

                cy.findByRole('button', {name: /remove/i}).click();

                // * Wait for the playbook save to complete before asserting deletion
                cy.wait('@UpdatePlaybook');

                cy.findByTestId('condition-header').should('not.exist');

                cy.findByText('Step 1').should('be.visible');

                cy.reload();

                cy.findByTestId('condition-header').should('not.exist');
            });
        });
    });

    describe('assign and remove tasks', () => {
        it('can assign task to existing condition', () => {
            const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

            cy.apiCreatePlaybookCondition(testPlaybook.id, {
                is: {
                    field_id: priorityField.id,
                    value: [highOptionId],
                },
            }).then((condition) => {
                cy.apiAttachConditionToTask(testPlaybook.id, 0, 0, condition.id);

                navigateToPlaybook(testPlaybook.id);

                cy.findByText('Step 1').should('be.visible');
                cy.findByText('Step 2').should('be.visible');

                cy.findAllByTestId('checkbox-item-container').eq(1).trigger('mouseover');

                cy.findAllByTestId('checkbox-item-container').eq(1).within(() => {
                    cy.findByTitle('More').click();
                });

                // * Wait for the task context menu to open
                cy.get('[data-testid^="task-menu-assign-condition-"]').first().should('be.visible');

                // # Intercept the UpdatePlaybook mutation triggered by assigning the task to a condition
                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');

                cy.get('[data-testid^="task-menu-assign-condition-"]').first().click();

                // * Wait for the playbook save to complete before asserting
                cy.wait('@UpdatePlaybook');

                cy.findAllByTestId('condition-header').should('have.length', 1);

                cy.reload();

                cy.findAllByTestId('condition-header').should('have.length', 1);
            });
        });

        it('can remove task from condition group', () => {
            const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

            cy.apiCreatePlaybookCondition(testPlaybook.id, {
                is: {
                    field_id: priorityField.id,
                    value: [highOptionId],
                },
            }).then((condition) => {
                cy.apiAttachConditionToTask(testPlaybook.id, 0, 0, condition.id);
                cy.apiAttachConditionToTask(testPlaybook.id, 0, 1, condition.id);

                navigateToPlaybook(testPlaybook.id);

                cy.findByTestId('condition-header').should('be.visible');

                cy.findAllByTestId('checkbox-item-container').eq(0).trigger('mouseover');

                cy.findAllByTestId('checkbox-item-container').eq(0).within(() => {
                    cy.findByTitle('More').click();
                });

                // * Wait for the task context menu to open
                cy.findByTestId('task-menu-remove-condition').should('be.visible');

                // # Intercept the UpdatePlaybook mutation triggered by removing the task from its condition
                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');

                cy.findByTestId('task-menu-remove-condition').click();

                // * Wait for the playbook save to complete before asserting
                cy.wait('@UpdatePlaybook');

                cy.findByTestId('condition-header').should('be.visible');

                cy.reload();

                cy.findByTestId('condition-header').should('be.visible');
            });
        });
    });

    function navigateToPlaybook(playbookId) {
        cy.visit(`/playbooks/playbooks/${playbookId}/outline`);
    }
});
