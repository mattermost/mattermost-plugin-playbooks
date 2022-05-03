// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {HALF_SEC} from '../../../fixtures/timeouts';

describe('channels > rhs > checklist', () => {
    let testTeam;
    let testUser;
    const testUsers = [];
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create extra test users in this team
            cy.apiCreateUser().then((payload) => {
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
                testUsers.push(payload.user);
            });

            cy.apiCreateUser().then((payload) => {
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
                testUsers.push(payload.user);
            });

            cy.apiCreateUser().then((payload) => {
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
                testUsers.push(payload.user);
            });

            cy.apiCreateUser().then((payload) => {
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
                testUsers.push(payload.user);
            });

            cy.apiCreateUser().then((payload) => {
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
                testUsers.push(payload.user);
            });

            cy.apiCreateUser().then((payload) => {
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
                testUsers.push(payload.user);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreatePlaybook({
                teamId: team.id,
                title: 'Playbook',
                checklists: [{
                    title: 'Stage 1',
                    items: [
                        {title: 'Step 1', command: '/invalid'},
                        {title: 'Step 2', command: '/echo VALID'},
                        {title: 'Step 3'},
                        {title: 'Step 4'},
                        {title: 'Step 5'},
                        {title: 'Step 6'},
                        {title: 'Step 7'},
                        {title: 'Step 8'},
                        {title: 'Step 9'},
                        {title: 'Step 10'},
                        {title: 'Step 11'},
                        {title: 'Step 12'},
                    ],
                }],
                memberIDs: [
                    user.id,
                ],
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    // // # Switch to clean display mode
    // cy.apiSaveMessageDisplayPreference('clean');

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to task list without scrolling issues
        cy.viewport('macbook-13');
    });

    describe('rhs stuff', () => {
        let playbookRunName;
        let playbookRunChannelName;

        beforeEach(() => {
            // # Run the playbook
            const now = Date.now();
            playbookRunName = 'Playbook Run (' + now + ')';
            playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # Add test users to channel
                cy.apiAddUserToChannel(playbookRun.channel_id, testUsers[0].id);
                cy.apiAddUserToChannel(playbookRun.channel_id, testUsers[1].id);
                cy.apiAddUserToChannel(playbookRun.channel_id, testUsers[2].id);
                cy.apiAddUserToChannel(playbookRun.channel_id, testUsers[3].id);
                cy.apiAddUserToChannel(playbookRun.channel_id, testUsers[4].id);
                cy.apiAddUserToChannel(playbookRun.channel_id, testUsers[5].id);
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('shows an ephemeral error when running an invalid slash command', () => {
            cy.get('#rhsContainer').should('exist').within(() => {
                // * Verify the command has not yet been run.
                cy.findAllByTestId('run').eq(0).should('have.text', 'Run');

                // * Run the /invalid slash command
                cy.findAllByTestId('run').eq(0).click();

                // * Verify the command still has not yet been run.
                cy.findAllByTestId('run').eq(0).should('have.text', 'Run');
            });

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Failed to execute slash command /invalid');
        });

        it('successfully runs a valid slash command', () => {
            cy.get('#rhsContainer').should('exist').within(() => {
                // * Verify the command has not yet been run.
                cy.findAllByTestId('run').eq(1).should('have.text', 'Run');

                // * Run the /invalid slash command
                cy.findAllByTestId('run').eq(1).click();

                // * Verify the command has now been run.
                cy.findAllByTestId('run').eq(1).should('have.text', 'Rerun');
            });

            // # Verify the expected output.
            cy.verifyPostedMessage('VALID');
        });

        it('still shows slash commands as having been run after reload', () => {
            cy.get('#rhsContainer').should('exist').within(() => {
                // * Verify the command has not yet been run.
                cy.findAllByTestId('run').eq(1).should('have.text', 'Run');

                // * Run the /invalid slash command
                cy.findAllByTestId('run').eq(1).click();

                // * Verify the command has now been run.
                cy.findAllByTestId('run').eq(1).should('have.text', 'Rerun');
            });

            // # Verify the expected output.
            cy.verifyPostedMessage('VALID');

            // # Reload the page
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            cy.get('#rhsContainer').should('exist').within(() => {
                // * Verify the invalid command still has not yet been run.
                cy.findAllByTestId('run').eq(0).should('have.text', 'Run');

                // * Verify the valid command has been run.
                cy.findAllByTestId('run').eq(1).should('have.text', 'Rerun');
            });
        });

        it('can skip and restore task', () => {
            // # Hover over the checklist item
            cy.findAllByTestId('checkbox-item-container').eq(0).trigger('mouseover');

            // # Click dot menu
            cy.findByTitle('More').click();

            // # Click the skip button
            cy.findByRole('button', {name: 'Skip task'}).click();

            // * Verify the item has been skipped
            cy.findAllByTestId('checkbox-item-container').eq(0).within(() => {
                cy.get('[data-cy=skipped]').should('exist');
            });

            // # Hover over the checklist item
            cy.findAllByTestId('checkbox-item-container').eq(0).trigger('mouseover');

            // # Click dot menu
            cy.findByTitle('More').click();

            // # Click the restore button
            cy.findByRole('button', {name: 'Restore task'}).click();

            // * Verify the item has been restored
            cy.findAllByTestId('checkbox-item-container').eq(0).within(() => {
                cy.get('[data-cy=skipped]').should('not.exist');
            });
        });

        it('add new task', () => {
            const newTasktext = 'This is my new task' + Date.now();

            cy.addNewTaskFromRHS(newTasktext);

            // Check that it was created
            cy.findByText(newTasktext).should('exist');
        });

        it('add new task slash command', () => {
            const newTasktext = 'Task from slash command' + Date.now();

            cy.executeSlashCommand(`/playbook checkadd 0 ${newTasktext}`);

            // Check that it was created
            cy.findByText(newTasktext).should('exist');
        });

        it('assignee selector is shifted up if it falls below window', {
            retries: {runMode: 3},
        }, () => {
            // Hover over a checklist item at the end
            cy.findAllByTestId('checkbox-item-container').eq(10).trigger('mouseover').within(() => {
                // Click the profile icon
                cy.get('.icon-account-plus-outline').click().wait(HALF_SEC);

                cy.isInViewport('.playbook-run-user-select');
            });
        });

        it('creates a new checklist', () => {
            // # Click on the button to add a checklist
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('add-a-checklist-button').click();
            });

            // # Type a title and click on the Add button
            const title = 'Checklist - ' + Date.now();
            cy.findByTestId('checklist-title-input').type(title);
            cy.findByTestId('checklist-item-save-button').click();

            // # Click on the button to add a checklist
            cy.get('#rhsContainer').within(() => {
                cy.findByText(title).should('exist');
            });
        });

        it('renames a checklist', () => {
            const oldTitle = 'Stage 1';
            const newTitle = 'New title - ' + Date.now();

            // # Open the dot menu and click on the rename button
            cy.get('#rhsContainer').within(() => {
                cy.findByText(oldTitle).trigger('mouseover');
                cy.findByTitle('More').click();
                cy.findByRole('button', {name: 'Rename checklist'}).click();
            });

            // # Type the new title and click the confirm button
            cy.findByTestId('checklist-title-input').type(newTitle);
            cy.findByTestId('checklist-item-save-button').click();

            // * Verify that the checklist changed its name
            cy.get('#rhsContainer').within(() => {
                cy.findByText(oldTitle).should('not.exist');
                cy.findByText(oldTitle + newTitle).should('exist');
            });
        });

        it('can set due date, from hover menu', () => {
            // # Hover over the checklist item
            cy.findAllByTestId('checkbox-item-container').eq(6).trigger('mouseover');

            // # Click the set due date button
            cy.get('.icon-calendar-outline').click();

            // # Enter due date in 10 min
            cy.get('.playbook-run-user-select__value-container').type('in 10 min')
                .wait(HALF_SEC)
                .trigger('keydown', {
                    key: 'Enter',
                });

            // * Verify if Due in 10 minutes info is added
            cy.findAllByTestId('due-date-info-button').eq(0).should('exist').within(() => {
                cy.findByText('in 10 minutes').should('exist');
                cy.findByText('Due').should('exist');
            });
        });

        it('can set due date, from edit mode', () => {
            // # Hover over the checklist item
            cy.findAllByTestId('checkbox-item-container').eq(6).trigger('mouseover');

            // # Click the edit button
            cy.findAllByTestId('hover-menu-edit-button').eq(0).click();

            cy.findAllByTestId('due-date-info-button').eq(0).click();

            // # Enter due date in 3 days
            cy.get('.playbook-run-user-select__value-container').type('in 3 days')
                .wait(HALF_SEC)
                .trigger('keydown', {
                    key: 'Enter',
                });

            // * Verify if Due in 3 days info is added
            cy.findAllByTestId('due-date-info-button').eq(0).should('exist').within(() => {
                cy.findByText('in 3 days').should('exist');
                cy.findByText('Due').should('exist');
            });
        });

        it('filter overdue tasks', () => {
            // # Hover over the checklist item
            cy.findAllByTestId('checkbox-item-container').eq(6).trigger('mouseover');

            // # Click the edit button
            cy.findAllByTestId('hover-menu-edit-button').eq(0).click();

            cy.findAllByTestId('due-date-info-button').eq(0).click();

            // # Enter due 1 min ago
            cy.get('.playbook-run-user-select__value-container').type('1 min ago')
                .wait(HALF_SEC)
                .trigger('keydown', {
                    key: 'Enter',
                });

            // * Verify if Due 1 minute ago info is added
            cy.findAllByTestId('due-date-info-button').eq(0).should('exist').within(() => {
                cy.findByText('1 minute ago').should('exist');
                cy.findByText('Due').should('exist');
            });

            // * Verify if overdue tasks info was added
            cy.findAllByTestId('overdue-tasks-filter').eq(0).should('exist').within(() => {
                cy.findByText('1 task overdue').should('exist');
            });

            // # Filter overdue tasks
            cy.findAllByTestId('overdue-tasks-filter').eq(0).click();

            // * Verify if filter works
            cy.findAllByTestId('checkbox-item-container').should('have.length', 1);

            // # Cancel filter overdue tasks
            cy.findAllByTestId('overdue-tasks-filter').eq(0).click();

            // * Verify if filter was canceled
            cy.findAllByTestId('checkbox-item-container').should('have.length', 12);
        });

        it('filter overdue automatically disappear if we check all overdue items', () => {
            // # Hover over the checklist item
            cy.findAllByTestId('checkbox-item-container').eq(6).trigger('mouseover');

            // # Click the edit button
            cy.findAllByTestId('hover-menu-edit-button').eq(0).click();

            cy.findAllByTestId('due-date-info-button').eq(0).click();

            // # Enter due 1 min ago
            cy.get('.playbook-run-user-select__value-container').type('1 min ago')
                .wait(HALF_SEC)
                .trigger('keydown', {
                    key: 'Enter',
                });

            // * Verify if Due 1 minute ago info is added
            cy.findAllByTestId('due-date-info-button').eq(0).should('exist').within(() => {
                cy.findByText('1 minute ago').should('exist');
                cy.findByText('Due').should('exist');
            });

            // * Verify if overdue tasks info was added
            cy.findAllByTestId('overdue-tasks-filter').eq(0).should('exist').within(() => {
                cy.findByText('1 task overdue').should('exist');
            });

            // # Filter overdue tasks
            cy.findAllByTestId('overdue-tasks-filter').eq(0).click();

            // * Verify if filter works
            cy.findAllByTestId('checkbox-item-container').should('have.length', 1);

            // # Mark a task as completed
            cy.findAllByTestId('checkbox-item-container').within(() => {
                // check the overdue task
                cy.get('input').click();
            });

            // * Verify there is no filter
            cy.findAllByTestId('overdue-tasks-filter').should('not.exist');

            // * Verify if filter was canceled
            cy.findAllByTestId('checkbox-item-container').should('have.length', 12);
        });
    });
});
