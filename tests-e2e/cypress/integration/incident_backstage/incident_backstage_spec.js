// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for the incident list view in incident backstage
 */

import users from '../../fixtures/users.json';

describe('Incident List View in Backstage', () => {
	before(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');

		// # Go to eligendi's town-square channel
		cy.visit('/ad-1/channels/town-square');

		// # Launch Incident backstage
		cy.openIncidentBackstage();
	});

	it('Has "Incidents" and team name in heading', () => {
		// * In the backstage, verify the header contains the team name -- eligendi
		cy.findByTestId('titleIncident').should('be.visible').contains('Incidents');
		cy.findByTestId('titleIncident').contains('eligendi');
	});
});
