// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import users from '../fixtures/users.json';

describe('Test backstage', () => {
	before(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');
		cy.visit('/');
	});

	it('Incidents & Playbooks button in main menu defaults to incident backstage', () => {
		cy.openIncidentBackstage();
		cy.findByTestId('titleIncident').should('be.visible');
	});

	it('Playbooks LHS button opens playbooks backstage', () => {
		cy.findByTestId('playbooksLHSButton').click();
		cy.findByTestId('titlePlaybook').should('be.visible');
	});

	it('Incidents LHS button open incidents backstage', () => {
		cy.findByTestId('incidentsLHSButton').click();
		cy.findByTestId('titleIncident').should('be.visible');
	});
});
