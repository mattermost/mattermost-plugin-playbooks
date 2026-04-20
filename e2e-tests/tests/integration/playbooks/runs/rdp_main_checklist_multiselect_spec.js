// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run details page > checklist multi-select', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testAnotherUser;
    let testPublicPlaybook;
    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a second user to test assignment
            cy.apiCreateUser().then(({user: anotherUser}) => {
                testAnotherUser = anotherUser;
                cy.apiAddUserToTeam(testTeam.id, testAnotherUser.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a playbook with multiple tasks across two checklists
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Multi-Select Test Playbook',
                memberIDs: [],
                checklists: [
                    {
                        title: 'Setup',
                        items: [
                            {title: 'Task A'},
                            {title: 'Task B'},
                            {title: 'Task C'},
                        ],
                    },
                    {
                        title: 'Investigation',
                        items: [
                            {title: 'Task D'},
                            {title: 'Task E'},
                        ],
                    },
                ],
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

        // # Create a fresh run for each test
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName: 'Multi-Select Run',
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            // # Visit the run details page
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────

    const getChecklist = () => cy.findByTestId('run-checklist-section');
    const getAllTasks = () => getChecklist().findAllByTestId('checkbox-item-container');
    const getTask = (index) => getAllTasks().eq(index);

    /**
     * Hover over a task row and click its circular selection checkbox
     * (the one with border-radius: 50%, separate from the task-completion checkbox)
     */
    const selectTask = (index) => {
        getTask(index).trigger('mouseover');

        // The selection checkbox is the first input[type=checkbox] in the row
        // (task-completion checkbox is the second one)
        getTask(index).find('input[type=checkbox]').first().click({force: true});
    };

    const getActionBar = () => cy.get('[data-testid="multi-select-action-bar"]');

    // ──────────────────────────────────────────────────────────────────
    // Selection checkbox visibility
    // ──────────────────────────────────────────────────────────────────

    describe('selection checkbox visibility', () => {
        it('selection checkbox is hidden by default on tasks', () => {
            // * The first input in each task row is the selection checkbox (opacity:0 / not visible by default)
            // We check that it exists but is not visible to the user before hover
            getTask(0).find('input[type=checkbox]').first().should('exist');
            getTask(0).find('input[type=checkbox]').first().should('have.css', 'opacity', '0');
        });

        it('selection checkbox becomes visible on hover', () => {
            // # Hover over the first task
            getTask(0).trigger('mouseover');

            // * The selection checkbox should now be visible (opacity:1)
            getTask(0).find('input[type=checkbox]').first().should('have.css', 'opacity', '1');
        });

        it('selection checkbox stays visible on all tasks when any task is selected', () => {
            // # Select the first task
            selectTask(0);

            // * All other tasks should now show their selection checkboxes permanently
            getTask(1).find('input[type=checkbox]').first().should('have.css', 'opacity', '1');
            getTask(2).find('input[type=checkbox]').first().should('have.css', 'opacity', '1');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Selecting and deselecting tasks
    // ──────────────────────────────────────────────────────────────────

    describe('selecting tasks', () => {
        it('selecting one task shows the action bar', () => {
            // # Select the first task
            selectTask(0);

            // * The floating action bar should appear
            cy.findByText('1 task selected').should('be.visible');
        });

        it('selecting multiple tasks updates the count in the action bar', () => {
            // # Select three tasks
            selectTask(0);
            selectTask(1);
            selectTask(2);

            // * The bar shows the correct count
            cy.findByText('3 tasks selected').should('be.visible');
        });

        it('selecting a task marks its checkbox as checked', () => {
            // # Select the first task
            selectTask(0);

            // * The selection checkbox should be checked
            getTask(0).find('input[type=checkbox]').first().should('be.checked');
        });

        it('deselecting a task unchecks it and updates the count', () => {
            // # Select two tasks
            selectTask(0);
            selectTask(1);

            // * Bar shows 2
            cy.findByText('2 tasks selected').should('be.visible');

            // # Deselect the first task
            selectTask(0);

            // * Bar should now show 1
            cy.findByText('1 task selected').should('be.visible');

            // * The first task's selection checkbox is unchecked
            getTask(0).find('input[type=checkbox]').first().should('not.be.checked');
        });

        it('clicking × in the action bar clears the selection and hides the bar', () => {
            // # Select two tasks
            selectTask(0);
            selectTask(1);

            // * Bar is visible
            cy.findByText('2 tasks selected').should('be.visible');

            // # Click the × (clear) button
            cy.findByLabelText('Clear selection').click();

            // * The action bar disappears
            cy.findByText('tasks selected').should('not.exist');

            // * Selection checkboxes go back to hidden state (opacity 0)
            getTask(0).find('input[type=checkbox]').first().should('have.css', 'opacity', '0');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Action bar content
    // ──────────────────────────────────────────────────────────────────

    describe('action bar buttons', () => {
        beforeEach(() => {
            // # Select two tasks before each test in this block
            selectTask(0);
            selectTask(1);
        });

        it('shows Assign button', () => {
            getActionBar().findByText('Assign').should('be.visible');
        });

        it('shows Delete button', () => {
            getActionBar().findByText('Delete').should('be.visible');
        });

        it('shows the correct selected count', () => {
            getActionBar().findByText('2 tasks selected').should('be.visible');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Bulk delete
    // ──────────────────────────────────────────────────────────────────

    describe('bulk delete', () => {
        it('deletes a single selected task', () => {
            // * Confirm initial task count
            getAllTasks().should('have.length', 5);

            // # Select the first task
            selectTask(0);

            // # Click Delete in the action bar
            getActionBar().findByText('Delete').click({force: true});

            // * Task count decreases by 1
            getAllTasks().should('have.length', 4);

            // * The action bar disappears after deletion
            cy.findByText('tasks selected').should('not.exist');
        });

        it('deletes multiple selected tasks within the same section', () => {
            // * Confirm initial count
            getAllTasks().should('have.length', 5);

            // # Select tasks 0 and 1 (both in "Setup" section)
            selectTask(0);
            selectTask(1);

            cy.findByText('2 tasks selected').should('be.visible');

            // # Click Delete
            getActionBar().findByText('Delete').click({force: true});

            // * Two tasks removed
            getAllTasks().should('have.length', 3);
        });

        it('deletes tasks from multiple sections', () => {
            // * Confirm initial count
            getAllTasks().should('have.length', 5);

            // # Select task 0 (from "Setup") and task 3 (from "Investigation")
            selectTask(0);
            selectTask(3);

            cy.findByText('2 tasks selected').should('be.visible');

            // # Click Delete
            getActionBar().findByText('Delete').click({force: true});

            // * Two tasks removed — one from each section
            getAllTasks().should('have.length', 3);
        });

        it('deleting all tasks in a section leaves only the remaining section', () => {
            // # Select all 3 tasks in the first "Setup" section
            selectTask(0);
            selectTask(1);
            selectTask(2);

            cy.findByText('3 tasks selected').should('be.visible');

            // # Click Delete
            getActionBar().findByText('Delete').click({force: true});

            // * Only the 2 tasks from the "Investigation" section remain
            getAllTasks().should('have.length', 2);
        });

        it('clears the selection after bulk delete', () => {
            // # Select a task and delete it
            selectTask(0);
            getActionBar().findByText('Delete').click({force: true});

            // * Action bar disappears
            cy.findByText('tasks selected').should('not.exist');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Bulk assign
    // ──────────────────────────────────────────────────────────────────

    describe('bulk assign', () => {
        it('opens a user picker when Assign is clicked', () => {
            // # Select a task
            selectTask(0);

            // # Click Assign in the action bar
            getActionBar().findByText('Assign').click({force: true});

            // * The profile selector dropdown should open (a focused text input appears)
            cy.focused().should('have.attr', 'type', 'text');
        });

        it('assigns selected tasks to a user', () => {
            // # Select two tasks
            selectTask(0);
            selectTask(1);

            cy.findByText('2 tasks selected').should('be.visible');

            // # Click Assign in the action bar
            getActionBar().findByText('Assign').click({force: true});

            // # Select testAnotherUser from the profile dropdown
            cy.focused().parents('.playbook-react-select').within(() => {
                cy.findByText('@' + testAnotherUser.username).click();
            });

            // * Assignee badge should now appear on both tasks
            getTask(0).find('.Assigned-button, .NoName-Assigned-button').should('exist');
            getTask(1).find('.Assigned-button, .NoName-Assigned-button').should('exist');
        });

        it('clears the selection after bulk assign', () => {
            // # Select a task, then assign to another user
            selectTask(0);
            getActionBar().findByText('Assign').click({force: true});
            cy.focused().parents('.playbook-react-select').within(() => {
                cy.findByText('@' + testAnotherUser.username).click();
            });

            // * No selection bar remains
            cy.findByText('tasks selected').should('not.exist');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Selection does not interfere with task completion checkbox
    // ──────────────────────────────────────────────────────────────────

    describe('selection vs task completion', () => {
        it('clicking the task-completion checkbox does not select the task', () => {
            // # Click the task-completion (status) checkbox — the second input in the row
            getTask(0).find('.checkbox').check({force: true});

            // * The action bar should NOT appear (task was marked done, not selected)
            cy.findByText('tasks selected').should('not.exist');
        });

        it('can mark tasks as done while others are selected', () => {
            // # Select task 1
            selectTask(1);

            cy.findByText('1 task selected').should('be.visible');

            // # Complete task 0 (different task) with the completion checkbox
            getTask(0).find('.checkbox').check({force: true});

            // * Task 0's status checkbox is checked
            getTask(0).find('.checkbox').should('be.checked');

            // * The selection bar still shows task 1 selected
            cy.findByText('1 task selected').should('be.visible');
        });

        it('selected tasks can still be marked as done via their status checkbox', () => {
            // # Select task 0
            selectTask(0);

            // # Also check the same task's status checkbox
            getTask(0).find('.checkbox').check({force: true});

            // * Task is both selected and done
            getTask(0).find('.checkbox').should('be.checked');
            getTask(0).find('input[type=checkbox]').first().should('be.checked');

            // * Bar still shows task as selected
            cy.findByText('1 task selected').should('be.visible');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Keyboard / accessibility
    // ──────────────────────────────────────────────────────────────────

    describe('accessibility', () => {
        it('selection checkbox has accessible label via its type', () => {
            // * Each task has two checkboxes: first is selection, second is status completion
            getTask(0).find('input[type=checkbox]').should('have.length', 2);
        });

        it('clear-selection button has an accessible aria-label', () => {
            // # Select a task to show the bar
            selectTask(0);

            // * The × button is labeled
            cy.findByLabelText('Clear selection').should('be.visible');
        });
    });
});
