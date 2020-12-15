// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('backstage playbook details', () => {
    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin('user-1');
    });

    it('redirects to not found error if the playbook is unknown', () => {
        // # Visit the URL of a non-existing playbook
        cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/an_unknown_id');

        // * Verify that the user has been redirected to the playbooks not found error page
        cy.url().should('include', '/ad-1/com.mattermost.plugin-incident-management/error?type=playbooks');
    });

    describe('slash command', () => {
        it('autocompletes after clicking Add a Slash Command', () => {
            // # Visit the playbook backstage
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks');

            // # Start a blank playbook
            cy.get('#root').findByText('Blank Playbook').click();

            // # Add a slash command to a step
            cy.get('#root').findByText('Add a Slash Command').click();

            // * Verify the slash command input field now has focus
            cy.get('#root').findByPlaceholderText('Slash Command').should('have.focus');

            // * Verify the slash command input field is pre-populated with a leading slash
            cy.get('#root').findByPlaceholderText('Slash Command').should('have.value', '/');

            // * Verify the autocomplete prompt is open
            cy.get('#suggestionList').should('exist');
        });

        it('removes the input prompt when blurring with an empty slash command', () => {
            // # Visit the playbook backstage
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks');

            // # Start a blank playbook
            cy.get('#root').findByText('Blank Playbook').click();

            // # Add a slash command to a step
            cy.get('#root').findByText('Add a Slash Command').click();

            // * Verify only the leading slash is in the input field.
            cy.get('#root').findByPlaceholderText('Slash Command').should('have.value', '/');

            // # Backspace even the slash in the input.
            cy.get('#root').findByPlaceholderText('Slash Command').type('{backspace}');

            // # Blur the slash command input field
            cy.get('#root').findByPlaceholderText('Slash Command').blur();

            // # Verify the Add a Slash Command button returns
            cy.get('#root').findByText('Add a Slash Command').should('exist');
        });

        it('removes the input prompt when blurring with an invalid slash command', () => {
            // # Visit the playbook backstage
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks');

            // # Start a blank playbook
            cy.get('#root').findByText('Blank Playbook').click();

            // # Add a slash command to a step
            cy.get('#root').findByText('Add a Slash Command').click();

            // * Verify only the leading slash is in the input field.
            cy.get('#root').findByPlaceholderText('Slash Command').should('have.value', '/');

            // # Blur the slash command without having typed anything more
            cy.get('#root').findByPlaceholderText('Slash Command').blur();

            // * Verify the Add a Slash Command button returns
            cy.get('#root').findByText('Add a Slash Command').should('exist');
        });
    });

    describe('preferences', () => {
        const playbookName = 'Playbook (' + Date.now() + ')';
        let teamId;
        let playbookId;
        let privateChannelId;
        let privateChannelName;

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
                    }).then((playbook) => {
                        playbookId = playbook.id;
                    });

                    cy.verifyPlaybookCreated(team.id, playbookName);
                });

                // # Create a private channel
                cy.apiCreateChannel(teamId, 'private-channel', 'Private Channel', 'P').then(({channel}) => {
                    privateChannelId = channel.id;
                    privateChannelName = channel.name;
                });
            });
        });

        it('shows "Select a channel" when no broadcast channel configured', () => {
            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // * Verify placeholder text is present
            cy.findByTestId('playbook-preferences-broadcast-channel').should('have.text', 'Select a channel');
        });

        it('shows channel name when public broadcast channel configured', () => {
            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // # Open the broadcast channel widget and select a public channel
            cy.findByTestId('playbook-preferences-broadcast-channel').click().type('off-topic{enter}', {delay: 200});

            // # Save the playbook
            cy.findByTestId('save_playbook').click();

            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // * Verify placeholder text is present
            cy.findByTestId('playbook-preferences-broadcast-channel').should('have.text', 'Off-Topic');
        });

        it('shows channel name when private broadcast channel configured and user is a member', () => {
            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // # Open the broadcast channel widget and select a public channel
            cy.findByTestId('playbook-preferences-broadcast-channel').click().type('autem-2{enter}', {delay: 200});

            // # Save the playbook
            cy.findByTestId('save_playbook').click();

            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // * Verify placeholder text is present
            cy.findByTestId('playbook-preferences-broadcast-channel').should('have.text', 'commodi');
        });

        it('shows "Unknown channel" when private broadcast channel configured and user is not a member', () => {
            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // # Open the broadcast channel widget and select the private channel
            cy.findByTestId('playbook-preferences-broadcast-channel').click().type(privateChannelId + '{enter}', {delay: 200});

            // # Save the playbook
            cy.findByTestId('save_playbook').click();

            // # Browse to the private channel
            cy.visit('/ad-1/channels/' + privateChannelName);

            // # Leave the private channel
            cy.executeSlashCommand('/leave');
            cy.get('#confirmModalButton').click();

            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // * Verify placeholder text is present
            cy.findByTestId('playbook-preferences-broadcast-channel').should('have.text', 'Unknown Channel');
        });
    });
});
