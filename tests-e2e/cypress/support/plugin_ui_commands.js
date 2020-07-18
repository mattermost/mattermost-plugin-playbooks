// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';
import { TINY } from '../fixtures/timeouts';

const incidentStartCommand = "/incident start";

// function startIncident(incidentID) {
Cypress.Commands.add('startIncident', (playbookName, incidentID) => {
	cy.get('#interactiveDialogModal').should('be.visible').within(() => {
		// # Select playbook
		cy.selectPlaybookFromDropdown(playbookName);

		// # Type channel name
		cy.findByTestId('incidentNameinput').type(incidentID, {force: true});

		// # Submit
		cy.get('#interactiveDialogSubmit').click();
	});
	cy.get('#interactiveDialogModal').should('not.be.visible');
});

// Opens incident dialog using the `/incident start` slash command
Cypress.Commands.add('openIncidentDialogFromSlashCommand', () => {
	cy.findByTestId('post_textbox').clear().type(incidentStartCommand);

	// Using esc to make sure we exist out of slash command autocomplete
	cy.findByTestId('post_textbox').type('{esc}{esc}{esc}{esc}', {delay: 100}).type('{enter}');

	cy.get('#interactiveDialogModalLabel');
});

// Starts incident with the `/incident start` slash command
// function startIncidentWithSlashCommand(incidentID) {
Cypress.Commands.add('startIncidentWithSlashCommand', (playbookName, incidentID) => {
	cy.openIncidentDialogFromSlashCommand();
	cy.startIncident(playbookName, incidentID);
});

// Starts incident from the incident RHS
// function startIncidentFromRHS(incidentID) {
Cypress.Commands.add('startIncidentFromRHS', (playbookName, incidentID) => {
	// reload the page so that if the RHS is already open, it's closed
	cy.reload();
	//open the incident RHS
	cy.get('#channel-header').within(() => {
		cy.get('#incidentIcon').click();
	});
	cy.get('#rhsContainer').should('be.visible').within(() => {
		// cy.findByText('Incident List').should('be.visible');
		// cy.get('#incidentRHSIconPlus').click();
		cy.findByText('+ Create new incident').click();
	});
	cy.startIncident(playbookName, incidentID);
});

//Starts incident from the post menu
// function startIncidentFromPostMenu(incidentID) {
Cypress.Commands.add('startIncidentFromPostMenu', (playbookName, incidentID) => {
	//post a message as user to avoid system message
	cy.findByTestId('post_textbox').clear().type("new message here" + '{enter}');
	cy.clickPostDotMenu();
	cy.findByTestId('incidentPostMenuIcon').click();
	cy.startIncident(playbookName, incidentID);
});

// Open Incidents backstage
Cypress.Commands.add('openIncidentBackstage', () => {
	cy.get('#lhsHeader', {timeout: TIMEOUTS.GIGANTIC}).should('be.visible').within(() => {
        // # Click hamburger main menu
        cy.get('#sidebarHeaderDropdownButton').click();

        // * Dropdown menu should be visible
        cy.get('.dropdown-menu').should('be.visible').within(() => {
            // 'Incidents & Playbooks' button should be visible, then click
            cy.findByText('Incidents & Playbooks').should('be.visible').click();
        });
	});
});

// Create playbook
Cypress.Commands.add('createPlaybook', (teamName, playbookName) => {
	cy.visit(`/${teamName}/com.mattermost.plugin-incident-response/playbooks/new`);

	cy.findByTestId('save_playbook', {timeout: TIMEOUTS.LARGE}).should('be.visible');

	// # Type playbook name
	cy.get('#playbook-name').type(playbookName);

	// # Save
	cy.findByTestId('save_playbook').click();
});

// Select the playbook from the dropdown menu
Cypress.Commands.add('selectPlaybookFromDropdown', (playbookName) => {
	cy.findByTestId('autoCompleteSelector').should('be.visible').within(()=> {
		cy.get('input').type(`${playbookName}`);
		cy.get('#suggestionList').contains(playbookName).click({force: true});
	});
});
