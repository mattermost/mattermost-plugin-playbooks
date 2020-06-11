// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

	// Add more incident backstage tests here
	// Eg:
	// - Verify backstage incident detail functions

import users from '../../fixtures/users.json';

const incident_backstage_1 = "Incident" + Date.now();

describe('Test incident backstage', () => {
	before(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');
		cy.visit('/ad-1/channels/town-square');
		cy.startIncidentWithSlashCommand(incident_backstage_1);
		cy.openIncidentBackstage();
	});

	it('Clicking on an incident in the list loads incident details page', () => {
		cy.get('#incidentList').within(() => {
			cy.findByText(incident_backstage_1).click();
		});
		// The following is not the optimal way to do it, and will need to get replaced by
		// a div id instead of the details-header class
		cy.get('.details-header').contains(incident_backstage_1);
	});

});