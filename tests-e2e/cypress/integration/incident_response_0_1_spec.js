// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import users from '../fixtures/users.json';


//function incidentStarted => getAllIncidents has incident ID, added to RHS list

//function incidentEnded => disappears from RHS incident list, getAllIncidents doesn't have ID

const incidentStartCommand = "/incident start";

describe('Incident Response Plugin', () => {
	// before(() => {
	// 	cy.apiLogin('sysadmin');
	// 	cy.deleteAllIncidents();
	// 	cy.apiLogout();
	// });

	beforeEach(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');
        cy.visit('/ad-1/channels/off-topic');
        //delete all incidents here
	});

	// // Incident Response icon is present in channel header
	// it('Test Plan for v0.1 #11 - Incident Response plugin icon is present in channel header', () => {
	// 	cy.get('#channel-header').within(() => {
	// 		cy.get('#incidentIcon').should('be.visible');
	// 	});
	// });

	// // Test Plan v0.1 #44 - Clicking the Incident Response plugin icon on header toggles the RHS open and close
	// it('Test Plan v0.1 #44 - Clicking the Incident Response plugin icon on header toggles the RHS open and close', () => {
	// 	cy.get('#channel-header').within(() => {
	// 		cy.get('#incidentIcon').should('be.visible').click();
	// 	});
	// 	cy.get('#rhsContainer').should('be.visible').within(() => {
	// 		cy.findByText('Incident List').should('be.visible');
	// 	});
	// 	//add test for: clicking on the incident icon again closes the RHS
	// });

	// // Test Plan for v0.1 #17 - Incident creation is canceled when Esc is pressed on Incident Response modal
	// it('Test Plan for v0.1 #17 - Incident creation is canceled when Esc is pressed on Incident Response modal', () => {
	// 	// Verify that the incident response interactive dialog closes
	// 	cy.findByTestId('post_textbox').clear().type(incidentStartCommand + '{enter}{enter}{enter}');
	// 	cy.get('#interactiveDialogModal').should('be.visible').within(() => {
	// 		cy.get('#interactiveDialogCancel').click();
	// 	});
	// 	cy.get('#interactiveDialogModal').should('not.be.visible');

	// 	//fill the interactive dialog and press esc. verify it's cancelled. no incident is created
	// 	cy.findByTestId('post_textbox').clear().type(incidentStartCommand + '{enter}{enter}{enter}');
	// 	const newIncident = "New Incident" + Date.now();
	// 	cy.get('#interactiveDialogModal').should('be.visible').within(() => {
	// 		cy.findByTestId('incidentNameinput').type(newIncident);
	// 		cy.get('#interactiveDialogCancel').click();
	// 	});
	// 	cy.get('#interactiveDialogModal').should('not.be.visible');
	//
	// // Login as sysadmin to check that incident did not get created:
	// 	cy.apiLogout();
	// 	cy.apiLogin('sysadmin');
	// 	cy.apiGetAllIncidents().then((response) => {
	// 		const allIncidents = JSON.parse(response.body);
	// 		allIncidents.forEach((incident) => {
	// 			incident.name != newIncident;
	// 		});
	// 	});
	// 	cy.apiLogout();
	// 	cy.apiLogin('user-1');
	// });


	// Test Plan for v0.1 #18, 23, 28 Incident can be started while viewing a public channel
	it('Test Plan for v0.1 #18, 23, 28 Incident can be started while viewing a public channel', () => {
		// with slash command
		cy.findByTestId('post_textbox').clear().type(incidentStartCommand + '{enter}{enter}{enter}');
		const newIncident1 = "New Incident" + Date.now();
		cy.get('#interactiveDialogModal').should('be.visible').within(() => {
			cy.findByTestId('incidentNameinput').type(newIncident1);
			cy.get('#interactiveDialogSubmit').click();
		});
		cy.get('#interactiveDialogModal').should('not.be.visible');
		
		//Login as sysadmin to check that incident got created:
		cy.apiLogout();
		cy.apiLogin('sysadmin');
		var incidentNamesList = [];
		var incidentIsActiveList = [];
		cy.apiGetAllIncidents().then((response) => {
			const allIncidents = JSON.parse(response.body);
			allIncidents.forEach((incident) => {
				if (incident.name == newIncident1) {
					assert.equal(incident.is_active, true);
				}
			});
		});

		// from RHS

		// from post action menu
		
	});

	// // Test Plan for v0.1 #19, 24, 29 - Incident can be started while viewing a private channel
	// it('Test Plan for v0.1 #19, 24, 29 - Incident can be started while viewing a private channel', () => {
	// 	// with slash command
	// 	// from RHS
	// 	// from post action menu
		
	// });

	// // Test Plan for v0.1 #20, 25, 30 - Incident can be started while viewing a group message channel
	// it('Test Plan for v0.1 #20, 25, 30 - Incident can be started while viewing a group message channel', () => {
	// 	// with slash command
	// 	// from RHS
	// 	// from post action menu
		
	// });

	// // Test Plan for v0.1 #21, 26, 31 = Incident can be started while viewing a direct message channel
	// it('Test Plan for v0.1 #21, 26, 31 = Incident can be started while viewing a direct message channel', () => {
	// 	// with slash command
	// 	// from RHS
	// 	// from post action menu
	// });

	// // Test Plan for v0.1 #22, 27, 32 - Incident can be started while viewing the direct message channel to self
	// it('Test Plan for v0.1 #22, 27, 32 - Incident can be started while viewing the direct message channel to self', () => {
	// 	// with slash command
	// 	// from RHS
	// 	// from post action menu
	// });

	// // Test Plan v0.1 #33 - The user who started an incident is marked as the commander of the incident
	// it('Test Plan v0.1 #33 - The user who started an incident is marked as the commander of the incident', () => {
		
	// });

	// // Test Plan v0.1 #34, 35 - A new private channel is created when an incident is started and user is auto-invited to the channel
	// it('Test Plan v0.1 #34, 35 - A new private channel is created when an incident is started and user is auto-invited to the channel', () => {
		
	// });

	// // Test Plan v0.1 #36, 37 - Incident channel can be renamed and is linked properly when renamed
	// it('Test Plan v0.1 #36, 37 - Incident channel can be renamed and is linked properly when renamed', () => {
		
	// });

	// // Test Plan v0.1 #38 - Incident can be ended with slash command
	// it('Test Plan v0.1 #38 - Incident can be ended with slash command', () => {
		
	// });

	// // Test Plan v0.1 #39 - Incident can be ended from RHS
	// it('Test Plan v0.1 #39 - Incident can be ended from RHS', () => {
		
	// });

	// // Test Plan v0.1 #41 - Incident list reloads on RHS when an incident is ended while viewing its details
	// it('Test Plan v0.1 #41 - Incident list reloads on RHS when an incident is ended while viewing its details', () => {
		
	// });

	// // Test Plan v0.1 #42 - Trying to end an incident (with `/end`) that has already been ended shows error
	// it('Test Plan v0.1 #42 - Trying to end an incident (with `/end`) that has already been ended shows error', () => {
		
	// });

	// // Test Plan v0.1 #43 - Issuing an `/incident end` command from a non-incident channel shows error message
	// it('Test Plan v0.1 #43 - Issuing an `/incident end` command from a non-incident channel shows error message', () => {
		
	// });

	// // Test Plan v0.1 #45 - Clicking on the Incident Response RHS back button takes user back to incident list
	// it('Test Plan v0.1 #45 - Clicking on the Incident Response RHS back button takes user back to incident list', () => {
		
	// });

	// // Test Plan v0.1 #58 - The incident list on the RHS shows the commander without opening the incident details
	// it('Test Plan v0.1 #58 - The incident list on the RHS shows the commander without opening the incident details', () => {
		
	// });

	// // Test Plan v0.1 #59 - A message is posted to the channel when the incident starts
	// it('Test Plan v0.1 #59 - A message is posted to the channel when the incident starts', () => {
		
	// });

	// // Test Plan v0.1 #60 - An message is posted in the channel where the incident was started
	// it('Test Plan v0.1 #60 - An message is posted in the channel where the incident was started', () => {
		
	// });

	// // Test Plan v0.1 #61, 62 - A message is posted to the channel when the incident ends
	// it('Test Plan v0.1 #61, 62 - A message is posted to the channel when the incident ends', () => {
		
	// });
	// 	// incident ends with slash command
	// 	// incident ends from RHS

	// // Test Plan v0.1 #64 - Channel name in Incident Details modal cannot be empty
	// it('Test Plan v0.1 #64 - Channel name in Incident Details modal cannot be empty', () => {
		
	// });

	// Test not in test plan: can't allow channel name of less than 2 characters.
});