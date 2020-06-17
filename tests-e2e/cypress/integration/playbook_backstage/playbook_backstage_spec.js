// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for playbooks backstage.
 */

import users from '../../fixtures/users.json';

describe('Playbook List View Verification in Backstage', () => {
	before(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');

		// # Go to the team's town-square channel
		cy.visit('/ad-1/channels/town-square');

		// # Launch incident backstage
		cy.openIncidentBackstage();

		// # Switch to Playbooks backstage
		cy.findByTestId('playbooksLHSButton').click();
	});

	it('Incident backstage has Incidents and team name in heading', () => {
		// * Verify that the heading has the team's name -- eligendi
		cy.findByTestId('titlePlaybook').should('be.visible').contains('eligendi');
	});
});
