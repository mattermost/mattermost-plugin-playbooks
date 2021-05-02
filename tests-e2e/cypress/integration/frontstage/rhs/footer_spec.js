// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident rhs > footer', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let testTeam;
    let teamId;
    let testUser;
    let playbookId;
    let testIncident;
    let incidentChannel;

    before(() => {
        cy.apiInitSetup({createIncident: true}).then(({team, channel, user, playbook, incident}) => {
            testTeam = team;
            teamId = team.id;
            testUser = user;
            playbookId = playbook.id;
            testIncident = incident;
            incidentChannel = channel;
            cy.log(`TEST TEAM: ${testTeam.name}`);
            cy.log(`CHANNEL: ${incidentChannel}`);
            cy.log(`USER: ${testUser.name}`);
            cy.log(`PLAYBOOK: ${playbookId}`);
            // cy.log(`INCIDENT: ${testIncident.name}`);
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Navigate directly to the application and the incident channel
        cy.visit(`/${testTeam.name}/channels/` + testIncident.name);

        // # Select the tasks tab
        cy.findByTestId('tasks').click();
        });

        // describe('has navigation button', () => {
        //     beforeEach(() => {
        //         const now = Date.now();
        //         const incidentName = 'Incident (' + now + ')';
        //         const incidentChannelName = 'incident-' + now;

        //         // # Start the incident
        //         cy.apiStartIncident({
        //             teamId,
        //             playbookId,
        //             incidentName,
        //             commanderUserId: userId,
        //         });

        //         // # Navigate directly to the application and the incident channel
        //         cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);

        //         // # Select the tasks tab
        //         cy.findByTestId('tasks').click();
        //     });

    it('should always say update status', () => {

        // * Verify that the button contains Update Status
        cy.get('#incidentRHSFooter').within(() => {
            cy.findByText('Overview').should('be.visible');
            cy.findByText('Update Status').should('be.visible');
        });

        // // # Click on the End Incident button
        // cy.get('#incidentRHSFooter button').click({multiple: true});

        // // * Verify that the interactive dialog is visible
        // cy.get('#interactiveDialogModalLabel').contains('Confirm End Incident');
    });
});
