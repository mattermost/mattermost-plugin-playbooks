// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../../utils';

describe('playbooks > edit > conditions > user', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testRun;
    let priorityField;
    let statusField;
    let testCondition;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    describe('task visibility with simple condition', () => {
        it('hides task when condition not met', () => {
            // # Create playbook with a task conditioned on Priority = High
            createPlaybookWithConditionalTask('High');

            // # Start a run
            startRun();

            // # Navigate to the run
            navigateToRun();

            // * Verify task is hidden when no priority is set
            verifyTaskHidden('Conditional Task');

            // # Set priority to Low (condition not met)
            cy.playbooksSetRunPropertyViaRHS('Priority', 'Low');

            // * Verify task remains hidden
            verifyTaskHidden('Conditional Task');

            // # Set priority to High (condition met)
            cy.playbooksSetRunPropertyViaRHS('Priority', 'High');

            // * Verify task is now visible
            verifyTaskVisible('Conditional Task');
        });
    });

    describe('task visibility with AND logic', () => {
        it('evaluates AND condition correctly', () => {
            // # Create playbook with Priority and Status fields
            createPlaybookWithAttributes();

            cy.then(() => {
                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;
                const activeOptionId = statusField.attrs.options.find((o) => o.name === 'Active').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    and: [
                        {is: {field_id: priorityField.id, value: [highOptionId]}},
                        {is: {field_id: statusField.id, value: [activeOptionId]}},
                    ],
                }).then((condition) => {
                    testCondition = condition;

                    return cy.apiGetPlaybook(testPlaybook.id);
                }).then((playbook) => {
                    playbook.checklists[0].items[0].title = 'AND Conditional Task';
                    playbook.checklists[0].items[0].condition_id = testCondition.id;
                    return cy.apiUpdatePlaybook(playbook);
                }).then(() => {
                    // # Start a run and navigate to it
                    startRun();
                    navigateToRun();

                    // * Verify task is hidden when no properties are set
                    verifyTaskHidden('AND Conditional Task');

                    // # Set only Priority to High (Status condition not met)
                    cy.playbooksSetRunPropertyViaRHS('Priority', 'High');

                    // * Verify task remains hidden (AND requires both conditions)
                    verifyTaskHidden('AND Conditional Task');

                    // # Set Status to Active (both conditions now met)
                    cy.playbooksSetRunPropertyViaRHS('Status', 'Active');

                    // * Verify task is visible when both conditions are met
                    verifyTaskVisible('AND Conditional Task');

                    // # Set Priority back to Low (AND condition broken)
                    cy.playbooksSetRunPropertyViaRHS('Priority', 'Low');

                    // * Verify task is hidden again
                    verifyTaskHidden('AND Conditional Task');
                });
            });
        });
    });

    describe('task visibility with OR logic', () => {
        it('evaluates OR condition correctly', () => {
            // # Create playbook with Priority field
            createPlaybookWithAttributes();

            cy.then(() => {
                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;
                const mediumOptionId = priorityField.attrs.options.find((o) => o.name === 'Medium').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    or: [
                        {is: {field_id: priorityField.id, value: [highOptionId]}},
                        {is: {field_id: priorityField.id, value: [mediumOptionId]}},
                    ],
                }).then((condition) => {
                    testCondition = condition;

                    return cy.apiGetPlaybook(testPlaybook.id);
                }).then((playbook) => {
                    playbook.checklists[0].items[0].title = 'OR Conditional Task';
                    playbook.checklists[0].items[0].condition_id = testCondition.id;
                    return cy.apiUpdatePlaybook(playbook);
                }).then(() => {
                    // # Start a run and navigate to it
                    startRun();
                    navigateToRun();

                    // * Verify task is hidden when no priority is set
                    verifyTaskHidden('OR Conditional Task');

                    // # Set priority to Low (neither OR branch is met)
                    cy.playbooksSetRunPropertyViaRHS('Priority', 'Low');

                    // * Verify task remains hidden
                    verifyTaskHidden('OR Conditional Task');

                    // # Set priority to Medium (one OR branch is met)
                    cy.playbooksSetRunPropertyViaRHS('Priority', 'Medium');

                    // * Verify task is visible
                    verifyTaskVisible('OR Conditional Task');

                    // # Set priority to High (other OR branch is met)
                    cy.playbooksSetRunPropertyViaRHS('Priority', 'High');

                    // * Verify task remains visible
                    verifyTaskVisible('OR Conditional Task');
                });
            });
        });
    });

    describe('modified task behavior', () => {
        it('shows warning indicator for modified task when condition no longer met', () => {
            // # Create playbook with a task conditioned on Priority = High
            createPlaybookWithConditionalTask('High');

            // # Start a run
            startRun();

            // # Navigate to the run
            navigateToRun();

            // # Set priority to High so the task becomes visible
            cy.playbooksSetRunPropertyViaRHS('Priority', 'High');

            // * Verify task is visible
            verifyTaskVisible('Conditional Task');

            // # Intercept the checklist item state REST call triggered by checking the task
            cy.playbooksInterceptChecklistItemState('checklistItemState');

            cy.findByText('Conditional Task').closest('[data-testid="checkbox-item-container"]').within(() => {
                cy.get('input[type="checkbox"]').check();
            });

            // * Wait for the task state update to complete before changing the property
            cy.wait('@checklistItemState');

            // # Set priority to Low (condition no longer met, but task was already modified)
            cy.playbooksSetRunPropertyViaRHS('Priority', 'Low');

            // * Verify task remains visible due to prior modification
            verifyTaskVisible('Conditional Task');

            // * Verify the warning indicator is shown on the task
            cy.findByTestId('condition-indicator-error').should('exist');
        });
    });

    describe('real-time updates', () => {
        it('updates task visibility without page reload', () => {
            // # Create playbook with a task conditioned on Priority = High
            createPlaybookWithConditionalTask('High');

            // # Start a run
            startRun();

            // # Navigate to the run
            navigateToRun();

            // * Verify task is hidden initially
            verifyTaskHidden('Conditional Task');

            // # Set priority to High (condition met)
            cy.playbooksSetRunPropertyViaRHS('Priority', 'High');

            // * Verify task becomes visible without a page reload
            verifyTaskVisible('Conditional Task');

            // # Change priority to Medium (condition no longer met)
            cy.playbooksSetRunPropertyViaRHS('Priority', 'Medium');

            // * Verify task hides again
            verifyTaskHidden('Conditional Task');

            // # Set priority back to High
            cy.playbooksSetRunPropertyViaRHS('Priority', 'High');

            // * Verify task is visible again
            verifyTaskVisible('Conditional Task');
        });
    });

    describe('channel messages for conditional tasks', () => {
        it('posts channel message when property change adds new tasks', () => {
            // # Create playbook with a task conditioned on Priority = High
            createPlaybookWithConditionalTask('High');

            // # Start a run
            startRun();

            // # Navigate to the run
            navigateToRun();

            // # Change property to trigger task addition
            cy.playbooksSetRunPropertyViaRHS('Priority', 'High');

            // # Navigate to the run's channel
            cy.then(() => {
                cy.visit(`/${testTeam.name}/channels/${testRun.channel_id}`);
            });

            // * Verify message posted about new tasks
            cy.get('#postListContent').within(() => {
                cy.contains('updated Priority to High, resulting in the addition of 1 new task to Stage 1 checklist').should('exist');
            });
        });

        it('posts message when multiple tasks are added', () => {
            // # Create playbook with Priority field
            createPlaybookWithAttributes();

            cy.then(() => {
                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

                // # Create condition and add multiple conditional tasks
                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: priorityField.id,
                        value: [highOptionId],
                    },
                }).then((condition) => {
                    testCondition = condition;

                    return cy.apiGetPlaybook(testPlaybook.id);
                }).then((playbook) => {
                    // # Add multiple conditional tasks
                    playbook.checklists[0].items = [
                        {
                            title: 'High Priority Task 1',
                            condition_id: testCondition.id,
                        },
                        {
                            title: 'High Priority Task 2',
                            condition_id: testCondition.id,
                        },
                        {
                            title: 'High Priority Task 3',
                            condition_id: testCondition.id,
                        },
                    ];
                    return cy.apiUpdatePlaybook(playbook);
                }).then(() => {
                    // # Start a run and navigate to it
                    startRun();

                    // # Navigate to the run
                    navigateToRun();

                    // # Change property to trigger task additions
                    cy.playbooksSetRunPropertyViaRHS('Priority', 'High');

                    // # Navigate to the run's channel
                    cy.then(() => {
                        cy.visit(`/${testTeam.name}/channels/${testRun.channel_id}`);
                    });

                    // * Verify message posted about multiple tasks
                    cy.get('#postListContent').within(() => {
                        cy.contains('updated Priority to High, resulting in the addition of 3 new tasks to Stage 1 checklist').should('exist');
                    });
                });
            });
        });
    });

    describe('text property conditions', () => {
        it('evaluates is and is_not conditions for text fields', () => {
            let textField;
            let isCondition;
            let isNotCondition;

            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Text Condition Test ' + getRandomId(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Code',
                    type: 'text',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                    },
                });

                cy.apiGetPropertyFieldByName(testPlaybook.id, 'Code').then((field) => {
                    textField = field;
                });
            });

            cy.then(() => {
                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: textField.id,
                        value: 'abc',
                    },
                }).then((condition) => {
                    isCondition = condition;
                });

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    isNot: {
                        field_id: textField.id,
                        value: 'abc',
                    },
                }).then((condition) => {
                    isNotCondition = condition;
                });
            });

            cy.then(() => {
                return cy.apiGetPlaybook(testPlaybook.id);
            }).then((playbook) => {
                playbook.checklists[0].items[0].title = 'Task when IS abc';
                playbook.checklists[0].items[0].condition_id = isCondition.id;

                playbook.checklists[0].items.push({
                    title: 'Task when NOT abc',
                    condition_id: isNotCondition.id,
                });

                return cy.apiUpdatePlaybook(playbook);
            }).then(() => {
                // # Start a run and navigate to it
                startRun();
                navigateToRun();

                // * Verify IS task is hidden and IS NOT task is visible with no value set
                verifyTaskHidden('Task when IS abc');
                verifyTaskVisible('Task when NOT abc');

                // # Set Code property to 'abc' (IS condition met)
                setTextPropertyValue('Code', 'abc');

                // * Verify IS task is now visible and IS NOT task is hidden
                verifyTaskVisible('Task when IS abc');
                verifyTaskHidden('Task when NOT abc');

                // # Set Code property to 'xyz' (IS condition no longer met)
                setTextPropertyValue('Code', 'xyz');

                // * Verify IS task is hidden and IS NOT task is visible again
                verifyTaskHidden('Task when IS abc');
                verifyTaskVisible('Task when NOT abc');
            });
        });
    });

    function createPlaybookWithAttributes() {
        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Condition User Test ' + getRandomId(),
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
            });

            cy.apiGetPropertyFieldByName(testPlaybook.id, 'Priority').then((field) => {
                priorityField = field;
            });

            cy.apiGetPropertyFieldByName(testPlaybook.id, 'Status').then((field) => {
                statusField = field;
            });
        });
    }

    function createPlaybookWithConditionalTask(priorityValue) {
        createPlaybookWithAttributes();

        cy.then(() => {
            const optionId = priorityField.attrs.options.find((o) => o.name === priorityValue).id;

            cy.apiCreatePlaybookCondition(testPlaybook.id, {
                is: {
                    field_id: priorityField.id,
                    value: [optionId],
                },
            }).then((condition) => {
                testCondition = condition;

                return cy.apiGetPlaybook(testPlaybook.id);
            }).then((playbook) => {
                playbook.checklists[0].items[0].title = 'Conditional Task';
                playbook.checklists[0].items[0].condition_id = testCondition.id;
                return cy.apiUpdatePlaybook(playbook);
            });
        });
    }

    function startRun() {
        cy.then(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'Condition Test Run',
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;
            });
        });
    }

    function navigateToRun() {
        cy.then(() => {
            cy.playbooksVisitRun(testRun.id);
        });
    }

    function setTextPropertyValue(propertyName, value) {
        const testId = `run-property-${propertyName.toLowerCase().replace(/\s+/g, '-')}`;

        // # Intercept the SetRunPropertyValue mutation before triggering the UI action
        cy.playbooksInterceptGraphQLMutation('SetRunPropertyValue');

        cy.findByRole('complementary').within(() => {
            cy.findByTestId(testId).within(() => {
                cy.findByTestId('property-value').realClick();
            });
        });

        cy.focused().clear().realType(value);
        cy.realPress('Tab');

        // * Wait for the text property value save to complete before proceeding
        cy.wait('@SetRunPropertyValue');
    }

    function verifyTaskVisible(taskTitle) {
        cy.findByText(taskTitle).should('exist').should('be.visible');
    }

    function verifyTaskHidden(taskTitle) {
        cy.findByText(taskTitle).should('not.exist');
    }
});
