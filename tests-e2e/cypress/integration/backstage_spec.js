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

describe('Backstage', () => {
	beforeEach(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');
		cy.visit('/');
		cy.openIncidentBackstage();
	});

	it('Opens incident backstage by default with "Incidents & Playbooks" button in main menu', () => {
		// * Verify that when backstage loads, the heading is visible and contains "Incident"
		cy.findByTestId('titleIncident').should('be.visible').contains('Incidents');
	});

	it('Opens playbooks backstage with "Playbooks" LHS button', () => {
		// # Switch to playbooks backstage
		cy.findByTestId('playbooksLHSButton').click();

		// * Verify that the heading is visible and contains "Playbooks"
		cy.findByTestId('titlePlaybook').should('be.visible').contains('Playbooks');
	});

	it('Opens incidents backstage with "Incidents" LHS button', () => {
		// # Switch to incidents backstage
		cy.findByTestId('incidentsLHSButton').click();

		// * Verify again that the switch was successful by verifying the heading is visible and has "Incidents"
		cy.findByTestId('titleIncident').should('be.visible').contains('Incidents');
	});
});
