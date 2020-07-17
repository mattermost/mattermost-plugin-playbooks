// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for the incident creation using all 3 methods:
 * - With slash command
 * - From RHS
 * - From post action menu
 *
 * This spec also includes tests for starting an incident in all types of channels:
 * - Public
 * - Private
 * - Group message
 * - Direct message
 * - Direct message with self
 */

import users from '../fixtures/users.json';
import * as TIMEOUTS from '../fixtures/timeouts';

describe('Incident Creation', () => {
	const dummyPlaybookName = 'Dummy playbook' + Date.now();

	before(() => {
		cy.apiLogin('user-1');
		cy.createPlaybook('ad-1', dummyPlaybookName);
	})

	beforeEach(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');

        //TODO:- afterEach: delete all incidents and playbooks here
	});

	// Test Plan for v0.1 #18, 23, 28 Incident can be started while viewing a public channel
	it('Can be started with slash command while viewing a public channel', () => {
		// # Visit a public channel: off-topic
		cy.visit('/ad-1/channels/off-topic');

		// * Verify that incident can be started with slash command
		const newIncident1 = "Public " + Date.now();
		cy.startIncidentWithSlashCommand(dummyPlaybookName, newIncident1);
		cy.verifyIncidentCreated(newIncident1);
	});

	it('Can be started from RHS while viewing a public channel', () => {
		// * Verify that incident can be started from incident RHS
		cy.visit('/ad-1/channels/off-topic');
		const newIncident2 = "Public 2 - " + Date.now();
		cy.startIncidentFromRHS(dummyPlaybookName, newIncident2);
		cy.verifyIncidentCreated(newIncident2);
	});

	it('Can be started from post menu while viewing a public channel', () => {
		// * Verify that incident can be started from post menu
		cy.visit('/ad-1/channels/off-topic');
		const newIncident3 = "Public 3 - " + Date.now();
		cy.startIncidentFromPostMenu(dummyPlaybookName, newIncident3);
		cy.verifyIncidentCreated(newIncident3);
	});

	// Test Plan for v0.1 #19, 24, 29 - Incident can be started while viewing a private channel
	it('Can be started while viewing a private channel', () => {
		// # Visit a private channel: commodi
		cy.visit('/ad-1/channels/autem-2')
		
		// * Verify that incident can be started with slash command
		const newIncident1 = "Private " + Date.now();
		cy.startIncidentWithSlashCommand(dummyPlaybookName, newIncident1);
		cy.verifyIncidentCreated(newIncident1);
	});

	it('Can be started while viewing a private channel', () => {
		// # Visit a private channel: commodi
		cy.visit('/ad-1/channels/autem-2')
		
		// * Verify that incident can be started from incident RHS
		const newIncident2 = "Private 2 - " + Date.now();
		cy.startIncidentFromRHS(dummyPlaybookName, newIncident2);
		cy.verifyIncidentCreated(newIncident2);
	});

	it('Can be started while viewing a private channel', () => {
		// # Visit a private channel: commodi
		cy.visit('/ad-1/channels/autem-2')
		
		// * Verify that incident can be started from post menu
		const newIncident3 = "Private 3 - " + Date.now();
		cy.startIncidentFromPostMenu(dummyPlaybookName, newIncident3);
		cy.verifyIncidentCreated(newIncident3);
	});

	// Test Plan for v0.1 #20, 25, 30 - Incident can be started while viewing a group message channel
	it('Can be started with slash command while viewing a group message channel', () => {
		// # Create a GM channel and visit channel
		cy.apiCreateGroupChannel(['anne.stone', 'diana.wells'], 'ad-1');
		
		// * Verify that incident can be started with slash command
		const gm1 = "GM 1 - " + Date.now();
		cy.startIncidentWithSlashCommand(dummyPlaybookName, gm1);
		cy.verifyIncidentCreated(gm1);
	});

	it('Can be started from RHS while viewing a group message channel', () => {
		cy.apiCreateGroupChannel(['anne.stone', 'diana.wells', 'aaron.peterson'], 'ad-1');

		// * Verify that incident can be started from incident RHS
		const gm2 = "GM 2 - " + Date.now();
		cy.startIncidentFromRHS(dummyPlaybookName, gm2);
		cy.verifyIncidentCreated(gm2);
	});

	it('Can be started from post menu while viewing a group message channel', () => {
		cy.apiCreateGroupChannel(['anne.stone', 'aaron.peterson'], 'ad-1');
		
		// * Verify that incident can be started from post menu
		const gm3 = "GM 3 - " + Date.now();
		cy.startIncidentFromPostMenu(dummyPlaybookName, gm3);
		cy.verifyIncidentCreated(gm3);
	});

	// Test Plan for v0.1 #21, 26, 31 = Incident can be started while viewing a direct message channel
	it('Can be started with slash command while viewing a direct message channel', () => {
		cy.visit('/');
		// # Start a DM
		cy.startDirectMessage('ashley.berry');
		
		// * Start incident with slash command
		const dm1 = "DM 1 - " + Date.now();
		cy.startIncidentWithSlashCommand(dummyPlaybookName, dm1);
		cy.verifyIncidentCreated(dm1);
	});

	it('Can be started from RHS while viewing a direct message channel', () => {
		cy.visit('/');
		cy.startDirectMessage('douglas.daniels');
		// * Start incident from RHS
		const dm2 = "DM 2 - " + Date.now();
		cy.startIncidentFromRHS(dummyPlaybookName, dm2);
		cy.verifyIncidentCreated(dm2);
	});

	it('Can be started from post menu while viewing a direct message channel', () => {
		cy.visit('/');
		cy.startDirectMessage('emily.meyer');
		// * Start incident from post menu
		const dm3 = "DM 3 - " + Date.now();
		cy.startIncidentFromPostMenu(dummyPlaybookName, dm3);
		cy.verifyIncidentCreated(dm3);
	});

	// Test Plan for v0.1 #22, 27, 32 - Incident can be started while viewing the direct message channel to self
	it('Can be started with slash command while viewing the direct message channel to self', () => {
		cy.visit('/');
		cy.startDirectMessage('Victor Welch', true, 'user-1');
		// * Start incident with slash command
		const dm_self_1 = "DM self 1 - " + Date.now();
		cy.startIncidentWithSlashCommand(dummyPlaybookName, dm_self_1);
		cy.verifyIncidentCreated(dm_self_1);
	});
});
