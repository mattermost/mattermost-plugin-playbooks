// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbooks > edit', () => {
    let testTeam;
    let testSysadmin;
    let testUser;
    let testUser2;
    let testUser3;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateCustomAdmin().then(({sysadmin}) => {
                testSysadmin = sysadmin;
            });

            // # Create a second test user in this team
            cy.apiCreateUser().then((payload) => {
                testUser2 = payload.user;
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
            });

            // # Create a third test user in this team
            cy.apiCreateUser().then((payload) => {
                testUser3 = payload.user;
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('checklists', () => {
        describe('slash command', () => {
            it('autocompletes after clicking Add a slash command', () => {
                // # Open Playbooks
                cy.visit('/playbooks/playbooks');

                // # Start a blank playbook
                cy.get('#root').findByText('Blank').click();

                // # Add a slash command to a step
                cy.get('#root').findByText('Add a slash command').click();

                // * Verify the slash command input field now has focus
                cy.get('#root')
                    .findByPlaceholderText('Slash Command')
                    .should('have.focus');

                // * Verify the slash command input field is pre-populated with a leading slash
                cy.get('#root')
                    .findByPlaceholderText('Slash Command')
                    .should('have.value', '/');

                // * Verify the autocomplete prompt is open
                cy.get('#suggestionList').should('exist');
            });

            it('removes the input prompt when blurring with an empty slash command', () => {
                // # Open playbook
                cy.visit('/playbooks/playbooks');

                // # Start a blank playbook
                cy.get('#root').findByText('Blank').click();

                // # Add a slash command to a step
                cy.get('#root').findByText('Add a slash command').click();

                // * Verify only the leading slash is in the input field.
                cy.get('#root')
                    .findByPlaceholderText('Slash Command')
                    .should('have.value', '/');

                // # Backspace even the slash in the input.
                cy.get('#root')
                    .findByPlaceholderText('Slash Command')
                    .type('{backspace}');

                // # Blur the slash command input field
                cy.get('#root').findByPlaceholderText('Slash Command').blur();

                // # Verify the Add a slash command button returns
                cy.get('#root')
                    .findByText('Add a slash command')
                    .should('exist');
            });

            it('removes the input prompt when blurring with an invalid slash command', () => {
                // # Open Playbooks
                cy.visit('/playbooks/playbooks');

                // # Start a blank playbook
                cy.get('#root').findByText('Blank').click();

                // # Add a slash command to a step
                cy.get('#root').findByText('Add a slash command').click();

                // * Verify only the leading slash is in the input field.
                cy.get('#root')
                    .findByPlaceholderText('Slash Command')
                    .should('have.value', '/');

                // # Blur the slash command without having typed anything more
                cy.get('#root').findByPlaceholderText('Slash Command').blur();

                // * Verify the Add a slash command button returns
                cy.get('#root')
                    .findByText('Add a slash command')
                    .should('exist');
            });
        });
    });

    describe('actions', () => {
        let testPublicChannel;
        let testPrivateChannel;
        let testPlaybook;

        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public channel
            cy.apiCreateChannel(
                testTeam.id,
                'public-channel',
                'Public Channel',
                'O'
            ).then(({channel}) => {
                testPublicChannel = channel;
            });

            // # Create a private channel
            cy.apiCreateChannel(
                testTeam.id,
                'private-channel',
                'Private Channel',
                'P'
            ).then(({channel}) => {
                testPrivateChannel = channel;
            });
        });

        beforeEach(() => {
            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook (' + Date.now() + ')',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });

        describe('when a playbook run starts', () => {
            describe('create channel setting', () => {
                it('is enabled in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    // * Verify that the toggle is checked
                    cy.get('#create-channel label input').should(
                        'be.checked'
                    );

                    // * Verify that the toggle is disabled
                    cy.get('#create-channel label input').should(
                        'be.disabled'
                    );
                });

                it('can not be disabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#create-channel').within(() => {
                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle remains checked
                        cy.get('label input').should('be.checked');
                    });
                });
            });

            describe('invite members setting', () => {
                it('is disabled in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    // * Verify that the toggle is unchecked
                    cy.get('#invite-users label input').should(
                        'not.be.checked'
                    );
                });

                it('can be enabled', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

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
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    // * Verify that the toggle is unchecked
                    cy.get('#invite-users label input').should(
                        'not.be.checked'
                    );

                    // * Verify that the menu is disabled
                    cy.get('#invite-users').within(() => {
                        cy.getStyledComponent('StyledReactSelect').should(
                            'have.class',
                            'invite-users-selector--is-disabled'
                        );
                    });
                });

                it('allows adding users when enabled', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the invited users selector
                        cy.openSelector();

                        // # Add one user
                        cy.addInvitedUser(testUser2.username);

                        // * Verify that the badge in the selector shows the correct number of members
                        cy.get('.invite-users-selector__control')
                            .after('content')
                            .should('eq', '1 MEMBER');

                        // * Verify that the user shows in the group of invited members
                        cy.findByText('INVITED MEMBERS')
                            .parent()
                            .within(() => {
                                cy.findByText(testUser2.username);
                            });
                    });
                });

                it('allows adding new users to an already populated list', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the invited users selector
                        cy.openSelector();

                        // # Add one user
                        cy.addInvitedUser(testUser2.username);

                        // * Verify that the user shows in the group of invited members
                        cy.findByText('INVITED MEMBERS')
                            .parent()
                            .within(() => {
                                cy.findByText(testUser2.username);
                            });

                        // # Add a new user
                        cy.addInvitedUser(testUser3.username);

                        // * Verify that the badge in the selector shows the correct number of members
                        cy.get('.invite-users-selector__control')
                            .after('content')
                            .should('eq', '2 MEMBERS');

                        // * Verify that the user shows in the group of invited members
                        cy.findByText('INVITED MEMBERS')
                            .parent()
                            .within(() => {
                                cy.findByText(testUser2.username);
                                cy.findByText(testUser3.username);
                            });
                    });
                });

                it('allows removing users', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the invited users selector
                        cy.openSelector();

                        // # Add a couple of users
                        cy.addInvitedUser(testUser2.username);
                        cy.addInvitedUser(testUser3.username);

                        // * Verify that the badge in the selector shows the correct number of members
                        cy.get('.invite-users-selector__control')
                            .after('content')
                            .should('eq', '2 MEMBERS');

                        // # Remove the first users added
                        cy.get('.invite-users-selector__option')
                            .eq(0)
                            .within(() => {
                                cy.findByText('Remove').click();
                            });

                        // * Verify that there is only one user, the one not removed
                        cy.get('.invite-users-selector__control')
                            .after('content')
                            .should('eq', '1 MEMBER');

                        cy.findByText('INVITED MEMBERS')
                            .parent()
                            .within(() => {
                                cy.get('.invite-users-selector__option')
                                    .should('have.length', 1)
                                    .contains(testUser3.username);
                            });
                    });
                });

                it('persists the list of users even if the toggle is off', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the invited users selector
                        cy.openSelector();

                        // # Add a couple of users
                        cy.addInvitedUser(testUser2.username);
                        cy.addInvitedUser(testUser3.username);

                        // * Verify that the badge in the selector shows the correct number of members
                        cy.get('.invite-users-selector__control')
                            .after('content')
                            .should('eq', '2 MEMBERS');

                        // # Click on the toggle to disable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');
                    });

                    // # Save the playbook
                    cy.findByTestId('save_playbook').click();

                    // # Navigate again to the playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#invite-users').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // * Verify that the badge in the selector shows the correct number of members
                        cy.get('.invite-users-selector__control')
                            .after('content')
                            .should('eq', '2 MEMBERS');

                        // # Open the invited users selector
                        cy.openSelector();

                        // * Verify that the user shows in the group of invited members
                        cy.findByText('INVITED MEMBERS')
                            .parent()
                            .within(() => {
                                cy.findByText(testUser2.username);
                                cy.findByText(testUser2.username);
                            });
                    });
                });

                it('removes invitation from users that are no longer in the team', () => {
                    let userToRemove;
                    let playbookId;

                    // # Create a playbook with a user that is later removed from the team
                    cy.apiLogin(testSysadmin)
                        .then(() => {
                            cy.apiCreateUser().then((result) => {
                                userToRemove = result.user;
                                cy.apiAddUserToTeam(
                                    testTeam.id,
                                    userToRemove.id,
                                );

                                // # Create a playbook with the user that will be removed from the team.
                                cy.apiCreatePlaybook({
                                    teamId: testTeam.id,
                                    title: 'Playbook (' + Date.now() + ')',
                                    createPublicPlaybookRun: true,
                                    memberIDs: [testUser.id, testSysadmin.id],
                                    invitedUserIds: [userToRemove.id],
                                    inviteUsersEnabled: true,
                                }).then((playbook) => {
                                    playbookId = playbook.id;
                                });

                                // # Remove user from the team
                                cy.apiDeleteUserFromTeam(
                                    testTeam.id,
                                    userToRemove.id
                                );
                            });
                        })
                        .then(() => {
                            cy.apiLogin(testUser);

                            // # Navigate again to the playbook
                            cy.visit(
                                '/playbooks/playbooks/' + playbookId + '/edit'
                            );

                            // # Switch to Actions tab
                            cy.get('#root').findByText('Actions').click();

                            // # Save the playbook
                            cy.findByTestId('save_playbook').click();

                            // * Make sure the playbook is correctly saved
                            cy.url().should(
                                'not.include',
                                playbookId + '/edit'
                            );

                            // # Navigate again to the playbook
                            cy.visit(
                                '/playbooks/playbooks/' + playbookId + '/edit'
                            );

                            // # Switch to Actions tab
                            cy.get('#root').findByText('Actions').click();

                            // # Open the invited users selector
                            cy.get('#invite-users').within(() => {
                                cy.openSelector();
                            });

                            // * Verify that there are no invited members
                            cy.findByText('INVITED MEMBERS').should(
                                'not.exist'
                            );
                        });
                });
            });

            describe('assign owner setting', () => {
                it('is disabled in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    // * Verify that the toggle is unchecked
                    cy.get('#assign-owner label input').should(
                        'not.be.checked'
                    );
                });

                it('can be enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#assign-owner').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('be.checked');
                    });
                });

                it('does not let add a owner when disabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    // * Verify that the toggle is unchecked
                    cy.get('#assign-owner label input').should(
                        'not.be.checked'
                    );

                    // * Verify that the mwsenu is disabled
                    cy.get('#assign-owner').within(() => {
                        cy.getStyledComponent('StyledReactSelect').should(
                            'have.class',
                            'assign-owner-selector--is-disabled'
                        );
                    });
                });

                it('allows adding users when enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#assign-owner').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the owner selector
                        cy.openSelector();

                        // # Select a owner
                        cy.selectOwner(testUser2.username);

                        // * Verify that the control shows the selected owner
                        cy.get('.assign-owner-selector__control').contains(
                            testUser2.username,
                        );
                    });
                });

                it('allows changing the owner', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#assign-owner').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the owner selector
                        cy.openSelector();

                        // # Select a owner
                        cy.selectOwner(testUser2.username);

                        // * Verify that the control shows the selected owner
                        cy.get('.assign-owner-selector__control').contains(
                            testUser2.username
                        );

                        // # Open the owner selector
                        cy.get('.assign-owner-selector__control').click({
                            force: true,
                        });

                        // # Select a new owner
                        cy.selectOwner(testUser3.username);

                        // * Verify that the control shows the selected owner
                        cy.get('.assign-owner-selector__control').contains(
                            testUser3.username
                        );
                    });
                });

                it('persists the assign owner even if the toggle is off', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#assign-owner').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the owner selector
                        cy.openSelector();

                        // # Select a owner
                        cy.selectOwner(testUser2.username);

                        // * Verify that the control shows the selected owner
                        cy.get('.assign-owner-selector__control').contains(
                            testUser2.username
                        );

                        // # Click on the toggle to disable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');
                    });

                    // # Save the playbook
                    cy.findByTestId('save_playbook').click();

                    // # Navigate again to the playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Actions').click();

                    cy.get('#assign-owner').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // * Verify that the control shows the selected owner
                        cy.get('.assign-owner-selector__control').contains(
                            testUser2.username
                        );
                    });
                });

                it('removes the owner and disables the setting if the user is no longer in the team', () => {
                    let userToRemove;
                    let playbookId;

                    // # Create a playbook with a user that is later removed from the team
                    cy.apiLogin(testSysadmin)
                        .then(() => {
                            // # We need to increase the maximum number of users per team; otherwise,
                            // adding a new member to the team fails in CI

                            cy.apiCreateUser().then((result) => {
                                userToRemove = result.user;
                                cy.apiAddUserToTeam(
                                    testTeam.id,
                                    userToRemove.id
                                );

                                // # Create a playbook with the user that will be removed from the team as
                                // the default owner
                                cy.apiCreatePlaybook({
                                    teamId: testTeam.id,
                                    title: 'Playbook (' + Date.now() + ')',
                                    createPublicPlaybookRun: true,
                                    memberIDs: [testUser.id, testSysadmin.id],
                                    defaultOwnerId: userToRemove.id,
                                    defaultOwnerEnabled: true,
                                }).then((playbook) => {
                                    playbookId = playbook.id;
                                });

                                // # Remove user from the team
                                cy.apiDeleteUserFromTeam(
                                    testTeam.id,
                                    userToRemove.id
                                );
                            });
                        })
                        .then(() => {
                            cy.apiLogin(testUser);

                            // # Navigate again to the playbook
                            cy.visit(`/playbooks/playbooks/${playbookId}/edit`);

                            // # Switch to Actions tab
                            cy.get('#root').findByText('Actions').click();

                            // # Save the playbook
                            cy.findByTestId('save_playbook').click();

                            // * Make sure the playbook is correctly saved
                            cy.url().should(
                                'not.include',
                                playbookId + '/edit'
                            );

                            // # Navigate again to the playbook
                            cy.visit(`/playbooks/playbooks/${playbookId}/edit`);

                            // # Switch to Actions tab
                            cy.get('#root').findByText('Actions').click();

                            cy.get('#assign-owner').within(() => {
                                // * Verify that the toggle is unchecked
                                cy.get('label input').should('not.be.checked');

                                // # Click on the toggle to enable the setting
                                cy.get('label input').click({force: true});

                                // * Verify that the control shows the selected owner
                                cy.get(
                                    '.assign-owner-selector__control'
                                ).within(() => {
                                    cy.findByText('Search for member');
                                });
                            });
                        });
                });
            });
        });

        describe('when an update is posted', () => {
            describe('broadcast channel setting', () => {
                it('is disabled in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    // * Verify that the toggle is unchecked
                    cy.get('#broadcast-channels label input').should(
                        'not.be.checked'
                    );
                });

                it('can be enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Status updates').click();

                    cy.get('#broadcast-channels').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('be.checked');
                    });
                });

                it('does not let select a channel when disabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    // * Verify that the toggle is unchecked
                    cy.get('#broadcast-channels label input').should(
                        'not.be.checked'
                    );

                    // * Verify that the channel selector is disabled
                    cy.get('#broadcast-channels').within(() => {
                        cy.getStyledComponent('StyledSelect').should(
                            'have.class',
                            'playbooks-rselect--is-disabled'
                        );
                    });
                });

                it('allows selecting a channel when enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    cy.get('#broadcast-channels').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the channel selector
                        cy.openChannelSelector();

                        // # Select a channel
                        cy.selectChannel('Town Square');

                        // * Verify that the control shows the selected owner
                        cy.get('.playbooks-rselect__control').contains(
                            'Town Square'
                        );
                    });
                });

                it('allows changing the channel', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    cy.get('#broadcast-channels').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the channel selector
                        cy.openChannelSelector();

                        // # Select a channel
                        cy.selectChannel('Town Square');

                        // * Verify that the control shows the selected channel
                        cy.get('#playbook-automation-broadcast .playbooks-rselect__control').contains(
                            'Town Square'
                        );

                        // # Open the channel selector
                        cy.get('#playbook-automation-broadcast .playbooks-rselect__control').click({
                            force: true,
                        });

                        // # Select a new channel
                        cy.selectChannel(testPublicChannel.display_name);

                        // * Verify that the control shows the selected channel
                        cy.get('#playbook-automation-broadcast .playbooks-rselect__control').contains(
                            testPublicChannel.display_name,
                        );
                    });
                });

                it('persists the channel even if the toggle is off', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    cy.get('#broadcast-channels').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the channel selector
                        cy.openChannelSelector();

                        // # Select a channel
                        cy.selectChannel('Town Square');

                        // * Verify that the control shows the selected channel
                        cy.get('#playbook-automation-broadcast .playbooks-rselect__control').contains(
                            'Town Square'
                        );

                        // # Click on the toggle to disable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');
                    });

                    // # Save the playbook
                    cy.findByTestId('save_playbook').click();

                    // # Navigate again to the playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.get('#root').findByText('Status updates').click();

                    cy.get('#broadcast-channels').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // * Verify that the control still shows the selected channel
                        cy.get('#playbook-automation-broadcast .playbooks-rselect__control').contains(
                            'Town Square'
                        );
                    });
                });

                it('removes the channel and disables the setting if the channel no longer exists', () => {
                    let playbookId;

                    // # Create a playbook with a user that is later removed from the team
                    cy.apiLogin(testSysadmin)
                        .then(() => {
                            const channelDisplayName = String(
                                'Channel to delete ' + Date.now()
                            );
                            const channelName = channelDisplayName
                                .replace(/ /g, '-')
                                .toLowerCase();
                            cy.apiCreateChannel(
                                testTeam.id,
                                channelName,
                                channelDisplayName
                            ).then(({channel}) => {
                                // # Create a playbook with the channel to be deleted as the announcement channel
                                cy.apiCreatePlaybook({
                                    teamId: testTeam.id,
                                    title: 'Playbook (' + Date.now() + ')',
                                    createPublicPlaybookRun: true,
                                    memberIDs: [testUser.id, testSysadmin.id],
                                    announcementChannelId: channel.id,
                                    announcementChannelEnabled: true,
                                }).then((playbook) => {
                                    playbookId = playbook.id;
                                });

                                // # Delete channel
                                cy.apiDeleteChannel(channel.id);
                            });
                        })
                        .then(() => {
                            cy.apiLogin(testUser);

                            // # Navigate again to the playbook
                            cy.visit(`/playbooks/playbooks/${playbookId}/edit`);

                            // # Switch to Status updates tab
                            cy.get('#root').findByText('Status updates').click();

                            // # Save the playbook
                            cy.findByTestId('save_playbook').click();

                            // * Make sure the playbook is correctly saved
                            cy.url().should(
                                'not.include',
                                playbookId + '/edit'
                            );

                            // # Navigate again to the playbook
                            cy.visit(`/playbooks/playbooks/${playbookId}/edit`);

                            // # Switch to Status updates tab
                            cy.get('#root').findByText('Status updates').click();

                            cy.get('#broadcast-channels').within(() => {
                                // * Verify that the toggle is unchecked
                                cy.get('label input').should('not.be.checked');

                                // # Click on the toggle to enable the setting
                                cy.get('label input').click({force: true});

                                // * Verify that the control shows no selected channel
                                cy.get('#playbook-automation-broadcast .playbooks-rselect__control').within(
                                    () => {
                                        cy.findByText('Select a channel');
                                    }
                                );
                            });
                        });
                });

                it('shows "Select a channel" when no broadcast channel configured', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    // * Verify placeholder text is present
                    cy.get('#playbook-automation-broadcast').should(
                        'have.text',
                        'Select a channel'
                    );
                });

                it('shows channel name when public broadcast channel configured', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    // # Click on the toggle to enable the setting
                    cy.get('#broadcast-channels').within(() => {
                        cy.get('label input').click({force: true});
                    });

                    // # Open the broadcast channel widget and select a public channel
                    cy.get('#playbook-automation-broadcast')
                        .click()
                        .type(testPublicChannel.display_name + '{enter}', {delay: 200});

                    // # Save the playbook
                    cy.findByTestId('save_playbook').click();

                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    // * Verify placeholder text is present
                    cy.get('#playbook-automation-broadcast').should(
                        'have.text',
                        testPublicChannel.display_name,
                    );
                });

                it('shows channel name when private broadcast channel configured and user is a member', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    // # Click on the toggle to enable the setting
                    cy.get('#broadcast-channels').within(() => {
                        cy.get('label input').click({force: true});
                    });

                    // # Open the broadcast channel widget and select a public channel
                    cy.get('#playbook-automation-broadcast')
                        .click()
                        .type(testPrivateChannel.display_name + '{enter}', {delay: 200});

                    // # Save the playbook
                    cy.findByTestId('save_playbook').click();

                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    // * Verify placeholder text is present
                    cy.get('#playbook-automation-broadcast').should(
                        'have.text',
                        testPrivateChannel.display_name,
                    );
                });

                it('shows "Unknown channel" when private broadcast channel configured and user is not a member', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    // # Click on the toggle to enable the setting
                    cy.get('#broadcast-channels').within(() => {
                        cy.get('label input').click({force: true});
                    });

                    // # Open the broadcast channel widget and select the private channel
                    cy.get('#playbook-automation-broadcast')
                        .click()
                        .type(testPrivateChannel.display_name + '{enter}', {delay: 200});

                    // # Save the playbook
                    cy.findByTestId('save_playbook').click();

                    // # Browse to the private channel
                    cy.visit(`/${testTeam.name}/channels/${testPrivateChannel.name}`);

                    // # Leave the private channel
                    cy.executeSlashCommand('/leave');
                    cy.get('#confirmModalButton').click();

                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/edit');

                    // # Switch to Status updates tab
                    cy.get('#root').findByText('Status updates').click();

                    // * Verify placeholder text is present
                    cy.get('#playbook-automation-broadcast').should(
                        'have.text',
                        'Unknown Channel'
                    );
                });
            });
        });

        describe('when a new member joins the channel', () => {
            beforeEach(() => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Actions tab
                cy.findByText('Actions').click();
            });

            describe('add the channel to a sidebar category', () => {
                it('is disabled in a new playbook', () => {
                    // * Verify that the toggle is unchecked
                    cy.get('#user-joins-channel-categorize label input').should(
                        'not.be.checked'
                    );
                });

                it('can be enabled', () => {
                    cy.get('#user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('be.checked');
                    });
                });

                it('prevents category selection when disabled', () => {
                    // * Verify that the toggle is unchecked
                    cy.get('#user-joins-channel-categorize label input').should(
                        'not.be.checked'
                    );

                    // * Verify that the category selector is disabled
                    cy.get('#user-joins-channel-categorize').within(() => {
                        cy.getStyledComponent('StyledCreatable').should(
                            'have.class',
                            'channel-selector--is-disabled'
                        );
                    });
                });

                it('allows selecting a category when enabled', () => {
                    cy.get('#user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the category selector
                        cy.openCategorySelector();

                        // # Select a category
                        cy.selectCategory('Favorites');

                        // * Verify that the control shows the selected category
                        cy.get('.channel-selector__control').contains(
                            'Favorites'
                        );
                    });
                });

                it('allows changing the category', () => {
                    cy.get('#user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the channel selector
                        cy.openCategorySelector();

                        // # Select a channel
                        cy.selectCategory('Favorites');

                        // * Verify that the control shows the selected category
                        cy.get('#playbook-automation-categorize-playbook-run .channel-selector__control').contains(
                            'Favorites'
                        );

                        // # Open the channel selector
                        cy.get('#playbook-automation-categorize-playbook-run .channel-selector__control').click({
                            force: true,
                        });

                        // # Select a new channel
                        cy.selectCategory('Channels');

                        // * Verify that the control shows the selected channel
                        cy.get('#playbook-automation-categorize-playbook-run .channel-selector__control').contains(
                            'Channels',
                        );
                    });
                });

                it('persists the category even if the toggle is off', () => {
                    cy.get('#user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the channel selector
                        cy.openCategorySelector();

                        // # Select a channel
                        cy.selectCategory('Favorites');

                        // * Verify that the control shows the selected category
                        cy.get('#playbook-automation-categorize-playbook-run .channel-selector__control').contains(
                            'Favorites'
                        );

                        // # Click on the toggle to disable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');
                    });

                    // # Save the playbook
                    cy.findByTestId('save_playbook').click();

                    // # Navigate again to the playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.findByText('Actions').click();

                    cy.get('#user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // * Verify that the control still shows the selected category
                        cy.get('#playbook-automation-categorize-playbook-run .channel-selector__control').contains(
                            'Favorites'
                        );
                    });
                });

                it('shows new category name when category was created', () => {
                    cy.get('#user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label input').click({force: true});

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');
                    });

                    // # Type name to use new custom category
                    cy.get('#playbook-automation-categorize-playbook-run')
                        .click()
                        .type('Custom category{enter}', {delay: 200});

                    // # Save the playbook
                    cy.findByTestId('save_playbook').click();

                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                    // # Switch to Actions tab
                    cy.findByText('Actions').click();

                    cy.get('#user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');
                    });

                    // * Verify that the control still shows the new category
                    cy.get('#playbook-automation-categorize-playbook-run').should(
                        'have.text',
                        'Custom category',
                    );
                });
            });
        });

        describe('status updates enable / disabled', () => {
            it('is enabled in a new playbook', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Status updates tab
                cy.get('#root').findByText('Status updates').click();

                // * Verify that the toggle is checked
                cy.get('#status-updates label input').should('be.checked');
            });

            it('can be disabled', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Status updates tab
                cy.get('#root').findByText('Status updates').click();

                // * Verify that toggle can be disabled
                cy.get('#status-updates').within(() => {
                    // * Verify that the toggle is checked
                    cy.get('label input').should('be.checked');

                    // # Click on the toggle to enable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });

                // * Verify that the update timer is disabled
                cy.get('#default-update-timer').within(() => {
                    cy.getStyledComponent('StyledSelect').should(
                        'have.class',
                        'playbooks-rselect--is-disabled'
                    );
                });

                // * Verify that the update text is disabled
                cy.get('#playbook_reminder_message_edit').should('be.disabled');

                // * Verify that the toggle can't be checked
                cy.get('#broadcast-channels').within(() => {
                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');

                    // # Click on the toggle
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });

                // * Verify that the toggle can't be checked
                cy.get('#playbook-run-status-update__outgoing-webhook').within(() => {
                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');

                    // # Click on the toggle
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });
            });

            it('disabling status should disable actions(when an update is posted)', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Status updates tab
                cy.get('#root').findByText('Status updates').click();

                // * Verify that the toggle is checked
                cy.get('#broadcast-channels').within(() => {
                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');

                    // # Click on the toggle to enable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is checked
                    cy.get('label input').should('be.checked');
                });

                // * Verify that the toggle is checked
                cy.get('#playbook-run-status-update__outgoing-webhook').within(() => {
                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');

                    // # Click on the toggle to enable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is checked
                    cy.get('label input').should('be.checked');
                });

                // * Verify that toggle can be selected
                cy.get('#status-updates').within(() => {
                    // * Verify that the toggle is checked
                    cy.get('label input').should('be.checked');

                    // # Click on the toggle to enable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });

                // * Verify that the toggle can't be checked
                cy.get('#broadcast-channels').within(() => {
                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');

                    // # Click on the toggle
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });

                // * Verify that the toggle can't be checked
                cy.get('#playbook-run-status-update__outgoing-webhook').within(() => {
                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');

                    // # Click on the toggle
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });
            });

            it('can be saved', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Status updates tab
                cy.get('#root').findByText('Status updates').click();

                // # Uncheck toggle
                cy.get('#status-updates label input').click({force: true});

                // # Save the playbook
                cy.findByTestId('save_playbook').click();

                // # Navigate again to the playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Status updates tab
                cy.get('#root').findByText('Status updates').click();

                // * Verify that the toggle is unchecked
                cy.get('#status-updates label input').should('not.be.checked');
            });
        });

        describe('retrospective enable / disable', () => {
            it('is enabled in a new playbook', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Retrospective tab
                cy.get('#root').findByText('Retrospective').click();

                // * Verify that the toggle is checked
                cy.get('#retrospective-enabled label input').should('be.checked');
            });

            it('can be disabled', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Retrospective tab
                cy.get('#root').findByText('Retrospective').click();

                // * Verify that toggle can be disabled
                cy.get('#retrospective-enabled').within(() => {
                    // * Verify that the toggle is checked
                    cy.get('label input').should('be.checked');

                    // # Click on the toggle to enable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });

                // * Verify that select box is disabled
                cy.get('#retrospective-reminder-interval').within(() => {
                    cy.getStyledComponent('StyledSelect').should(
                        'have.class',
                        'playbooks-rselect--is-disabled'
                    );
                });

                // * Verify that the text box is disabled
                cy.get('#playbook_retrospective_template_edit').should('be.disabled');
            });

            it('can be saved', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Retrospective tab
                cy.get('#root').findByText('Retrospective').click();

                // # Uncheck toggle
                cy.get('#retrospective-enabled label input').click({force: true});

                // # Save the playbook
                cy.findByTestId('save_playbook').click();

                // # Navigate again to the playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Retrospective tab
                cy.get('#root').findByText('Retrospective').click();

                // * Verify that the toggle is unchecked
                cy.get('#retrospective-enabled label input').should('not.be.checked');
            });
        });
    });
});
