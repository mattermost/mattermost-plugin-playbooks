// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for the Incidents & Playbooks backstage
 */

import users from '../fixtures/users.json';

describe('Backstage Verification', () => {
	before(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');
		cy.visit('/');
	});

	it('Incidents & Playbooks button in main menu defaults to incident backstage', () => {
		cy.openIncidentBackstage();

		// * Verify that the heading is visible and contains "Incident"
		cy.findByTestId('titleIncident').should('be.visible').contains('Incidents');
	});

	it('Playbooks LHS button opens playbooks backstage', () => {
		// # Switch to playbooks backstage
		cy.findByTestId('playbooksLHSButton').click();

		// * Verify that the heading is visible and contains "Playbook"
		cy.findByTestId('titlePlaybook').should('be.visible').contains('Playbooks');
	});

	it('Incidents LHS button open incidents backstage', () => {
		// # Switch to incidents backstage
		cy.findByTestId('incidentsLHSButton').click();

		// * Verify again that the switch was successful by verifying the heading has "Incident"
		cy.findByTestId('titleIncident').should('be.visible').contains('Incidents');
	});
});
