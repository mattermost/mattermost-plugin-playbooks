// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident rhs checklist', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Switch to clean display mode
        cy.apiSaveMessageDisplayPreference('clean');

        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                // # Create a playbook
                cy.apiCreatePlaybook({
                    teamId: team.id,
                    title: playbookName,
                    checklists: [{
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1', command: '/invalid'},
                            {title: 'Step 2', command: '/echo VALID'},
                        ],
                    }],
                    memberIDs: [
                        user.id,
                    ],
                }).then((playbook) => {
                    playbookId = playbook.id;
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin('user-1');
    });

    describe('with slash commands', () => {
        let incidentName;
        let incidentChannelName;

        before(() => {
            // # Start the incident
            const now = Date.now();
            incidentName = 'Incident (' + now + ')';
            incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName,
                commanderUserId: userId,
            });
        });

        beforeEach(() => {
            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');

                // # Select the tasks tab
                cy.findByTestId('tasks').click();
            });
        });

        it('shows an ephemeral error when running an invalid slash command', () => {
            cy.get('#rhsContainer').should('exist').within(() => {
                // * Verify the command has not yet been run.
                cy.get('.run').eq(0).should('have.text', 'Run');

                // * Run the /invalid slash command
                cy.get('.run').eq(0).click();

                // * Verify the command still has not yet been run.
                cy.get('.run').eq(0).should('have.text', 'Run');
            });

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Failed to execute slash command /invalid');
        });

        it('successfully runs a valid slash command', () => {
            cy.get('#rhsContainer').should('exist').within(() => {
                // * Verify the command has not yet been run.
                cy.get('.run').eq(1).should('have.text', 'Run');

                // * Run the /invalid slash command
                cy.get('.run').eq(1).click();

                // * Verify the command has now been run.
                cy.get('.run').eq(1).should('have.text', 'Rerun');
            });

            // # Verify the expected output.
            cy.verifyPostedMessage('VALID');
        });

        it('still shows slash commands as having been run after reload', () => {
            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            cy.get('#rhsContainer').should('exist').within(() => {
                // # Select the tasks tab
                cy.findByTestId('tasks').click();

                // * Verify the invalid command still has not yet been run.
                cy.get('.run').eq(0).should('have.text', 'Run');

                // * Verify the valid command has been run.
                cy.get('.run').eq(1).should('have.text', 'Rerun');
            });
        });
    });
});
