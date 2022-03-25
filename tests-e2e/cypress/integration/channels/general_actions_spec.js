// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************
import * as TIMEOUTS from '../../fixtures/timeouts';

describe('channels > general actions', () => {
    let testTeam;
    let testSysadmin;
    let testUser;
    let testChannel;

    beforeEach(() => {
        cy.apiInitSetup({promoteNewUserAsAdmin: true}).then(({team, user}) => {
            testTeam = team;
            testSysadmin = user;

            cy.apiCreateUser().then((resp) => {
                testUser = resp.user;
                cy.apiAddUserToTeam(team.id, resp.user.id);
            });

            cy.apiCreateChannel(
                testTeam.id,
                'action-channel',
                'Action Channel',
                'O'
            ).then(({channel}) => {
                testChannel = channel;
            });
        });
    });

    afterEach(() => {
        // # Ensure apiInitSetup() can run again
        cy.apiLogin(testSysadmin);
    });

    describe('on join trigger', () => {
        it('channel categorization can be enabled and works', () => {
            // # Go to the test channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Open Channel Header and the Channel Actions modal
            cy.get('#channelHeaderTitle').click();
            cy.findByText('Channel Actions').click();

            // # Enable the categorization action and set the name
            cy.contains('sidebar category').click();
            cy.contains('Enter category name').click().type('example category{enter}');

            // # Save action
            cy.findByRole('button', {name: /save/i}).click();

            // # Switch to another user and reload
            // # This drops them into the same channel
            cy.apiLogin(testUser);
            cy.reload();
            cy.wait(TIMEOUTS.TEN_SEC);

            // * Verify the channel category + channel exists
            cy.contains('.SidebarChannelGroup', 'example category', {matchCase: false})
                .should('exist')
                .within(() => {
                    cy.contains(testChannel.display_name).should('exist');
                });
        });

        it('welcome message can be enabled and is shown to a joining user', () => {
            // # Go to the test channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Open Channel Header and the Channel Actions modal
            cy.get('#channelHeaderTitle').click();
            cy.findByText('Channel Actions').click();

            // # Toggle on and set the welcome message
            cy.contains('temporary welcome message').click();
            cy.findByTestId('channel-actions-modal_welcome-msg')
                .type('test ephemeral welcome message');

            // # Save action
            cy.findByRole('button', {name: /save/i}).click();

            // # Switch to another user and reload
            // # This drops them into the same channel
            cy.apiLogin(testUser);
            cy.reload();
            cy.wait(TIMEOUTS.FIVE_SEC);

            // * Verify the welcome message is shown
            cy.verifyEphemeralMessage('test ephemeral welcome message');
        });
    });

    describe('keyword trigger', () => {
        it('prompt to run playbook can be enabled and works', () => {
            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
                retrospectiveTemplate: 'Retro template text',
                retrospectiveReminderIntervalSeconds: 60 * 60 * 24 * 7 // 7 days
            });

            // # Use the basic user to create their own channel,
            // # so they only see one playbook in the list
            cy.apiLogin(testUser);
            cy.apiCreateChannel(
                testTeam.id,
                'action-channel',
                'Action Channel',
                'O'
            ).then(({channel}) => {
                // # Go to the test channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // # Open Channel Header and the Channel Actions modal
                cy.get('#channelHeaderTitle').click();
                cy.findByText('Channel Actions').click();

                // # Set a keyword, enable the playbook trigger,
                // # and select the Playbook to run
                cy.contains('Add keywords').click().type('red alert{enter}');
                cy.contains('Prompt to run a playbook').click();
                cy.contains('Select a playbook').click();
                cy.findByText('Public Playbook').click();

                // # Save action
                cy.findByRole('button', {name: /save/i}).click();

                // # Post the trigger phrase
                cy.uiPostMessageQuickly('error detected red alert!');

                // * Verify that the bot posts the expected prompt
                // # Open the playbook run modal
                cy.getLastPostId().then((postId) => {
                    cy.get(`#post_${postId}`).within(() => {
                        cy.contains('trigger for the Public Playbook').should('exist');
                        cy.contains('Yes, run playbook').should('exist').click();
                    });
                });

                // # Enter a name and start the run
                cy.findByTestId('playbookRunNameinput').type('run from trigger');
                cy.findByRole('button', {name: /start run/i}).click();

                // * Verify text from the run channel description
                cy.contains('start of the run').should('exist');
            });
        });
    });

    it('action settings are disabled for non-channel admin', () => {
        // # Login as non-channel admin
        cy.apiLogin(testUser);

        // # Go to the test channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open Channel Header and the Channel Actions modal
        cy.get('#channelHeaderTitle').click();
        cy.findByText('Channel Actions').click();

        // * Verify the toggles are disabled
        cy.findByRole('dialog', {name: /channel actions/i}).within(() => {
            cy.get('input').should('be.disabled');
        });
    });
});
