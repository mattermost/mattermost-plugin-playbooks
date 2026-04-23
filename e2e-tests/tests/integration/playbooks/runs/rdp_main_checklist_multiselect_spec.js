// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbook editor > outline > checklist bulk edit', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPublicPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a playbook with multiple tasks across two checklists
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Bulk Edit Test Playbook',
                memberIDs: [testUser.id],
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

        // # Visit the playbook editor outline
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}/outline`);

        // # Wait for the Tasks section and Bulk edit button to be ready
        // Use the section element directly to avoid the duplicate "Tasks" text
        // that also appears in the scroll nav sidebar
        cy.get('#checklists').should('be.visible');
        cy.findByText('Bulk edit').should('be.visible');
    });

    // ──────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────

    const getAllTasks = () => cy.findAllByTestId('checkbox-item-container');
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
    // Bulk edit mode disables task completion
    // ──────────────────────────────────────────────────────────────────

    describe('bulk edit mode behavior', () => {
        it('clicking a task row in bulk edit mode selects it instead of toggling completion', () => {
            // # Enter bulk edit mode
            enterBulkEditMode();

            // # Click a task row
            selectTask(0);

            // * The action bar should appear (task was selected, not completed)
            cy.findByText('1 task selected').should('be.visible');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Accessibility
    // ──────────────────────────────────────────────────────────────────

    describe('accessibility', () => {
        it('clear-selection button has an accessible aria-label', () => {
            // # Enter bulk edit mode and select a task to show the bar
            enterBulkEditMode();
            selectTask(0);

            // * The × button is labeled
            cy.findByLabelText('Clear selection').should('be.visible');
        });
    });
});
