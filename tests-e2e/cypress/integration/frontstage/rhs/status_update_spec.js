// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import users from '../../../fixtures/users.json';

describe('playbook run rhs > latest update', () => {
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

            // # Turn off growth onboarding screens
            cy.apiUpdateConfig({
                ServiceSettings: {EnableOnboardingFlow: false},
            });

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
            cy.apiLogin(users.sysadmin).then(({user: sysadmin}) => {
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
                    cy.get('[class$=singleValue]').should('have.text', 'in 1 hour 30 minutes');
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
});
