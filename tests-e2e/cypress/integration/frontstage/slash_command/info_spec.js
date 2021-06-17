// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('slash command > info', () => {
    let testTeam;
    let teamId;
    let testUser;
    let userId;
    let testPlaybook;
    let playbookId;
    let testIncident;
    let incidentId;
    let incidentName;
    let incidentChannelName;

    before(() => {
        cy.apiInitSetup({createIncident: true}).then(({team, user, playbook, incident}) => {
            testTeam = team;
            teamId = team.id;
            testUser = user;
            userId = user.id;
            testPlaybook = playbook;
            playbookId = playbook.id;
            testIncident = incident;
            incidentId = incident.id;
            incidentName = incident.name;
            incidentChannelName = incidentName.toLowerCase();

            // # Switch to clean display mode
            cy.apiSaveMessageDisplayPreference('clean');
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin(testUser);

        // # Reset the commander to test-1 as necessary.
        cy.apiChangeIncidentCommander(incidentId, userId);
    });

    describe('/incident info', () => {
        it('should show an error when not in an incident channel', () => {
            // # Navigate to a non-incident channel.
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Run a slash command to show the incident's info.
            cy.executeSlashCommand('/incident info');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('You can only see the details of an incident from within the incident\'s channel.');
        });

        it('should open the RHS when it is not open', () => {
            // # Navigate directly to the application and the incident channel.
            cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);

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
            cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);

            // * Verify that the RHS is open.
            cy.get('#rhsContainer').should('be.visible');

            // # Run a slash command to show the incident's info.
            cy.executeSlashCommand('/incident info');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Your incident details are already open in the right hand side of the channel.');
        });
    });
});
