// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const incidentStartCommand = "/incident start";

// function startIncident(incidentID) {
Cypress.Commands.add('startIncident', (incidentID) => {
	cy.get('#interactiveDialogModal').should('be.visible').within(() => {
		cy.findByTestId('incidentNameinput').type(incidentID);
		cy.get('#interactiveDialogSubmit').click();
	});
	cy.get('#interactiveDialogModal').should('not.be.visible');
});

// Starts incident with the `/incident start` slash command
// function startIncidentWithSlashCommand(incidentID) {
Cypress.Commands.add('startIncidentWithSlashCommand', (incidentID) => {
	cy.findByTestId('post_textbox').clear().type(incidentStartCommand + '{enter}{enter}{enter}');
	cy.startIncident(incidentID);
});

// Starts incident from the incident RHS
// function startIncidentFromRHS(incidentID) {
Cypress.Commands.add('startIncidentFromRHS', (incidentID) => {
	// reload the page so that if the RHS is already open, it's closed
	cy.reload();
	//open the incident RHS
	cy.get('#channel-header').within(() => {
		cy.get('#incidentIcon').click();
	});
	cy.get('#rhsContainer').should('be.visible').within(() => {
		cy.findByText('Incident List').should('be.visible');
		cy.get('#incidentRHSIconPlus').click();
	});
	cy.startIncident(incidentID);
});

//Starts incident from the post menu
// function startIncidentFromPostMenu(incidentID) {
Cypress.Commands.add('startIncidentFromPostMenu', (incidentID) => {
	//post a message as user to avoid system message
	cy.findByTestId('post_textbox').clear().type("new message here" + '{enter}{enter}{enter}');
	cy.clickPostDotMenu();
	cy.findByTestId('incidentPostMenuIcon').click();
	cy.startIncident(incidentID);
});
