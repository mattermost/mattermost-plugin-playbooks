// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('slash command', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;
    let incidentId;
    let incidentName;
    let incidentChannelName;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Switch to clean display mode
        cy.apiSaveMessageDisplayPreference('clean');

        // # Create a playbook and incident.
        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                }).then((playbook) => {
                    playbookId = playbook.id;

                    const now = Date.now();
                    incidentName = 'Incident (' + now + ')';
                    incidentChannelName = 'incident-' + now;
                    cy.apiStartIncident({
                        teamId,
                        playbookId,
                        incidentName,
                        commanderUserId: userId,
                    }).then((incident) => {
                        incidentId = incident.id;
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');

        // # Reset the commander to test-1 as necessary.
        cy.apiChangeIncidentCommander(incidentId, userId);
    });

    describe('/incident commander', () => {
        it('should show an error when not in an incident channel', () => {
            // # Navigate to a non-incident channel
            cy.visit('/ad-1/channels/town-square');

            // # Run a slash command to show the current commander
            cy.executeSlashCommand('/incident commander');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('You can only show the commander from within the incident\'s channel.');
        });

        it('should show the current commander', () => {
            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // # Run a slash command to show the current commander
            cy.executeSlashCommand('/incident commander');

            // * Verify the expected commander.
            cy.verifyEphemeralMessage('@user-1 is the current commander for this incident.');
        });
    });

    describe('/incident commander @username', () => {
        it('should show an error when not in an incident channel', () => {
            // # Navigate to a non-incident channel
            cy.visit('/ad-1/channels/town-square');

            // # Run a slash command to change the current commander
            cy.executeSlashCommand('/incident commander user-2');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('You can only change the commander from within the incident\'s channel.');
        });

        describe('should show an error when the user is not found', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current commander
                cy.executeSlashCommand('/incident commander unknown');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('Unable to find user @unknown');
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current commander
                cy.executeSlashCommand('/incident commander @unknown');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('Unable to find user @unknown');
            });
        });

        describe('should show an error when the user is not in the channel', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);

                // # Ensure the sysadmin is not part of the channel.
                cy.executeSlashCommand('/kick sysadmin');
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current commander
                cy.executeSlashCommand('/incident commander sysadmin');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('User @sysadmin must be part of this channel to make them commander.');
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current commander
                cy.executeSlashCommand('/incident commander @sysadmin');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('User @sysadmin must be part of this channel to make them commander.');
            });
        });

        describe('should show a message when the user is already the commander', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current commander
                cy.executeSlashCommand('/incident commander user-1');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('User @user-1 is already commander of this incident.');
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current commander
                cy.executeSlashCommand('/incident commander @user-1');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('User @user-1 is already commander of this incident.');
            });
        });

        describe('should change the current commander', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);

                // # Ensure the sysadmin is part of the channel.
                cy.executeSlashCommand('/invite sysadmin');
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current commander
                cy.executeSlashCommand('/incident commander sysadmin');

                // # Verify the commander has changed.
                cy.verifyPostedMessage('user-1 changed the incident commander from @user-1 to @sysadmin.');
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current commander
                cy.executeSlashCommand('/incident commander @sysadmin');

                // # Verify the commander has changed.
                cy.verifyPostedMessage('user-1 changed the incident commander from @user-1 to @sysadmin.');
            });
        });

        it('should show an error when specifying more than one username', () => {
            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // # Run a slash command with too many parameters
            cy.executeSlashCommand('/incident commander user-1 sysadmin');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Slash Command Help');
        });
    });
});
