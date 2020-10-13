// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('slash command > info', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;
    let incidentId;
    let incidentName;
    let incidentChannelName;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Switch to clean display mode
        cy.apiSaveMessageDisplayPreference('clean');

        // # Create a playbook and incident.
        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                cy.apiCreatePlaybook({
                    teamId: team.id,
                    title: playbookName,
                    checklists: [
                        {
                            title: 'Stage 1',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                        {
                            title: 'Stage 2',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                    ],
                    memberIDs: [user.id],
                }).then((playbook) => {
                    playbookId = playbook.id;

                    const now = Date.now();
                    incidentName = 'Incident (' + now + ')';
                    incidentChannelName = 'incident-' + now;
                    cy.apiStartIncident({
                        teamId,
                        playbookId,
                        incidentName,
                        commanderUserId: userId,
                    }).then((incident) => {
                        incidentId = incident.id;
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');

        // # Reset the commander to test-1 as necessary.
        cy.apiChangeIncidentCommander(incidentId, userId);
    });

    describe('/incident info', () => {
        it('should show an error when not in an incident channel', () => {
            // # Navigate to a non-incident channel.
            cy.visit('/ad-1/channels/town-square');

            // # Run a slash command to show the incident's info.
            cy.executeSlashCommand('/incident info');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('You can only show the details of an incident from within the incident\'s channel.');
        });

        it('should open the RHS when it is not open', () => {
            // # Navigate directly to the application and the incident channel.
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // # Close the RHS, which is opened by default when navigating to an incident channel.
            cy.get('#searchResultsCloseButton').click();

            // * Verify that the RHS is indeed closed.
            cy.get('#rhsContainer').should('not.exist');

            // # Run a slash command to show the incident's info.
            cy.executeSlashCommand('/incident info');

            // * Verify that the RHS is now open.
            cy.get('#rhsContainer').should('be.visible');
        });

        it('should show an ephemeral post when the RHS is already open', () => {
            // # Navigate directly to the application and the incident channel.
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify that the RHS is open.
            cy.get('#rhsContainer').should('be.visible');

            // # Run a slash command to show the incident's info.
            cy.executeSlashCommand('/incident info');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Your incident details are already open in the right hand side of the channel.');
        });
    });
});
