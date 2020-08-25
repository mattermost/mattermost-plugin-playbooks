// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for the incident details view in incident backstage
 */

describe('Incident Details View in Backstage ', () => {
    const incidentBackstage1 = 'Incident' + Date.now();
    const dummyPlaybookName = 'Dummy playbook' + Date.now();

    before(() => {
        // # Login as non-admin user
        cy.apiLogin('user-1');
        cy.visit('/');

        // # Create a dummy playbook as non-admin user
        cy.apiGetTeamByName('ad-1').then((team) => {
            cy.apiGetCurrentUser().then((user) => {
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: dummyPlaybookName,
                    userId: user.id,
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as non-admin user
        cy.apiLogin('user-1');

        // # Go to the team's townsquare channel
        cy.visit('/ad-1/channels/town-square');
    });

    it('Loads incident details page when clicking on an incident', () => {
        // # Start an incident with slash command
        cy.startIncidentWithSlashCommand(dummyPlaybookName, incidentBackstage1);

        // # Launch incident backstage
        cy.openIncidentBackstage();

        // # Find the incident `incident_backstage_1` and click to open details view
        cy.get('#incidentList').within(() => {
            cy.findByText(incidentBackstage1).click();
        });

        // * Verify that the header contains the incident name
        cy.get('.details-header').contains(incidentBackstage1);
    });

    it('Redirects to /error if the incident is unknown', () => {
        // # Visit the URL of a non-existing incident
        cy.visit('/ad-1/com.mattermost.plugin-incident-response/incidents/an_unknown_id');

        // * Verify that the user has been redirect to /error with type=incidents
        cy.url().should('include', '/ad-1/com.mattermost.plugin-incident-response/error?type=incidents');
    });
});
