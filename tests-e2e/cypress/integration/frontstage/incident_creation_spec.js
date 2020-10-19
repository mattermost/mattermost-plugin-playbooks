// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for the incident creation using all 3 methods:
 * - Slash command
 * - RHS
 * - Post action menu
 *
 * This spec also includes tests for starting an incident in all types of channels:
 * - Public
 * - Private
 * - Group message
 * - Direct message
 * - Direct message with self
 */
describe('incidents can be started', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Create a playbook
        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;

            cy.apiGetCurrentUser().then((user) => {
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show plugin icons even when RHS is open
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');
    });

    describe('via slash command', () => {
        it('while viewing a public channel', () => {
            // # Visit a public channel: off-topic
            cy.visit('/ad-1/channels/off-topic');

            // * Verify that incident can be started with slash command
            const incidentName = 'Public ' + Date.now();
            cy.startIncidentWithSlashCommand(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a private channel', () => {
            // # Visit a private channel: autem-2
            cy.visit('/ad-1/channels/autem-2');

            // * Verify that incident can be started with slash command
            const incidentName = 'Private ' + Date.now();
            cy.startIncidentWithSlashCommand(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a group message channel', () => {
            // # Navigate to the application
            cy.visit('/');

            // # Create a GM channel and visit channel
            cy.startGroupMessage(['anne.stone', 'diana.wells']);

            // * Verify that incident can be started with slash command
            const incidentName = 'Public ' + Date.now();
            cy.startIncidentWithSlashCommand(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a direct message channel with another user', () => {
            // # Navigate to the application
            cy.visit('/');

            // # Create a DM channel and visit channel
            cy.startDirectMessage('douglas.daniels');

            // * Verify that incident can be started with slash command
            const incidentName = 'Public ' + Date.now();
            cy.startIncidentWithSlashCommand(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a direct message channel with self', () => {
            // # Navigate to the application
            cy.visit('/');

            // # Create a DM channel and visit channel
            cy.startDirectMessage('Victor Welch', true, 'user-1');

            // * Verify that incident can be started with slash command
            const incidentName = 'Public ' + Date.now();
            cy.startIncidentWithSlashCommand(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });
    });

    describe('via RHS', () => {
        it('while viewing a public channel', () => {
            // # Visit a public channel: off-topic
            cy.visit('/ad-1/channels/off-topic');

            // * Verify that incident can be started from incident RHS
            const incidentName = 'Public - ' + Date.now();
            cy.startIncidentFromRHS(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a private channel', () => {
            // # Visit a private channel: autem-2
            cy.visit('/ad-1/channels/autem-2');

            // * Verify that incident can be started from incident RHS
            const incidentName = 'Private - ' + Date.now();
            cy.startIncidentFromRHS(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a group message channel', () => {
            // # Navigate to the application
            cy.visit('/');

            // # Create a GM channel and visit channel
            cy.startGroupMessage(['anne.stone', 'diana.wells']);

            // * Verify that incident can be started from incident RHS
            const incidentName = 'GM - ' + Date.now();
            cy.startIncidentFromRHS(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a direct message channel with another user', () => {
            // # Navigate to the application
            cy.visit('/');

            // # Create a DM channel and visit channel
            cy.startDirectMessage('douglas.daniels');

            // * Verify that incident can be started from incident RHS
            const incidentName = 'DM - ' + Date.now();
            cy.startIncidentFromRHS(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a direct message channel with self', () => {
            // # Navigate to the application
            cy.visit('/');

            // # Create a DM with the test user himself and visit channel
            cy.startDirectMessage('Victor Welch', true, 'user-1');

            // * Verify that incident can be started with slash command
            const incidentName = 'Self DM ' + Date.now();
            cy.startIncidentWithSlashCommand(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });
    });

    describe('via post menu', () => {
        it('while viewing a public channel', () => {
            // # Visit a public channel: off-topic
            cy.visit('/ad-1/channels/off-topic');

            // * Verify that incident can be started from post menu
            const incidentName = 'Public - ' + Date.now();
            cy.startIncidentFromPostMenu(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a private channel', () => {
            // # Visit a private channel: autem-2
            cy.visit('/ad-1/channels/autem-2');

            // * Verify that incident can be started from post menu
            const incidentName = 'Private - ' + Date.now();
            cy.startIncidentFromPostMenu(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a group message channel', () => {
            // # Navigate to the application
            cy.visit('/');

            // # Create a GM channel and visit channel
            cy.startGroupMessage(['anne.stone', 'diana.wells']);

            // * Verify that incident can be started from post menu
            const incidentName = 'GM - ' + Date.now();
            cy.startIncidentFromPostMenu(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a direct message channel with another user', () => {
            // # Navigate to the application
            cy.visit('/');

            // # Create a DM channel and visit channel
            cy.startDirectMessage('douglas.daniels');

            // * Verify that incident can be started from post menu
            const incidentName = 'DM - ' + Date.now();
            cy.startIncidentFromPostMenu(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });

        it('while viewing a direct message channel with self', () => {
            // # Navigate to the application
            cy.visit('/');

            // # Create a DM with the test user himself and visit channel
            cy.startDirectMessage('Victor Welch', true, 'user-1');

            // * Verify that incident can be started from post menu
            const incidentName = 'Self DM - ' + Date.now();
            cy.startIncidentFromPostMenu(playbookName, incidentName);
            cy.verifyIncidentActive(teamId, incidentName);
        });
    });

    it('with a description', () => {
        // # Visit a public channel: off-topic
        cy.visit('/ad-1/channels/off-topic');

        // * Verify that incident can be started from incident RHS
        const now = Date.now();
        const incidentName = 'With Description - ' + now;
        const incidentDescription = 'Description - ' + now;
        cy.startIncidentWithSlashCommand(playbookName, incidentName, incidentDescription);
        cy.verifyIncidentActive(teamId, incidentName, incidentDescription);
    });
});
