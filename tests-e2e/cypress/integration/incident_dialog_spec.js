// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec contains tests for the incident creation modal
 */
import users from '../fixtures/users.json';
import * as TIMEOUTS from '../fixtures/timeouts';

function openIncidentDialog() {
	const incidentStartCommand = '/incident start';
	cy.findByTestId('post_textbox').clear().type(incidentStartCommand + '{enter}');
}

function closeIncidentDialog() {
	cy.get('#interactiveDialogModal').should('be.visible').within(() => {
			cy.get('#interactiveDialogCancel').click();
		});
}

describe('Incident Creation Modal Verification', () => {
	beforeEach(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');
		cy.visit('/');
		openIncidentDialog();
	});

	it('Incident creation modal shows "Incident Details" heading', () => {
		cy.get('#interactiveDialogModal').should('be.visible').within(() => {
			cy.findByText("Incident Details").should('be.visible');
		});
		closeIncidentDialog();
	});

	it('Incident creation modal shows Commander', () => {
		cy.get('#interactiveDialogModalIntroductionText').contains('Commander');
	});

	it ('Incident creation modal contains channel name', () => {
		// * Verify channel name is there
		cy.findByTestId('incidentName').should('be.visible');
		cy.findByText("Channel Name");
		closeIncidentDialog();
	});

	it ('Incident creation modal contains playbook dropdown', () => {
		// * Verify playbook dropdown is there
		cy.findByTestId('autoCompleteSelector').should('be.visible');
		cy.findByText("Playbook").should('be.visible');
		closeIncidentDialog();
	});

	it('Incident creation is canceled when Cancel is clicked on Incident Response modal', () => {
		closeIncidentDialog();
		cy.get('#interactiveDialogModal').should('not.be.visible');

		// # Fill the interactive dialog and click Cancel
		openIncidentDialog();
		const newIncident = "New Incident" + Date.now();
		cy.get('#interactiveDialogModal').should('be.visible').within(() => {
			cy.findByTestId('incidentNameinput').type(newIncident);
			cy.get('#interactiveDialogCancel').click();
		});
		// * Verify it's canceled
		cy.get('#interactiveDialogModal').should('not.be.visible');

		// * Login as sysadmin to check that incident did not get created
		cy.apiLogout();
		cy.apiLogin('sysadmin');
		cy.apiGetAllIncidents().then((response) => {
			const allIncidents = JSON.parse(response.body);
			allIncidents.incidents.forEach((incident) => {
				assert.notEqual(incident.name, newIncident);
			});
		});
	});
});
