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
            cy.verifyEphemeralMessage('/incident commander expects at most one argument.');
        });
    });

    describe('/incident stage', () => {
        beforeEach(() => {
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

        describe('not in an incident channel', () => {
            beforeEach(() => {
                // # Navigate to a non-incident channel
                cy.visit('/ad-1/channels/town-square');
            });

            it('/incident stage next', () => {
                // # Run a slash command to go to next stage
                cy.executeSlashCommand('/incident stage next');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('You can only change an incident stage from within the incident\'s channel.');
            })

            it('/incident stage prev', () => {
                // # Run a slash command to go to previous stage
                cy.executeSlashCommand('/incident stage prev');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('You can only change an incident stage from within the incident\'s channel.');
            })
        });

        describe('in an incident channel', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);
            });

            describe('/incident stage next', () => {
                describe('in the last stage', () => {
                    beforeEach(() => {
                        // # Check all checkboxes in the stage
                        cy.get('.checklist-inner-container').within(() => {
                            cy.get('.checkbox').each((checkbox) => {
                                cy.wrap(checkbox).click();
                            });
                        });

                        // # Click on the Next Stage button
                        cy.get('#incidentRHSFooter button').click();

                        // * Verify that we're on the last stage
                        cy.get('#incidentRHSStages').within(() => {
                            cy.get('span').contains('(2/2)');
                        });
                    });

                    it('with some tasks unfinished', () => {
                        // # Run a slash command to go to next stage
                        cy.executeSlashCommand('/incident stage next');

                        // * Verify the expected error message.
                        cy.verifyEphemeralMessage('The active stage is the last one. If you want to end the incident, run /incident end');
                    });

                    it('with all tasks finished', () => {
                        // # Check all checkboxes in the stage
                        cy.get('.checklist-inner-container').within(() => {
                            cy.get('.checkbox').each((checkbox) => {
                                cy.wrap(checkbox).click();
                            });
                        });

                        // # Run a slash command to go to next stage
                        cy.executeSlashCommand('/incident stage next');

                        // * Verify the expected error message.
                        cy.verifyEphemeralMessage('The active stage is the last one. If you want to end the incident, run /incident end');
                    });
                });

                it('not in the last stage', () => {
                    it('with some tasks unfinished', () => {
                        // # Run a slash command to go to next stage
                        cy.executeSlashCommand('/incident stage next');

                        // * Verify that the interactive dialog is visible
                        cy.get('#interactiveDialogModalLabel').contains('Not all tasks in this stage are complete.');

                        // # Confirm the dialog
                        cy.get('#interactiveDialogSubmit').click();

                        // * Verify that we're on the second stage
                        cy.get('#incidentRHSStages').within(() => {
                            cy.get('div').contains('Stage 2');
                            cy.get('span').contains('(2/2)');
                        });
                    });

                    it('with all tasks finished', () => {
                        // # Check all checkboxes in the stage
                        cy.get('.checklist-inner-container').within(() => {
                            cy.get('.checkbox').each((checkbox) => {
                                cy.wrap(checkbox).click();
                            });
                        });

                        // # Run a slash command to go to next stage
                        cy.executeSlashCommand('/incident stage next');

                        // * Verify that we're on the second stage
                        cy.get('#incidentRHSStages').within(() => {
                            cy.get('div').contains('Stage 2');
                            cy.get('span').contains('(2/2)');
                        });
                    });
                });
            });

            describe('/incident stage prev', () => {
                describe('in the first stage', () => {
                    it('with some tasks unfinished', () => {
                        // # Run a slash command to go to previous stage
                        cy.executeSlashCommand('/incident stage prev');

                        // * Verify the expected error message.
                        cy.verifyEphemeralMessage('The active stage is the first one.');
                    });

                    it('with all tasks finished', () => {
                        // # Check all checkboxes in the stage
                        cy.get('.checklist-inner-container').within(() => {
                            cy.get('.checkbox').each((checkbox) => {
                                cy.wrap(checkbox).click();
                            });
                        });

                        // # Run a slash command to go to previous stage
                        cy.executeSlashCommand('/incident stage prev');

                        // * Verify the expected error message.
                        cy.verifyEphemeralMessage('The active stage is the first one.');
                    });
                });

                it('not in the first stage', () => {
                    beforeEach(() => {
                        // # Check all checkboxes in the stage
                        cy.get('.checklist-inner-container').within(() => {
                            cy.get('.checkbox').each((checkbox) => {
                                cy.wrap(checkbox).click();
                            });
                        });

                        // # Click on the Next Stage button
                        cy.get('#incidentRHSFooter button').click();

                        // * Verify that we're on the last stage
                        cy.get('#incidentRHSStages').within(() => {
                            cy.get('span').contains('(2/2)');
                        });
                    });

                    it('with some tasks unfinished', () => {
                        // # Run a slash command to go to previous stage
                        cy.executeSlashCommand('/incident stage prev');

                        // * Verify that we're on the first stage
                        cy.get('#incidentRHSStages').within(() => {
                            cy.get('div').contains('Stage 1');
                            cy.get('span').contains('(1/2)');
                        });
                    });

                    it('with all tasks finished', () => {
                        // # Check all checkboxes in the stage
                        cy.get('.checklist-inner-container').within(() => {
                            cy.get('.checkbox').each((checkbox) => {
                                cy.wrap(checkbox).click();
                            });
                        });

                        // # Run a slash command to go to previous stage
                        cy.executeSlashCommand('/incident stag prev');

                        // * Verify that we're on the first stage
                        cy.get('#incidentRHSStages').within(() => {
                            cy.get('div').contains('Stage 1');
                            cy.get('span').contains('(1/2)');
                        });
                    });
                });
            });
        });
    });

    describe('/incident info', () => {
        it('should show an error when not in an incident channel', () => {
            // # Navigate to a non-incident channel.
            cy.visit('/ad-1/channels/town-square');

            // # Run a slash command to show the incident's info.
            cy.executeSlashCommand('/incident info');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('You can only show the details of an incident from within the incident\'s channel.');
        });

        it('should open the RHS when it is not open', () => {
            // # Navigate directly to the application and the incident channel.
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // # Close the RHS, which is opened by default when navigating to an incident channel.
            cy.get('#searchResultsCloseButton').click();

            // * Verify that the RHS is indeed closed.
            cy.get('#rhsContainer').should('not.exist');

            // # Run a slash command to show the incident's info.
            cy.executeSlashCommand('/incident info');

            // * Verify that the RHS is now open.
            cy.get('#rhsContainer').should('be.visible');
        });

        it('should show an ephemeral post when the RHS is already open', () => {
            // # Navigate directly to the application and the incident channel.
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify that the RHS is open.
            cy.get('#rhsContainer').should('be.visible');

            // # Run a slash command to show the incident's info.
            cy.executeSlashCommand('/incident info');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Your incident details are already open in the right hand side of the channel.');
        });
    })
});
