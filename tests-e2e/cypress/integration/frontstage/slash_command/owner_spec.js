// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('slash command > owner', () => {
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

                cy.apiCreatePlaybook({
                    teamId: team.id,
                    title: playbookName,
                    checklists: [
                        {
                            title: 'Stage 1',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                        {
                            title: 'Stage 2',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                    ],
                    memberIDs: [user.id],
                }).then((playbook) => {
                    playbookId = playbook.id;

                    const now = Date.now();
                    incidentName = 'Incident (' + now + ')';
                    incidentChannelName = 'incident-' + now;
                    cy.apiStartIncident({
                        teamId,
                        playbookId,
                        incidentName,
                        ownerUserId: userId,
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

        // # Reset the owner to test-1 as necessary.
        cy.apiChangeIncidentOwner(incidentId, userId);
    });

    describe('/incident owner', () => {
        it('should show an error when not in an incident channel', () => {
            // # Navigate to a non-incident channel
            cy.visit('/ad-1/channels/town-square');

            // # Run a slash command to show the current owner
            cy.executeSlashCommand('/incident owner');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('You can only see the owner from within the incident\'s channel.');
        });

        it('should show the current owner', () => {
            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // # Run a slash command to show the current owner
            cy.executeSlashCommand('/incident owner');

            // * Verify the expected owner.
            cy.verifyEphemeralMessage('@user-1 is the current owner for this incident.');
        });
    });

    describe('/incident owner @username', () => {
        it('should show an error when not in an incident channel', () => {
            // # Navigate to a non-incident channel
            cy.visit('/ad-1/channels/town-square');

            // # Run a slash command to change the current owner
            cy.executeSlashCommand('/incident owner user-2');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('You can only change the owner from within the incident\'s channel.');
        });

        describe('should show an error when the user is not found', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.executeSlashCommand('/incident owner unknown');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('Unable to find user @unknown');
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.executeSlashCommand('/incident owner @unknown');

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
                // # Run a slash command to change the current owner
                cy.executeSlashCommand('/incident owner sysadmin');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('User @sysadmin must be part of this channel to make them owner.');
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.executeSlashCommand('/incident owner @sysadmin');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('User @sysadmin must be part of this channel to make them owner.');
            });
        });

        describe('should show a message when the user is already the owner', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.executeSlashCommand('/incident owner user-1');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('User @user-1 is already owner of this incident.');
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.executeSlashCommand('/incident owner @user-1');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('User @user-1 is already owner of this incident.');
            });
        });

        describe('should change the current owner', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);

                // # Ensure the sysadmin is part of the channel.
                cy.executeSlashCommand('/invite sysadmin');
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.executeSlashCommand('/incident owner sysadmin');

                // # Verify the owner has changed.
                cy.verifyPostedMessage('user-1 changed the incident owner from @user-1 to @sysadmin.');
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.executeSlashCommand('/incident owner @sysadmin');

                // # Verify the owner has changed.
                cy.verifyPostedMessage('user-1 changed the incident owner from @user-1 to @sysadmin.');
            });
        });

        it('should show an error when specifying more than one username', () => {
            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // # Run a slash command with too many parameters
            cy.executeSlashCommand('/incident owner user-1 sysadmin');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('/incident owner expects at most one argument.');
        });
    });
});
