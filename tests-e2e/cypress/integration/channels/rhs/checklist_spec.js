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
            // # Navigate directly to the application and the playbook run channel
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

            // # Click the skip button and confirm
            cy.get('.icon-close-circle-outline').click();
            cy.findByText('Skip').click();

            // * Verify the skip message
            cy.verifyPostedMessage('skipped checklist item Step 1');

            // # Hover over the checklist item
            cy.findAllByTestId('checkbox-item-container').eq(0).trigger('mouseover');

            // # Click the restore button and confirm
            cy.get('.icon-refresh').click();
            cy.findByText('Restore').click();

            // * Verify the restore message
            cy.verifyPostedMessage('restored checklist item Step 1');
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

        it('assignee selector is shifted up if it falls below window', () => {
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
                cy.findByText('Checklists').trigger('mouseover').within(() => {
                    cy.findByTitle('Add checklist').click();
                });
            });

            // # Type a title and click on the Add button
            const title = 'Checklist - ' + Date.now();
            cy.findByLabelText('Checklist name').type(title);
            cy.findByRole('button', {name: 'Add'}).click();

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

            // # Clear the text in the input
            cy.findByLabelText('Checklist name').clear();

            // * Verify that the confirm button is disabled
            cy.findByRole('button', {name: 'Rename'}).should('be.disabled');

            // # Type the new title and click the confirm button
            cy.findByLabelText('Checklist name').type(newTitle);
            cy.findByRole('button', {name: 'Rename'}).click();

            // * Verify that the checklist changed its name
            cy.get('#rhsContainer').within(() => {
                cy.findByText(oldTitle).should('not.exist');
                cy.findByText(newTitle).should('exist');
            });
        });

        it('deletes a checklist', () => {
            const title = 'Stage 1';

            // # Open the dot menu and click on the delete button
            cy.get('#rhsContainer').within(() => {
                cy.findByText(title).trigger('mouseover');
                cy.findByTitle('More').click();
                cy.findByRole('button', {name: 'Delete checklist'}).click();
            });

            // # Click the confirm button
            cy.findByRole('button', {name: 'Delete'}).click();

            // * Verify that the checklist is no longer there
            cy.get('#rhsContainer').within(() => {
                cy.findByText(title).should('not.exist');
            });
        });
    });
});
