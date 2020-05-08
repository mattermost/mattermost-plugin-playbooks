// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import users from '../fixtures/users.json';
import * as TIMEOUTS from '../fixtures/timeouts';

describe('Incident Response Plugin, v0.1', () => {
	beforeEach(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');

        //afteEach: delete all incidents here
	});

	// Test Plan v0.1 #44 - Clicking the Incident Response plugin icon on header toggles the RHS open and close
	it('#44 - Clicking the Incident Response plugin icon on header toggles the RHS open and close', () => {
		cy.visit('/');
		cy.get('#channel-header').within(() => {
			cy.get('#incidentIcon').should('be.visible').click();
		});
		cy.get('#rhsContainer').should('be.visible').within(() => {
			cy.findByText('Incident List').should('be.visible');
		});
		/**
		* TODO:
		* add test for: clicking on the incident icon again closes the RHS
		* right now, the full channel header can't be seen during Cypress test when RHS is open.
		* need to find a work around for that.
		*/
	});

	// Test Plan for v0.1 #17 - Incident creation is canceled when Esc is pressed on Incident Response modal
	it('#17 - Incident creation is canceled when Esc is pressed on Incident Response modal', () => {
		const incidentStartCommand = '/incident start';
		cy.visit('/');
		cy.findByTestId('post_textbox').clear().type(incidentStartCommand + '{enter}');
		cy.get('#interactiveDialogModal').should('be.visible').within(() => {
			cy.get('#interactiveDialogCancel').click();
		});
		cy.get('#interactiveDialogModal').should('not.be.visible');

		// Fill the interactive dialog and press esc. Verify it's cancelled. No incident is created
		cy.findByTestId('post_textbox').clear().type(incidentStartCommand + '{enter}');
		const newIncident = "New Incident" + Date.now();
		cy.get('#interactiveDialogModal').should('be.visible').within(() => {
			cy.findByTestId('incidentNameinput').type(newIncident);
			cy.get('#interactiveDialogCancel').click();
		});
		cy.get('#interactiveDialogModal').should('not.be.visible');
	
		// Login as sysadmin to check that incident did not get created:
		cy.apiLogout();
		cy.apiLogin('sysadmin');
		cy.apiGetAllIncidents().then((response) => {
			const allIncidents = JSON.parse(response.body);
			allIncidents.forEach((incident) => {
				assert.notEqual(incident.name, newIncident);
			});
		});
	});

	// Test Plan for v0.1 #18, 23, 28 Incident can be started while viewing a public channel
	it('#18 Incident can be started with slash command while viewing a public channel', () => {
		// Visit a public channel: off-topic
		cy.visit('/ad-1/channels/off-topic');
		// INCIDENT CAN BE STARTED WITH SLASH COMMAND
		const newIncident1 = "Public " + Date.now();
		cy.startIncidentWithSlashCommand(newIncident1);
		cy.verifyIncidentCreated(newIncident1);
	});

	it('#23 Incident can be started from RHS while viewing a public channel', () => {
		// INCIDENT CAN BE STARTED FROM INCIDENT RHS
		cy.visit('/ad-1/channels/off-topic');
		const newIncident2 = "Public 2 - " + Date.now();
		cy.startIncidentFromRHS(newIncident2);
		cy.verifyIncidentCreated(newIncident2);
	});

	it('#28 Incident can be started from post menu while viewing a public channel', () => {
		// INCIDENT CAN BE STARTED FROM POST MENU
		cy.visit('/ad-1/channels/off-topic');
		const newIncident3 = "Public 3 - " + Date.now();
		cy.startIncidentFromPostMenu(newIncident3);
		cy.verifyIncidentCreated(newIncident3);
	});

	// Test Plan for v0.1 #19, 24, 29 - Incident can be started while viewing a private channel
	it('#19 - Incident can be started while viewing a private channel', () => {
		// Visit a private channel: commodi
		cy.visit('/ad-1/channels/autem-2')
		// INCIDENT CAN BE STARTED WITH SLASH COMMAND
		const newIncident1 = "Private " + Date.now();
		cy.startIncidentWithSlashCommand(newIncident1);
		cy.verifyIncidentCreated(newIncident1);
	});

	it('#24 - Incident can be started while viewing a private channel', () => {
		// Visit a private channel: commodi
		cy.visit('/ad-1/channels/autem-2')
		// INCIDENT CAN BE STARTED FROM INCIDENT RHS
		const newIncident2 = "Private 2 - " + Date.now();
		cy.startIncidentFromRHS(newIncident2);
		cy.verifyIncidentCreated(newIncident2);
	});

	it('#29 - Incident can be started while viewing a private channel', () => {
		// Visit a private channel: commodi
		cy.visit('/ad-1/channels/autem-2')
		// INCIDENT CAN BE STARTED FROM POST MENU
		const newIncident3 = "Private 3 - " + Date.now();
		cy.startIncidentFromPostMenu(newIncident3);
		cy.verifyIncidentCreated(newIncident3);
	});

	// Test Plan for v0.1 #20, 25, 30 - Incident can be started while viewing a group message channel
	it('#20 - Incident can be started with slash command while viewing a group message channel', () => {
		// with slash command
		// Create a GM channel and visit channel
		cy.apiCreateGroupChannel(['anne.stone', 'diana.wells']);
		// INCIDENT CAN BE STARTED WITH SLASH COMMAND
		const gm1 = "GM 1 - " + Date.now();
		cy.startIncidentWithSlashCommand(gm1);
		cy.verifyIncidentCreated(gm1);
	});

	it('#25 - Incident can be started from RHS while viewing a group message channel', () => {
	 	// from RHS
		cy.apiCreateGroupChannel(['anne.stone', 'diana.wells', 'aaron.peterson']);
		// INCIDENT CAN BE STARTED FROM RHS
		const gm2 = "GM 2 - " + Date.now();
		cy.startIncidentFromRHS(gm2);
		cy.verifyIncidentCreated(gm2);
	});

	it('#30 - Incident can be started from post menu while viewing a group message channel', () => {
		// from post menu
		cy.apiCreateGroupChannel(['anne.stone', 'aaron.peterson']);
		// INCIDENT CAN BE STARTED FROM POST MENU
		const gm3 = "GM 3 - " + Date.now();
		cy.startIncidentFromPostMenu(gm3);
		cy.verifyIncidentCreated(gm3);
	});

	// Test Plan for v0.1 #21, 26, 31 = Incident can be started while viewing a direct message channel
	it('#21 - Incident can be started with slash command while viewing a direct message channel', () => {
		cy.visit('/');
		cy.startDirectMessage('ashley.berry');
		// start incident with slash command
		const dm1 = "DM 1 - " + Date.now();
		cy.startIncidentWithSlashCommand(dm1);
		cy.verifyIncidentCreated(dm1);
	});

	it('#26 - Incident can be started from RHS while viewing a direct message channel', () => {
		cy.visit('/');
		cy.startDirectMessage('douglas.daniels');
		// start incident from RHS
		const dm2 = "DM 2 - " + Date.now();
		cy.startIncidentFromRHS(dm2);
		cy.verifyIncidentCreated(dm2);
	});

	it('#31 - Incident can be started from post menu while viewing a direct message channel', () => {
		cy.visit('/');
		cy.startDirectMessage('emily.meyer');
		// start incident from post menu
		const dm3 = "DM 3 - " + Date.now();
		cy.startIncidentFromPostMenu(dm3);
		cy.verifyIncidentCreated(dm3);
	});

	// Test Plan for v0.1 #22, 27, 32 - Incident can be started while viewing the direct message channel to self
	it('#22 - Incident can be started with slash command while viewing the direct message channel to self', () => {
		cy.visit('/');
		cy.startDirectMessage('Victor Welch', true, 'user-1');
		// start incident with slash command
		const dm_self_1 = "DM self 1 - " + Date.now();
		cy.startIncidentWithSlashCommand(dm_self_1);
		cy.verifyIncidentCreated(dm_self_1);
	});
});
