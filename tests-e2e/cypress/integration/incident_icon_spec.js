// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec contains tests for incident icon in channel header
 */
 
import users from '../fixtures/users.json';

describe('Incident Icon', () => {
	beforeEach(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');
	});

	// Test Plan v0.1 #44 - Clicking the Incident Response plugin icon on header toggles the RHS open and close
	it('#44 - Toggles the incident RHS open and close', () => {
		cy.visit('/');
		cy.get('#channel-header').within(() => {
			cy.get('#incidentIcon').should('be.visible').click();
		});
		cy.get('#rhsContainer').should('be.visible').within(() => {
			cy.findByText('Incident').should('be.visible');
		});
		/**
		* TODO:
		* add test for: clicking on the incident icon again closes the RHS
		* right now, the full channel header can't be seen during Cypress test when RHS is open.
		* need to find a work around for that.
		*/
	});
});
