// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

	// Add more incident backstage tests here
	// Eg:
	// - Verify Search box and it's content
	// - Verify Commander dropdown content
	// - Verify Status dropdown content
	// - Verify incident list header content
	// - Verify incident list content

import users from '../../fixtures/users.json';

describe('Test incident backstage', () => {
	before(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');
		cy.visit('/ad-1/channels/town-square');
		cy.openIncidentBackstage();
	});

	it('Incident backstage has Incidents and team name in heading', () => {
		cy.findByTestId('titleIncident').should('be.visible').within(() => {
			cy.findByTestId('titleTeamName').should('be.visible').within(() => {
				cy.contains('eligendi');
			});
		});
	});
});