// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************


	// Add more playbook backstage tests here
	// Eg: 
	// - Verify backstage view when no playbooks are created
	// - Verify backstage view when playbooks are created

import users from '../../fixtures/users.json';

describe('Test playbook backstage', () => {
	before(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');
		cy.visit('/ad-1/channels/town-square');
		cy.openIncidentBackstage();
		cy.findByTestId('playbooksLHSButton').click();
	});

	it('Incident backstage has Incidents and team name in heading', () => {
		cy.findByTestId('titlePlaybook').should('be.visible').within(() => {
			cy.findByTestId('titleTeamName').should('be.visible').within(() => {
				cy.contains('eligendi');
			});
		});
	});
});