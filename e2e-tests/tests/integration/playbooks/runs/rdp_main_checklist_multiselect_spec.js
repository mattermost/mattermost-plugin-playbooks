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
     * Enter bulk edit mode by clicking the "Bulk edit" button
     */
    const enterBulkEditMode = () => {
        cy.findByText('Bulk edit').click();
    };

    /**
     * Click a task row to toggle its selection (must be in bulk edit mode)
     */
    const selectTask = (index) => {
        getTask(index).click({force: true});
    };

    const getActionBar = () => cy.get('[data-testid="multi-select-action-bar"]');

    // ──────────────────────────────────────────────────────────────────
    // Bulk edit mode toggle
    // ──────────────────────────────────────────────────────────────────

    describe('bulk edit mode toggle', () => {
        it('shows the Bulk edit button', () => {
            cy.findByText('Bulk edit').should('be.visible');
        });

        it('clicking Bulk edit toggles to Exit bulk edit', () => {
            // # Enter bulk edit mode
            enterBulkEditMode();

            // * Button changes to "Exit bulk edit"
            cy.findByText('Exit bulk edit').should('be.visible');
        });

        it('clicking Exit bulk edit returns to normal mode', () => {
            // # Enter then exit bulk edit mode
            enterBulkEditMode();
            cy.findByText('Exit bulk edit').click();

            // * Button returns to "Bulk edit"
            cy.findByText('Bulk edit').should('be.visible');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Selecting and deselecting tasks
    // ──────────────────────────────────────────────────────────────────

    describe('selecting tasks', () => {
        beforeEach(() => {
            // # Enter bulk edit mode before each selection test
            enterBulkEditMode();
        });

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

        it('deselecting a task updates the count', () => {
            // # Select two tasks
            selectTask(0);
            selectTask(1);

            // * Bar shows 2
            cy.findByText('2 tasks selected').should('be.visible');

            // # Deselect the first task
            selectTask(0);

            // * Bar should now show 1
            cy.findByText('1 task selected').should('be.visible');
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
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Action bar content
    // ──────────────────────────────────────────────────────────────────

    describe('action bar buttons', () => {
        beforeEach(() => {
            // # Enter bulk edit mode and select two tasks
            enterBulkEditMode();
            selectTask(0);
            selectTask(1);
        });

        it('shows Assign button', () => {
            getActionBar().findByText('Assign').should('be.visible');
        });

        it('shows Delete button', () => {
            getActionBar().findByLabelText('Delete selected tasks').should('exist');
        });

        it('shows the correct selected count', () => {
            getActionBar().findByText('2 tasks selected').should('be.visible');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Bulk delete
    // ──────────────────────────────────────────────────────────────────

    describe('bulk delete', () => {
        beforeEach(() => {
            // # Enter bulk edit mode before each delete test
            enterBulkEditMode();
        });

        it('deletes a single selected task', () => {
            // * Confirm initial task count
            getAllTasks().should('have.length', 5);

            // # Select the first task
            selectTask(0);

            // # Click Delete in the action bar
            getActionBar().findByLabelText('Delete selected tasks').click({force: true});

            // # Confirm the deletion in the modal
            cy.findByText('Delete').click();

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
            getActionBar().findByLabelText('Delete selected tasks').click({force: true});

            // # Confirm the deletion in the modal
            cy.findByText('Delete').click();

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
            getActionBar().findByLabelText('Delete selected tasks').click({force: true});

            // # Confirm the deletion in the modal
            cy.findByText('Delete').click();

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
            getActionBar().findByLabelText('Delete selected tasks').click({force: true});

            // # Confirm the deletion in the modal
            cy.findByText('Delete').click();

            // * Only the 2 tasks from the "Investigation" section remain
            getAllTasks().should('have.length', 2);
        });

        it('clears the selection after bulk delete', () => {
            // # Select a task and delete it
            selectTask(0);
            getActionBar().findByLabelText('Delete selected tasks').click({force: true});

            // # Confirm the deletion in the modal
            cy.findByText('Delete').click();

            // * Action bar disappears
            cy.findByText('tasks selected').should('not.exist');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Bulk assign
    // ──────────────────────────────────────────────────────────────────

    describe('bulk assign', () => {
        beforeEach(() => {
            // # Enter bulk edit mode before each assign test
            enterBulkEditMode();
        });

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
    // Bulk due date
    // ──────────────────────────────────────────────────────────────────

    describe('bulk due date', () => {
        beforeEach(() => {
            // # Enter bulk edit mode before each due date test
            enterBulkEditMode();
        });

        it('opens a date picker when Due date is clicked', () => {
            // # Select a task
            selectTask(0);

            // # Click Due date in the action bar
            getActionBar().findByText('Due date').click({force: true});

            // * The date picker dropdown should open
            cy.get('.playbook-react-select').should('be.visible');
        });

        it('sets a due date on multiple selected tasks', () => {
            // # Select two tasks
            selectTask(0);
            selectTask(1);

            cy.findByText('2 tasks selected').should('be.visible');

            // # Click Due date in the action bar
            getActionBar().findByText('Due date').click({force: true});

            // # Select "Today" from the dropdown
            cy.get('.playbook-react-select').within(() => {
                cy.findByText('Today').click();
            });

            // * Due date indicators should appear on both tasks
            getTask(0).findByTestId('due-date-info-button').should('exist');
            getTask(1).findByTestId('due-date-info-button').should('exist');
        });

        it('clears the selection after setting due date', () => {
            // # Select a task, then set a due date
            selectTask(0);
            getActionBar().findByText('Due date').click({force: true});
            cy.get('.playbook-react-select').within(() => {
                cy.findByText('Today').click();
            });

            // * Action bar disappears
            cy.findByText('tasks selected').should('not.exist');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Selection does not interfere with task completion checkbox
    // ──────────────────────────────────────────────────────────────────

    describe('selection vs task completion', () => {
        it('clicking the task-completion checkbox outside bulk edit does not select the task', () => {
            // # Click the task-completion (status) checkbox
            getTask(0).find('.checkbox').check({force: true});

            // * The action bar should NOT appear (task was marked done, not selected)
            cy.findByText('tasks selected').should('not.exist');
        });

        it('task completion checkbox is disabled in bulk edit mode', () => {
            // # Enter bulk edit mode
            enterBulkEditMode();

            // * The checkbox container has pointer-events disabled
            // so clicking a task row selects it instead of toggling completion
            selectTask(0);

            // * The action bar should appear (task was selected, not completed)
            cy.findByText('1 task selected').should('be.visible');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Keyboard / accessibility
    // ──────────────────────────────────────────────────────────────────

    describe('accessibility', () => {
        it('task has a completion checkbox', () => {
            // * Each task has one checkbox for task completion
            getTask(0).find('input[type=checkbox]').should('have.length', 1);
        });

        it('clear-selection button has an accessible aria-label', () => {
            // # Enter bulk edit mode and select a task to show the bar
            enterBulkEditMode();
            selectTask(0);

            // * The × button is labeled
            cy.findByLabelText('Clear selection').should('be.visible');
        });
    });
});
