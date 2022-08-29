// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************
import * as TIMEOUTS from '../../fixtures/timeouts';

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
            it('autocompletes after clicking Command...', () => {
                // # Open Playbooks
                cy.visit('/playbooks/playbooks');

                // # Start a blank playbook
                cy.findByText('Blank').click();
                cy.findByText('Outline').click();

                cy.get('#checklists').within(() => {
                    // # Open the slash command input on a step
                    cy.findByText('Untitled task').trigger('mouseover');
                    cy.findByTestId('hover-menu-edit-button').click();
                    cy.findByText('Command...').click();

                    // * Verify the slash command input field now has focus
                    // * and starts with a slash prefix.
                    cy.focused()
                        .should('have.attr', 'placeholder', 'Slash Command')
                        .should('have.value', '/');
                });

                // * Verify the autocomplete prompt is open
                cy.get('#suggestionList').should('exist');
            });

            // current regression in BPE
            // MM-44606
            it.skip('removes the input prompt when blurring with an empty slash command', () => {
                // # Open Playbooks
                cy.visit('/playbooks/playbooks');

                // # Start a blank playbook
                cy.findByText('Blank').click();
                cy.findByText('Outline').click();

                cy.get('#checklists').within(() => {
                    // # Open the slash command input on a step
                    cy.findByText('Untitled task').trigger('mouseover');
                    cy.findByTestId('hover-menu-edit-button').click();
                    cy.findByText('Add slash command').click();

                    // * Verify the slash command input field now has focus
                    // * and starts with a slash prefix.
                    cy.findByPlaceholderText('Slash Command').should('have.focus');
                    cy.findByPlaceholderText('Slash Command').should('have.value', '/');

                    cy.findByPlaceholderText('Slash Command').type('{backspace}');
                    cy.findByPlaceholderText('Slash Command').blur();

                    cy.findByText('Add slash command').should('be.visible');
                });
            });

            // current regression in BPE
            // MM-44606
            it.skip('removes the input prompt when blurring with an invalid slash command', () => {
                // # Open Playbooks
                cy.visit('/playbooks/playbooks');

                // # Start a blank playbook
                cy.findByText('Blank').click();
                cy.findByText('Outline').click();

                cy.get('#checklists').within(() => {
                    // # Open the slash command input on a step
                    cy.findByText('Untitled task').trigger('mouseover');
                    cy.findByTestId('hover-menu-edit-button').click();
                    cy.findByText('Add slash command').click();

                    // * Verify the slash command input field now has focus
                    // * and starts with a slash prefix.
                    cy.findByPlaceholderText('Slash Command').should('have.focus');
                    cy.findByPlaceholderText('Slash Command').should('have.value', '/');

                    // # Blur the slash command without having typed anything more
                    cy.findByPlaceholderText('Slash Command').blur();

                    cy.findByText('Add slash command').should('be.visible');
                });
            });
        });
    });

    describe('actions', () => {
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
            );

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
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section.
                    cy.get('#actions').within(() => {
                        // * Verify that the toggle is checked
                        cy.get('#create-channel label input').should(
                            'be.checked'
                        );

                        // * Verify that the toggle is disabled
                        cy.get('#create-channel label input').should(
                            'be.disabled'
                        );
                    });
                });

                it('can not be disabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#create-channel').within(() => {
                            // * Verify that the toggle is checked
                            cy.get('[type="checkbox"]').should('be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('[type="checkbox"]').click({force: true});

                            // * Verify that the toggle remains checked
                            cy.get('[type="checkbox"]').should('be.checked');
                        });
                    });
                });
            });

            describe('invite members setting', () => {
                it('is disabled in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('#invite-users label input').should(
                            'not.be.checked'
                        );
                    });
                });

                it('can be enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#invite-users').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('be.checked');
                        });
                    });
                });

                it('does not let add users when disabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
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
                });

                it('allows adding users when enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
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
                            cy.wait(TIMEOUTS.ONE_SEC);

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
                });

                it('allows adding new users to an already populated list', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
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
                            cy.wait(TIMEOUTS.ONE_SEC);

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
                });

                it('allows removing users', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
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
                            cy.wait(TIMEOUTS.ONE_SEC);
                            cy.addInvitedUser(testUser3.username);
                            cy.wait(TIMEOUTS.ONE_SEC);

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
                            cy.wait(TIMEOUTS.ONE_SEC);

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
                });

                it('persists the list of users even if the toggle is off', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
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
                            cy.wait(TIMEOUTS.ONE_SEC);
                            cy.addInvitedUser(testUser3.username);
                            cy.wait(TIMEOUTS.ONE_SEC);

                            // * Verify that the badge in the selector shows the correct number of members
                            cy.get('.invite-users-selector__control')
                                .after('content')
                                .should('eq', '2 MEMBERS');

                            // # Click on the toggle to disable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');
                        });
                    });

                    cy.reload();

                    cy.get('#actions').within(() => {
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
                });

                // BPE regression
                // user is still shown in the selector
                // with a 1 MEMBER badge
                // MM-44635
                it.skip('removes invitation from users that are no longer in the team', () => {
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

                            // # Visit the selected playbook
                            cy.visit(`/playbooks/playbooks/${playbookId}/outline`);

                            // # select the actions section
                            cy.contains('run summary template').dblclick();
                            cy.findByRole('button', {name: /save/i});
                            cy.reload();

                            cy.get('#actions').within(() => {
                                // # Open the invited users selector
                                cy.get('#invite-users').within(() => {
                                    cy.openSelector();

                                    // * Verify there is no member badge
                                    cy.get('.invite-users-selector__control')
                                        .after('content')
                                        .should('eq', '');
                                });
                            });
                        });
                });
            });

            describe('assign owner setting', () => {
                it('is disabled in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('#assign-owner label input').should(
                            'not.be.checked'
                        );
                    });
                });

                it('can be enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#assign-owner').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is checked
                            cy.get('label input').should('be.checked');
                        });
                    });
                });

                it('does not allow adding an owner when disabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#assign-owner').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('input').should(
                                'not.be.checked'
                            );

                            // * Verify that the menu is disabled
                            cy.getStyledComponent('StyledReactSelect').should(
                                'have.class',
                                'assign-owner-selector--is-disabled'
                            );
                        });
                    });
                });

                it('allows adding users when enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
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
                });

                it('allows changing the owner', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
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
                });

                // BPE regression,
                // owner assignment does not save
                // MM-44647
                it.skip('persists the assigned owner even if the toggle is off', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
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

                    // # The toggle click above should have saved,
                    // # reload to check the outcome.
                    cy.reload();

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

                // BPE regression
                // removed user is not shown in the owner selector
                // but the toggle remains on
                // MM-44678
                it.skip('removes the owner and disables the setting if the user is no longer in the team', () => {
                    let userToRemove;

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

                            // # Visit the selected playbook
                            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                            // # select the actions section
                            cy.contains('run summary template').dblclick();
                            cy.findByRole('button', {name: /save/i});
                            cy.reload();

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
                it('none configured in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    cy.get('#status-updates').within(() => {
                        cy.findByText('no channels').should('be.visible');
                    });
                });

                it('can change channel and edit is saved immediately', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    cy.get('#status-updates').within(() => {
                        cy.findByText('no channels').click();
                    });
                    cy.findByText(/off-topic/i).click();

                    cy.reload();

                    cy.get('#status-updates').within(() => {
                        cy.findByText('1 channel').should('be.visible');
                    });
                });

                it('persists selected channels when status update toggle is off', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # Add a channel and turn off the
                    // # status updates toggle
                    cy.get('#status-updates').within(() => {
                        cy.findByText('no channels').click();
                    });
                    cy.findByText(/off-topic/i).click();

                    // # Close the channel selector
                    cy.findByText(/search for a channel/i).type('{esc}');

                    cy.get('#status-updates').trigger('mouseenter').within(() => {
                        // # Click on the toggle to disable the setting
                        cy.get('label').click();

                        // * Verify that the toggle off
                        cy.get('label input').should('not.be.checked');
                    });

                    // * Verify disabled status updates text
                    cy.findByText(/status updates are not expected/i).should('exist');
                    cy.reload();

                    // # Turn the status update toggle back on
                    // * Verify there's still 1 channel selected
                    cy.get('#status-updates').trigger('mouseenter').within(() => {
                        cy.get('label').click();
                        cy.findByText('1 channel').should('be.visible');
                    });
                });

                it('removes the channel and disables the setting if the channel no longer exists', () => {
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
                                });

                                // # Delete channel
                                cy.apiDeleteChannel(channel.id);
                            });
                        })
                        .then(() => {
                            cy.apiLogin(testUser);

                            // # Navigate again to the playbook
                            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                            cy.get('#status-updates').within(() => {
                                cy.findByText('no channels').should('be.visible');
                            });
                        });
                });

                it.skip('shows channel name when private broadcast channel configured and user is a member', () => {
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

                it.skip('shows "Unknown channel" when private broadcast channel configured and user is not a member', () => {
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
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            });

            describe('add the channel to a sidebar category', () => {
                it('is disabled in a new playbook', () => {
                    cy.get('#user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');
                    });
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

                it.skip('allows changing the category', () => {
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

                    cy.reload();

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

                    cy.reload();

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
            beforeEach(() => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            });

            it('is enabled in a new playbook', () => {
                // * Verify that the toggle is checked
                cy.get('#status-updates label input').should('be.checked');
            });

            it('can be disabled', () => {
                // * Verify that toggle can be disabled
                cy.get('#status-updates').within(() => {
                    // * Verify that the toggle is checked
                    cy.get('label input').should('be.checked');

                    // # Click on the toggle to enable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });

                // * Verify disabled status updates text
                cy.findByText(/status updates are not expected/i).should('be.visible');
                cy.reload();
                cy.findByText(/status updates are not expected/i).should('be.visible');
            });
        });

        describe('retrospective enable / disable', () => {
            beforeEach(() => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            });

            it('is enabled in a new playbook', () => {
                cy.get('#retrospective').within(() => {
                    // * Verify that the toggle is checked
                    cy.get('input[type=checkbox]').should('be.checked');
                });
            });

            it('can be disabled', () => {
                cy.get('#retrospective').within(() => {
                    // * Verify that the toggle is checked
                    cy.get('label input').should('be.checked');

                    // # Click on the toggle to disable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');

                    cy.findByText(/a retrospective is not expected/i).should('exist');
                });
            });

            it('saves on toggle', () => {
                cy.get('#retrospective').within(() => {
                    // # Uncheck toggle
                    cy.get('label input').click({force: true});
                });

                cy.reload();

                cy.get('#retrospective').within(() => {
                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });
            });
        });
    });

    describe('Edit playbook name', () => {
        it('can be updated', () => {
            // # Open Playbooks
            cy.visit('/playbooks/playbooks');

            // # Start a blank playbook
            cy.findByText('Blank').click();

            // # Open the title dropdown and Rename
            cy.findByRole('button', {name: /'s Blank/i}).click();
            cy.findByText('Rename').click();

            // # Change the name and save
            cy.focused().type('{selectAll}{del}renamed playbook');
            cy.findByRole('button', {name: /save/i}).click();

            cy.reload();

            // * Verify the modified name persists
            cy.findByRole('button', {name: /renamed playbook/i}).should('exist');
        });

        // BPE regression?
        // no more unsaved changes modal
        it.skip('update, leave and discard', () => {
            // # Open Playbooks
            cy.visit('/playbooks/playbooks');

            // # Start a blank playbook
            cy.findByText('Blank').click();
            cy.get('#edit-playbook').click();

            // * edit
            cy.findByTestId('playbook-title-description').click();
            cy.get('#playbook-edit-name-and-description-modal').should('exist');
            cy.get('#confirm-modal-light').should('not.exist');
            cy.findByTestId('playbook-edit-name-input').clear().type('playbook updated name');

            // * leave without save, show confirm modal and discard
            cy.findByTestId('modal-cancel-button').click();
            cy.get('#playbook-edit-name-and-description-modal').should('not.exist');
            cy.get('#confirm-modal-light').should('exist');
            cy.findByTestId('modal-confirm-button').click();

            // * check modals are hidden and name is not changed
            cy.get('#playbook-edit-name-and-description-modal').should('not.exist');
            cy.get('#confirm-modal-light').should('not.exist');
            cy.findByText('playbook updated name').should('not.exist');
        });

        // BPE regression?
        // no more unsaved changes modal
        it.skip('update, leave and go back to edit', () => {
            // # Open Playbooks
            cy.visit('/playbooks/playbooks');

            // # Start a blank playbook
            cy.findByText('Blank').click();
            cy.get('#edit-playbook').click();

            // * edit
            cy.findByTestId('playbook-title-description').click();
            cy.get('#playbook-edit-name-and-description-modal').should('exist');
            cy.get('#confirm-modal-light').should('not.exist');
            cy.findByTestId('playbook-edit-name-input').clear().type('playbook updated name');

            // * leave without save, show confirm modal and cancel
            cy.findByTestId('modal-cancel-button').click();
            cy.get('#playbook-edit-name-and-description-modal').should('not.exist');
            cy.get('#confirm-modal-light').should('exist');
            cy.findByTestId('modal-cancel-button').click();

            // * check modals are hidden and name is not changed
            cy.get('#playbook-edit-name-and-description-modal').should('exist');
            cy.get('#confirm-modal-light').should('not.exist');
            cy.findByTestId('modal-confirm-button').click();

            // * modals are hidden and text is changed
            cy.get('#playbook-edit-name-and-description-modal').should('not.exist');
            cy.get('#confirm-modal-light').should('not.exist');
            cy.findByText('playbook updated name').should('exist');
        });
    });

    describe('Edit playbook description', () => {
        it.skip('can be updated', () => {
            // # Open Playbooks
            cy.visit('/playbooks/playbooks');

            // # Start a blank playbook
            cy.findByText('Blank').click();
            cy.findByText(/customize this playbook's description/i).dblclick();
            cy.focused().type('{selectAll}{del}some new description{esc}');
            cy.findByRole('button', {name: /save/i}).click();

            cy.reload();

            cy.findByText('some new description').should('exist');
        });

        // BPE regression?
        // no more unsaved changes modal
        it.skip('update, leave and discard', () => {
            // # Open Playbooks
            cy.visit('/playbooks/playbooks');

            // # Start a blank playbook
            cy.findByText('Blank').click();
            cy.get('#edit-playbook').click();

            // * edit
            cy.findByTestId('playbook-title-description').click();
            cy.get('#playbook-edit-name-and-description-modal').should('exist');
            cy.get('#confirm-modal-light').should('not.exist');
            cy.findByTestId('playbook-edit-name-and-description-modal-description-textbox').clear().type('playbook updated desc');

            // * leave without save, show confirm modal and discard
            cy.findByTestId('modal-cancel-button').click();
            cy.get('#playbook-edit-name-and-description-modal').should('not.exist');
            cy.get('#confirm-modal-light').should('exist');
            cy.findByTestId('modal-confirm-button').click();

            // * check modals are hidden and name is not changed
            cy.get('#playbook-edit-name-and-description-modal').should('not.exist');
            cy.get('#confirm-modal-light').should('not.exist');
            cy.findByText('playbook updated desc').should('not.exist');
        });

        // BPE regression?
        // no more unsaved changes modal
        it.skip('update, leave and go back to edit', () => {
            // # Open Playbooks
            cy.visit('/playbooks/playbooks');

            // # Start a blank playbook
            cy.findByText('Blank').click();
            cy.get('#edit-playbook').click();

            // * edit
            cy.findByTestId('playbook-title-description').click();
            cy.get('#playbook-edit-name-and-description-modal').should('exist');
            cy.get('#confirm-modal-light').should('not.exist');
            cy.findByTestId('playbook-edit-name-and-description-modal-description-textbox').clear().type('playbook updated desc');

            // * leave without save, show confirm modal and cancel
            cy.findByTestId('modal-cancel-button').click();
            cy.get('#playbook-edit-name-and-description-modal').should('not.exist');
            cy.get('#confirm-modal-light').should('exist');
            cy.findByTestId('modal-cancel-button').click();

            // * check modals are hidden and name is not changed
            cy.get('#playbook-edit-name-and-description-modal').should('exist');
            cy.get('#confirm-modal-light').should('not.exist');
            cy.findByTestId('modal-confirm-button').click();

            // * modals are hidden and text is changed
            cy.get('#playbook-edit-name-and-description-modal').should('not.exist');
            cy.get('#confirm-modal-light').should('not.exist');
            cy.findByText('playbook updated desc').should('exist');
        });
    });
});
