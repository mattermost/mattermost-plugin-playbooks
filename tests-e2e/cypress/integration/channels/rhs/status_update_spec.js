// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('channels > rhs > status update', () => {
    const defaultReminderMessage = '# Default reminder message';
    let testTeam;
    let testChannel;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser,
                broadcastChannelId: testChannel.id,
                reminderTimerDefaultSeconds: 3600,
                reminderMessageTemplate: defaultReminderMessage,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

        // # Create a new playbook run
        const now = Date.now();
        const name = 'Playbook Run (' + now + ')';
        const channelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: name,
            ownerUserId: testUser.id,
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${channelName}`);
    });

    describe('post update dialog', () => {
        it('prevents posting an update message with only whitespace', () => {
            // # Run the `/playbook update` slash command.
            cy.executeSlashCommand('/playbook update');

            // # Get dialog modal.
            cy.get('.GenericModal').within(() => {
                // # Type the invalid data
                cy.findByTestId('update_run_status_textbox').clear().type(' {enter} {enter}  ');

                // * Verify submit is disabled.
                cy.get('button.confirm').should('be.disabled');

                // # Enter valid data
                cy.findByTestId('update_run_status_textbox').type('valid update');

                // # Submit the dialog.
                cy.get('button.confirm').click();
            });

            // * Verify that the Post update dialog has gone.
            cy.get('.GenericModal').should('not.exist');
        });

        it('lets users with no access to the playbook post an update', () => {
            let channelName;
            const updateMessage = 'status update ' + Date.now();

            // # Login as sysadmin and create a private playbook and a run
            cy.apiAdminLogin().then(({user: sysadmin}) => {
                // # Create a private playbook
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Playbook - Private',
                    memberIDs: [sysadmin.id], // Make it accesible only to sysadmin
                    inviteUsersEnabled: true,
                    invitedUserIds: [testUser.id], // Invite the test user
                }).then((playbook) => {
                    // # Create a new playbook run
                    const now = Date.now();
                    const name = 'Playbook Run (' + now + ')';
                    channelName = 'playbook-run-' + now;
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: name,
                        ownerUserId: sysadmin.id,
                    });
                });
            }).then(() => {
                // # Login as the test user
                cy.apiLogin(testUser);

                // # Navigate directly to the application and the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${channelName}`);

                // # Run the `/playbook update` slash command.
                cy.executeSlashCommand('/playbook update');

                // # Get dialog modal.
                cy.get('.GenericModal').within(() => {
                    // # Enter valid data
                    cy.findByTestId('update_run_status_textbox').type(updateMessage);

                    // # Submit the dialog.
                    cy.get('button.confirm').click();
                });

                // * Verify that the Post update dialog has gone.
                cy.get('.GenericModal').should('not.exist');

                // * Verify that the status update was posted.
                cy.getLastPost().within(() => {
                    cy.findByText(updateMessage).should('exist');
                });
            });
        });

        it('confirms finishing the run, and remembers changes and reminder when canceled', () => {
            const updateMessage = 'This is the update text to test with.';
            const reminderTime = 'in 24 hours';

            // # Run the `/playbook update` slash command.
            cy.executeSlashCommand('/playbook update');

            // # Get the dialog modal.
            cy.get('.GenericModal').within(() => {
                // * Verify the first message is there.
                cy.findByTestId('update_run_status_textbox').within(() => {
                    cy.findByText(defaultReminderMessage).should('exist');
                });

                // # Type text to test for later
                cy.findByTestId('update_run_status_textbox').clear().type(updateMessage);

                // # Set a new reminder to test for later
                cy.openReminderSelector();
                cy.selectReminderTime(reminderTime);

                // # Mark the run as finished
                cy.findByTestId('mark-run-as-finished').click({force: true});

                // # Submit the dialog.
                cy.get('button.confirm').click();
            });

            // * Confirmation should appear
            cy.get('.modal-header').should('be.visible').contains('Confirm finish run');

            // # Cancel
            cy.get('#cancelModalButton').click({force: true});

            // * Verify post update has the same information
            cy.get('.GenericModal').within(() => {
                // * Verify the message was remembered
                cy.findByTestId('update_run_status_textbox').within(() => {
                    cy.findByText(updateMessage).should('exist');
                });

                // * Verify the reminder was remembered
                cy.get('#reminder_timer_datetime').contains(reminderTime);

                // * Marked run is still checked
                cy.findByTestId('mark-run-as-finished').within(() => {
                    cy.get('[type="checkbox"]').should('be.checked');
                });

                // # Submit the dialog.
                cy.get('button.confirm').click();
            });

            // * Confirmation should appear
            cy.get('.modal-header').should('be.visible').contains('Confirm finish run');

            // # Submit
            cy.get('#confirmModalButton').click({force: true});

            // * Verify the status update was posted.
            cy.uiGetNthPost(-3).within(() => {
                cy.findByText(updateMessage).should('exist');
            });

            // * Verify the run was finished.
            cy.uiGetNthPost(-2).within(() => {
                cy.findByText('marked this run as finished.').should('exist');
            });
        });
    });

    describe('shows the last update in update message', () => {
        it('shows the default when we have not made an update before', () => {
            // # Run the `/playbook update` slash command.
            cy.executeSlashCommand('/playbook update');

            // # Get the dialog modal.
            cy.get('.GenericModal').within(() => {
                // * Verify the first message is there.
                cy.findByTestId('update_run_status_textbox').within(() => {
                    cy.findByText(defaultReminderMessage).should('exist');
                });
            });
        });

        it('when we have made a previous update', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage);

            // # Run the `/playbook update` slash command.
            cy.executeSlashCommand('/playbook update');

            // # Get the dialog modal.
            cy.get('.GenericModal').within(() => {
                // * Verify the first message is there.
                cy.findByTestId('update_run_status_textbox').within(() => {
                    cy.findByText(firstMessage).should('exist');
                });
            });
        });
    });

    describe('the default reminder', () => {
        it('shows the configured default when we have not made a previous update', () => {
            // # Run the `/playbook update` slash command.
            cy.executeSlashCommand('/playbook update');

            // # Get the dialog modal.
            cy.get('.GenericModal').within(() => {
                // * Verify the default is as expected
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('[class$=singleValue]').should('have.text', 'in 60 minutes');
                });
            });
        });

        it('shows the last reminder we typed in: 15 minutes', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '15 minutes');

            // # Run the `/playbook update` slash command.
            cy.executeSlashCommand('/playbook update');

            // # Get the dialog modal.
            cy.get('.GenericModal').within(() => {
                // * Verify the default is as expected
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('[class$=singleValue]').should('have.text', 'in 15 minutes');
                });
            });
        });

        it('shows the last reminder we typed in: 90 minutes', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '90 minutes');

            // # Run the `/playbook update` slash command.
            cy.executeSlashCommand('/playbook update');

            // # Get the dialog modal.
            cy.get('.GenericModal').within(() => {
                // * Verify the default is as expected
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('[class$=singleValue]').should('have.text', 'in 1 hour, 30 minutes');
                });
            });
        });

        it('shows the last reminder we typed in: 7 days', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '7 days');

            // # Run the `/playbook update` slash command.
            cy.executeSlashCommand('/playbook update');

            // # Get the dialog modal.
            cy.get('.GenericModal').within(() => {
                // * Verify the default is as expected
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('[class$=singleValue]').should('have.text', 'in 7 days');
                });
            });
        });
    });

    describe('playbook with disabled status updates', () => {
        before(() => {
            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser,
                broadcastChannelId: testChannel.id,
                statusUpdateEnabled: false,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });

        describe('omit status update dialog when status updates are disabled', () => {
            it('shows the default when we have not made an update before', () => {
                // * Check if RHS section is loaded
                cy.get('#rhs-about').should('exist');

                // * Check if Post Update section is omitted
                cy.get('#rhs-post-update').should('not.exist');
            });
        });
    });
});
