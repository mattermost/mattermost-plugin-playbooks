// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('channels > general actions', () => {
    let testTeam;
    let testSysadmin;
    let testUser;
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
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
        cy.wait(1000);

        // * Verify the welcome message is shown
        cy.verifyEphemeralMessage('test ephemeral welcome message');
    });

    it('action settings are disabled for non-admin user', () => {
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
