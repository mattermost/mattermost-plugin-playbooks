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

    describe('tasks', () => {
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
            cy.get('#playbook-preferences-broadcast-channel').should('have.text', 'Select a channel');
        });

        it('shows channel name when public broadcast channel configured', () => {
            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // # Open the broadcast channel widget and select a public channel
            cy.get('#playbook-preferences-broadcast-channel').click().type('saepe-5{enter}', {delay: 200});

            // # Save the playbook
            cy.findByTestId('save_playbook').click();

            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // * Verify placeholder text is present
            cy.get('#playbook-preferences-broadcast-channel').should('have.text', 'doloremque');
        });

        it('shows channel name when private broadcast channel configured and user is a member', () => {
            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // # Open the broadcast channel widget and select a public channel
            cy.get('#playbook-preferences-broadcast-channel').click().type('autem-2{enter}', {delay: 200});

            // # Save the playbook
            cy.findByTestId('save_playbook').click();

            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // * Verify placeholder text is present
            cy.get('#playbook-preferences-broadcast-channel').should('have.text', 'commodi');
        });

        it('shows "Unknown channel" when private broadcast channel configured and user is not a member', () => {
            // # Visit the selected playbook
            cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

            // # Switch to Preferences tab
            cy.get('#root').findByText('Preferences').click();

            // # Open the broadcast channel widget and select the private channel
            cy.get('#playbook-preferences-broadcast-channel').click().type(privateChannelId + '{enter}', {delay: 200});

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
            cy.get('#playbook-preferences-broadcast-channel').should('have.text', 'Unknown Channel');
        });
    });

    describe('automation', () => {
        const playbookName = 'Playbook (' + Date.now() + ')';
        let playbookId;
        let teamId;
        let userId;

        before(() => {
            // # Login as user-1
            cy.apiLogin('user-1');

            // # Create a playbook
            cy.apiGetTeamByName('ad-1').then((team) => {
                teamId = team.id;
                cy.apiGetCurrentUser().then((user) => {
                    userId = user.id;
                    cy.apiCreateTestPlaybook({
                        teamId: teamId,
                        title: playbookName,
                        userId: userId,
                    }).then((playbook) => {
                        playbookId = playbook.id;
                    });

                    cy.verifyPlaybookCreated(teamId, playbookName);
                });
            });
        });

        describe('when an incident starts', () => {
            describe('invite members setting', () => {
                it('is disabled in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

                    // # Switch to Automation tab
                    cy.get('#root').findByText('Automation').click();

                    // * Verify that the toggle is unchecked
                    cy.get('#invite-users label input').should('not.be.checked');
                });

                it('can be enabled', () => {
                    // # Visit the selected playbook
                    cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

                    // # Switch to Automation tab
                    cy.get('#root').findByText('Automation').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('be.checked');
                    });
                });

                it('does not let add users when disabled', () => {
                    // # Visit the selected playbook
                    cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

                    // # Switch to Automation tab
                    cy.get('#root').findByText('Automation').click();

                    // * Verify that the toggle is unchecked
                    cy.get('#invite-users label input').should('not.be.checked');

                    // * Verify that the menu is disabled
                    cy.getStyledComponent('StyledAsyncSelect').should('have.class', 'profile-autocomplete--is-disabled');
                });

                it('allows adding users when enabled', () => {
                    // # Visit the selected playbook
                    cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

                    // # Switch to Automation tab
                    cy.get('#root').findByText('Automation').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Add one user
                        cy.addInvitedUser('aaron.medina');

                        // * Verify that the user invited is in the list of invited users
                        cy.getStyledComponent('UserPic').should('have.length', 1).within(() => {
                            cy.get('.name').contains('aaron.medina');
                        });
                    });
                });

                it('allows adding new users to an already populated list', () => {
                    // # Visit the selected playbook
                    cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

                    // # Switch to Automation tab
                    cy.get('#root').findByText('Automation').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Add one user
                        cy.addInvitedUser('aaron.medina');

                        // * Verify that the user invited is in the list of invited users
                        cy.getStyledComponent('UserPic').should('have.length', 1).within(() => {
                            cy.get('.name').contains('aaron.medina');
                        });

                        // # Add a new user
                        cy.addInvitedUser('alice.johnston');

                        // * Verify that there are two users added
                        cy.getStyledComponent('UserPic').should('have.length', 2);

                        // * Verify that the first user invited is in the list of invited users
                        cy.getStyledComponent('UserPic').eq(0).within(() => {
                            cy.get('.name').contains('aaron.medina');
                        });

                        // * Verify that the second user invited is in the list of invited users
                        cy.getStyledComponent('UserPic').eq(1).within(() => {
                            cy.get('.name').contains('alice.johnston');
                        });
                    });
                });

                it('allows removing users', () => {
                    // # Visit the selected playbook
                    cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

                    // # Switch to Automation tab
                    cy.get('#root').findByText('Automation').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Add a couple of users
                        cy.addInvitedUser('aaron.medina');
                        cy.addInvitedUser('alice.johnston');

                        // * Verify that there are two users added
                        cy.getStyledComponent('UserPic').should('have.length', 2);

                        // # Remove the first users added
                        cy.getStyledComponent('UserPic').eq(0).within(() => {
                            cy.getStyledComponent('Cross').click({force: true});
                        });

                        // * Verify that there is only one user, the one not removed
                        cy.getStyledComponent('UserPic').should('have.length', 1);
                        cy.getStyledComponent('UserPic').eq(0).within(() => {
                            cy.get('.name').contains('alice.johnston');
                        });
                    });
                });

                it('persists the list of users persists even if the toggle is off', () => {
                    // # Visit the selected playbook
                    cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

                    // # Switch to Automation tab
                    cy.get('#root').findByText('Automation').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Add a couple of userse
                        cy.addInvitedUser('aaron.medina');
                        cy.addInvitedUser('alice.johnston');

                        // * Verify that the users invited are in the list of invited users
                        cy.getStyledComponent('UserPic').should('have.length', 2);

                        // # Click on the toggle to disable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');
                    });

                    // # Save the playbook
                    cy.findByTestId('save_playbook').click();

                    // # Navigate again to the playbook
                    cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

                    // # Switch to Automation tab
                    cy.get('#root').findByText('Automation').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that there are two users added
                        cy.getStyledComponent('UserPic').should('have.length', 2);

                        // * Verify that the first user invited is in the list of invited users
                        cy.getStyledComponent('UserPic').eq(0).within(() => {
                            cy.get('.name').contains('aaron.medina');
                        });

                        // * Verify that the second user invited is in the list of invited users
                        cy.getStyledComponent('UserPic').eq(1).within(() => {
                            cy.get('.name').contains('alice.johnston');
                        });
                    });
                });

                it('removes invitation from users that are no longer in the team', () => {
                    let userToRemove;

                    // # Create a playbook with a user that is later removed from the team
                    cy.apiLogin('sysadmin').then(() => {
                        // # We need to increase the maximum number of users per team; otherwise,
                        // adding a new member to the team fails in CI
                        cy.apiUpdateConfig({
                            TeamSettings: {
                                MaxUsersPerTeam: 1000,
                            },
                        });

                        cy.apiCreateUser().then((result) => {
                            userToRemove = result.user;
                            cy.apiAddUserToTeam(teamId, userToRemove.id);

                            // # Create a playbook with the user that will be removed from the team.
                            cy.apiCreatePlaybook({
                                teamId,
                                title: 'Playbook (' + Date.now() + ')',
                                createPublicIncident: true,
                                memberIDs: [userId],
                                invitedUserIds: [userToRemove.id],
                                inviteUsersEnabled: true,
                            }).then((playbook) => {
                                playbookId = playbook.id;
                            });

                            // # Remove user from the team
                            cy.apiRemoveUserFromTeam(teamId, userToRemove.id);
                        });
                    }).then(() => {
                        cy.apiLogin('user-1');

                        // # Navigate again to the playbook
                        cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

                        // # Switch to Automation tab
                        cy.get('#root').findByText('Automation').click();

                        // # Save the playbook
                        cy.findByTestId('save_playbook').click();

                        // * Make sure the playbook is correctly saved
                        cy.url().should('not.include', playbookId);

                        // # Navigate again to the playbook
                        cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

                        // # Switch to Automation tab
                        cy.get('#root').findByText('Automation').click();

                        // * Verify that there are no users added
                        cy.getStyledComponent('UserPic').should('not.exist');
                    });
                });
            });
        });
    });
});
