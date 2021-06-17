// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident rhs > latest update', () => {
    const defaultReminderMessage = '# Default reminder message';
    let testTeam;
    let teamId;
    let userId;
    let playbookId;
    let testIncident;
    let incidentName;
    let incidentChannelName;
    let testChannel;
    let testUser;
    let testUser2;
    let dmChannel;
    let privateChannel;

    before(() => {
        // # Create test team and test user
        cy.apiInitSetup({createIncident: true}).then(({team, channel, user, playbook, incident}) => {
            testTeam = team;
            teamId = team.id;
            testUser = user;
            userId = user.id;
            playbookId = playbook.id;
            testChannel = channel;
            testIncident = incident;
            incidentName = incident.name;
            incidentChannelName = incidentName.toLowerCase();

            cy.apiCreateChannel(team.id, 'private-1', 'Private Channel 1', 'P').then(({channel: prvChnl}) =>  {
                privateChannel = prvChnl;
                cy.apiAddUserToChannel(privateChannel.id, userId);
            });

            cy.apiAdminLogin().then(() => {
                cy.apiCreateUser({prefix: 'other'}).then(({user: user2}) => {
                    testUser2 = user2;
                    cy.apiAddUserToTeam(team.id, user2.id);

                    cy.apiCreateDirectChannel([testUser.id, testUser2.id]).then(({channel: dmChnl}) => {
                        dmChannel = dmChnl;
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin(testUser);

        // # Navigate directly to the application and the incident channel
        cy.visit(`/${testTeam.name}/channels/` + testIncident.name);
    });

    describe('status update interactive dialog', () => {
        it('shows the broadcast channel when it is public', () => {
            // # Run the /incident status slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                cy.get('#interactiveDialogModalIntroductionText')
                    .contains('Update your incident status.');
            });
        });

        it.only('shows a generic message when the broadcast channel is private', () => {
            // # Visit the selected playbook
            cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // # Open the broadcast channel widget and select a private channel
            cy.get('#playbook-preferences-broadcast-channel').click().type(`${privateChannel.display_name}{enter}`, {delay: 200});

            // # Save the playbook
            cy.findByTestId('save_playbook').click();

            // # Visit incident channel
            cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);

            // # Run the /incident status slash command.
            cy.executeSlashCommand('/incident update');

            // * Verify that the interactive dialog contains a generic message
            cy.get('#interactiveDialogModal').within(() => {
                cy.get('#interactiveDialogModalIntroductionText')
                    .contains('Update your incident status.');
            });
        });

        it('shows a generic message when the broadcast channel is a direct message', () => {
            // # Visit the selected playbook
            cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // # Open the broadcast channel widget and select a DM channel
            cy.get('#playbook-preferences-broadcast-channel').click().type(`${dmChannel.display_name}{enter}`, {delay: 200});

            // # Save the playbook
            cy.findByTestId('save_playbook').click();

            // # Visit incident channel
            cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);

            // # Run the /incident status slash command.
            cy.executeSlashCommand('/incident update');

            // * Verify that the interactive dialog contains a generic message
            cy.get('#interactiveDialogModal').within(() => {
                cy.get('#interactiveDialogModalIntroductionText')
                    .contains('Update your incident status.');
            });
        });

        it('shows a generic message when the broadcast channel is a group channel', () => {
            // # Create a GM
            cy.apiGetUsers(['user-1', 'douglas.daniels', 'christina.wilson']).then((res) => {
                const userIds = res.body.map((user) => user.id);
                cy.apiCreateGroup(userIds).then((resp) => {
                    // # Create a playbook with a private broadcast channel configured
                    cy.apiCreateTestPlaybook({
                        teamId,
                        title: playbookName,
                        userId,
                        broadcastChannelId: resp.body.id,
                    }).then((playbook) => {
                        // # Create a new incident
                        const now = Date.now();
                        const name = 'Incident (' + now + ')';
                        const incidentChannelName = 'incident-' + now;
                        cy.apiStartIncident({
                            teamId,
                            playbookId: playbook.id,
                            incidentName: name,
                            commanderUserId: userId,
                        });

                        // # Navigate to the incident channel
                        cy.visit('/ad-1/channels/' + incidentChannelName);

                        // # Run the /incident status slash command.
                        cy.executeSlashCommand('/incident update');

                        // * Verify that the interactive dialog contains a generic message
                        cy.get('#interactiveDialogModal').within(() => {
                            cy.get('#interactiveDialogModalIntroductionText')
                                .contains('Update your incident status. This post will be broadcasted to a private channel.');
                        });
                    });
                });
            });
        });

        it('does not show anything when there is not a broadcast channel', () => {
            // # Create a playbook with no broadcast channel configured
            cy.apiCreateTestPlaybook({
                teamId,
                title: playbookName,
                userId,
            }).then((playbook) => {
                // # Create a new incident
                const now = Date.now();
                const name = 'Incident (' + now + ')';
                const incidentChannelName = 'incident-' + now;
                cy.apiStartIncident({
                    teamId,
                    playbookId: playbook.id,
                    incidentName: name,
                    commanderUserId: userId,
                });

                // # Navigate to the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);

                // # Run the /incident status slash command.
                cy.executeSlashCommand('/incident update');

                // # Get the interactive dialog modal.
                cy.get('#interactiveDialogModal').within(() => {
                    cy.get('#interactiveDialogModalIntroductionText')
                        .contains('Update your incident status.');
                    cy.get('#interactiveDialogModalIntroductionText')
                        .should('not.contain', 'This post will be broadcasted');
                });
            });
        });

        it('shows an error when entering an update message with whitespace', () => {
            // # Run the /incident status slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                // # Type the invalid data
                cy.findByTestId('messageinput').clear().type(' {enter} {enter}  ');

                // # Enter valid status and description
                cy.findAllByTestId('autoCompleteSelector').eq(0).within(() => {
                    cy.get('input').type('Reported', {delay: 200}).type('{enter}');
                });
                cy.findByTestId('descriptioninput').clear().type('description');

                // # Submit the dialog.
                cy.get('#interactiveDialogSubmit').click();

                // * Verify the error is provided.
                cy.findByTestId('messagehelp-text').should('exist')
                    .contains('This field is required.');

                // # Enter valid data
                cy.findByTestId('messageinput').type('valid update');

                // # Submit the dialog.
                cy.get('#interactiveDialogSubmit').click();
            });

            // * Verify that the interactive dialog has gone.
            cy.get('#interactiveDialogModal').should('not.exist');
        });
    });

    describe('shows the last update in update message', () => {
        it('shows the default when we have not made an update before', () => {
            // # Run the /incident status slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                // * Verify the first message is there.
                cy.findByTestId('messageinput').within(() => {
                    cy.findByText(defaultReminderMessage).should('exist');
                });
            });
        });
        it('when we have made a previous update', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage);

            // # Run the /incident status slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                // * Verify the first message is there.
                cy.findByTestId('messageinput').within(() => {
                    cy.findByText(firstMessage).should('exist');
                });
            });
        });
    });

    describe('the default reminder', () => {
        it('shows the configured default when we have not made a previous update', () => {
            // # Run the /incident update slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                // * Verify the default is as expected
                cy.findAllByTestId('autoCompleteSelector').eq(1).within(() => {
                    cy.get('input').should('have.value', '60min');
                });
            });
        });

        it('shows the last reminder we typed in: None', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, 'none');

            // # Run the /incident update slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                // * Verify the default is as expected
                cy.findAllByTestId('autoCompleteSelector').eq(1).within(() => {
                    cy.get('input').should('have.value', 'None');
                });
            });
        });

        it('shows the last reminder we typed in: 15min', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '15');

            // # Run the /incident update slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                // * Verify the default is as expected
                cy.findAllByTestId('autoCompleteSelector').eq(1).within(() => {
                    cy.get('input').should('have.value', '15min');
                });
            });
        });

        it('shows the last reminder we typed in: 30min', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '30');

            // # Run the /incident update slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                // * Verify the default is as expected
                cy.findAllByTestId('autoCompleteSelector').eq(1).within(() => {
                    cy.get('input').should('have.value', '30min');
                });
            });
        });

        it('shows the last reminder we typed in: 60min', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '60');

            // # Run the /incident update slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                // * Verify the default is as expected
                cy.findAllByTestId('autoCompleteSelector').eq(1).within(() => {
                    cy.get('input').should('have.value', '60min');
                });
            });
        });

        it('shows the last reminder we typed in: 4hr', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '4');

            // # Run the /incident update slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                // * Verify the default is as expected
                cy.findAllByTestId('autoCompleteSelector').eq(1).within(() => {
                    cy.get('input').should('have.value', '4hr');
                });
            });
        });

        it('shows the last reminder we typed in: 24hr', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '24');

            // # Run the /incident update slash command.
            cy.executeSlashCommand('/incident update');

            // # Get the interactive dialog modal.
            cy.get('#interactiveDialogModal').within(() => {
                // * Verify the default is as expected
                cy.findAllByTestId('autoCompleteSelector').eq(1).within(() => {
                    cy.get('input').should('have.value', '24hr');
                });
            });
        });
    });

    describe('shows the latest update', () => {
        describe('in a channel we are currently viewing', () => {
            it('when there is only one', () => {
                const now = Date.now();
                const updateMessage = 'Update - ' + now;

                // # Create a status update
                cy.updateStatus(updateMessage);

                // * Verify that the RHS shows the status update
                cy.get('div[class^=UpdateSection-]').within(() => {
                    cy.findByText(updateMessage).should('exist');
                });
            });

            it('when there are more than one', () => {
                const now = Date.now();
                const firstMessage = 'Update - ' + now;

                // # Create a first status update
                cy.updateStatus(firstMessage);

                const secondMessage = firstMessage + ' - second';

                // # Create a second status update
                cy.updateStatus(secondMessage);

                // * Verify that the RHS shows the second status update
                cy.get('div[class^=UpdateSection-]').within(() => {
                    cy.findByText(secondMessage).should('exist');
                });
            });

            it('when the last one was deleted', () => {
                const now = Date.now();
                const firstMessage = 'Update - ' + now;

                // # Create a first status update
                cy.updateStatus(firstMessage);

                const secondMessage = firstMessage + ' - second';

                // # Create a second status update
                cy.updateStatus(secondMessage).then((postId) => {
                    // # Verify that the RHS shows the second status update
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(secondMessage).should('exist');
                    });

                    // # Delete the second status update
                    cy.deletePost(postId);
                });

                // # Verify that the RHS shows the first status update
                cy.get('div[class^=UpdateSection-]').within(() => {
                    cy.findByText(firstMessage).should('exist');
                });
            });

            it('when the last one was edited', () => {
                const now = Date.now();
                const updateMessage = 'Update - ' + now;

                // # Create a status update
                cy.updateStatus(updateMessage).then((postId) => {
                    const newMessage = updateMessage + ' - edited';

                    // # Edit the status update
                    cy.editPost(postId, newMessage);

                    // * Verify that the RHS shows the new text
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(newMessage).should('exist');
                    });
                });
            });

            it('when it\'s not in the redux store', () => {
                const now = Date.now();
                const updateMessage = 'Update - ' + now;

                // # Create a status update
                cy.updateStatus(updateMessage);

                // * Verify that the RHS shows the status update
                cy.get('div[class^=UpdateSection-]').within(() => {
                    cy.findByText(updateMessage).should('exist');
                });

                // # Write 50 posts to make sure the latest update is not loaded after a refresh
                for (let i = 0; i < 50; i++) {
                    cy.apiCreatePost(incidentChannelId, 'Dummy message #' + i, '', {});
                }

                // # Reload the page so the redux store is cleared
                cy.reload();

                // * Verify that there is no post loaded with the status update
                cy.get('#postListContent').within(() => {
                    cy.findByText(updateMessage).should('not.exist');
                });

                // * Verify that the RHS still shows the status update
                cy.get('div[class^=UpdateSection-]').within(() => {
                    cy.findByText(updateMessage).should('exist');
                });
            });
        });

        describe('in a channel we are not currently viewing', () => {
            it('when the last one was deleted', () => {
                const now = Date.now();
                const firstMessage = 'Update - ' + now;

                // # Create a first status update
                cy.updateStatus(firstMessage);

                const secondMessage = firstMessage + ' - second';

                // # Create a second status update
                cy.updateStatus(secondMessage).then((postId) => {
                    // # Verify that the RHS shows the second status update
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(secondMessage).should('exist');
                    });

                    // # Navigate to other channel
                    cy.uiSwitchChannel('Town Square');

                    // # Delete the second status update via API
                    cy.apiDeletePost(postId).then(() => {
                        // # Get back to the original channel
                        cy.uiSwitchChannel(incidentName);
                    });

                    // # Verify that the RHS shows the first status update
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(firstMessage).should('exist');
                    });
                });
            });

            it('when the last one was edited', () => {
                const now = Date.now();
                const updateMessage = 'Update - ' + now;

                // # Create a status update
                cy.updateStatus(updateMessage).then((postId) => {
                    const newMessage = updateMessage + ' - edited';

                    // # Navigate to other channel
                    cy.uiSwitchChannel('Town Square');

                    // # Edit the status update via API
                    cy.apiEditPost(postId, newMessage).then(() => {
                        // # Get back to the original channel
                        cy.uiSwitchChannel(incidentName);
                    });

                    // * Verify that the RHS shows the new text
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(newMessage).should('exist');
                    });
                });
            });
        });
    });

    describe('shows no updates', () => {
        describe('in a channel we are  currently viewing', () => {
            it('in a brand new incident', () => {
                // * Verify that the RHS shows that there are no updates.
                cy.get('#incidentRHSUpdates')
                    .contains('No recent updates. Click here to update status.');
            });

            it('when the only update is deleted', () => {
                const now = Date.now();
                const updateMessage = 'Update - ' + now;

                // # Create a status update
                cy.updateStatus(updateMessage).then((postId) => {
                    // * Verify that the RHS shows the status update
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(updateMessage).should('exist');
                    });

                    // # Delete the status update
                    cy.deletePost(postId);

                    // * Verify that the RHS shows that there are no updates.
                    cy.get('#incidentRHSUpdates')
                        .contains('No recent updates. Click here to update status.');
                });
            });

            it('when all updates are deleted', () => {
                const now = Date.now();
                const firstMessage = 'Update - ' + now;

                // # Create a first status update.
                cy.updateStatus(firstMessage).then((firstId) => {
                    // * Verify that the RHS shows the first status update.
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(firstMessage).should('exist');
                    });

                    const secondMessage = firstMessage + ' - second';

                    // # Create a second status update.
                    cy.updateStatus(secondMessage).then((secondId) => {
                        // * Verify that the RHS shows the second status update.
                        cy.get('div[class^=UpdateSection-]').within(() => {
                            cy.findByText(secondMessage).should('exist');
                        });

                        // # Delete the second status update.
                        cy.deletePost(secondId);

                        // * Verify that the RHS shows the first status update.
                        cy.get('div[class^=UpdateSection-]').within(() => {
                            cy.findByText(firstMessage).should('exist');
                        });

                        // # Delete the first status update.
                        cy.deletePost(firstId);

                        // * Verify that the RHS shows that there are no updates.
                        cy.get('#incidentRHSUpdates')
                            .contains('No recent updates. Click here to update status.');
                    });
                });
            });
        });

        describe('in a channel we are not currently viewing', () => {
            it('when the only update is deleted', () => {
                const now = Date.now();
                const updateMessage = 'Update - ' + now;

                // # Create a status update
                cy.updateStatus(updateMessage).then((postId) => {
                    // * Verify that the RHS shows the status update
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(updateMessage).should('exist');
                    });

                    // # Navigate to other channel
                    cy.uiSwitchChannel('Town Square');

                    // # Delete the status update through the API
                    cy.apiDeletePost(postId).then(() => {
                        // # Get back to the incident channel
                        cy.uiSwitchChannel(incidentName);
                    });

                    // * Verify that the RHS shows that there are no updates.
                    cy.get('#incidentRHSUpdates')
                        .contains('No recent updates. Click here to update status.');
                });
            });

            it('when all updates are deleted in a channel', () => {
                const now = Date.now();
                const firstMessage = 'Update - ' + now;

                // # Create a first status update.
                cy.updateStatus(firstMessage).then((firstId) => {
                    // * Verify that the RHS shows the first status update.
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(firstMessage).should('exist');
                    });

                    const secondMessage = firstMessage + ' - second';

                    // # Create a second status update.
                    cy.updateStatus(secondMessage).then((secondId) => {
                        // * Verify that the RHS shows the second status update.
                        cy.get('div[class^=UpdateSection-]').within(() => {
                            cy.findByText(secondMessage).should('exist');
                        });

                        // # Navigate to other channel
                        cy.uiSwitchChannel('Town Square');

                        // # Delete the second status update.
                        cy.apiDeletePost(secondId).then(() => {
                            // # Delete the first status update.
                            cy.apiDeletePost(firstId).then(() => {
                                // # Get back to the incident channel
                                cy.uiSwitchChannel(incidentName);
                            });
                        });

                        // * Verify that the RHS shows that there are no updates.
                        cy.get('#incidentRHSUpdates')
                            .contains('No recent updates. Click here to update status.');
                    });
                });
            });
        });
    });
});
