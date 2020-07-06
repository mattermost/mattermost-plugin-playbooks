// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for the incident details view in incident backstage
 */

import users from '../../fixtures/users.json';

describe('Incident Details View in Backstage ', () => {
	const incident_backstage_1 = "Incident" + Date.now();
	beforeEach(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');

		// # Go to the team's townsquare channel
		cy.visit('/ad-1/channels/town-square');
	});

	it('Loads incident details page when clicking on an incident', () => {
		// # Start an incident with slash command
		cy.startIncidentWithSlashCommand(incident_backstage_1);
		
		// # Launch incident backstage
		cy.openIncidentBackstage();

		// # Find the incident `incident_backstage_1` and click to open details view
		cy.get('#incidentList').within(() => {
			cy.findByText(incident_backstage_1).click();
		});

		// * Verify that the header contains the incident name
		// TODO: The following is not the optimal way to do it, and will need to get replaced by
		// a div ID instead of the details-header class
		cy.get('.details-header').contains(incident_backstage_1);
	});

	it('Redirects to /error if the incident is unknown', () => {
		// # Visit the URL of a non-existing incident
		cy.visit('/ad-1/com.mattermost.plugin-incident-response/incidents/an_unknown_id');

		// * Verify that the user has been redirect to /error with type=incidents
		cy.url().should('include', '/ad-1/com.mattermost.plugin-incident-response/error?type=incidents');
	});
});
