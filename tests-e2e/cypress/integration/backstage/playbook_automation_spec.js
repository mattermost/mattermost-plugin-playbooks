// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

function createTestUsers(testUser, returnedUser, teamId) {
    testUser = returnedUser;
    cy.apiAddUserToTeam(teamId, testUser.id);
}

describe('invite members setting', () => {
    // const playbookName = 'Playbook (' + Date.now() + ')';
    // let playbookName;
    // let playbookId;
    // let teamId;
    // let userId;
    let testTeam;
    let testUser1;
    let testPlaybook;
    let playbookId;
    let testUser2;
    let testUser3;

    before(() => {
        // // # Login as user-1
        // cy.apiLogin('user-1');

        // // # Create a playbook
        // cy.apiGetTeamByName('ad-1').then((team) => {
        //     teamId = team.id;
        //     cy.apiGetCurrentUser().then((user) => {
        //         userId = user.id;
        //         cy.apiCreateTestPlaybook({
        //             teamId,
        //             title: playbookName,
        //             userId,
        //         }).then((playbook) => {
        //             playbookId = playbook.id;
        //         });

        //         cy.verifyPlaybookCreated(teamId, playbookName);
        //     });
        // });
        cy.apiInitSetup({createPlaybook: true}).then(({team, user, playbook}) => {
            testTeam = team;
            testUser1 = user;
            testPlaybook = playbook;
            playbookId = playbook.id;

            cy.log('----- 1st init setup done -----');

            cy.apiCreateUser({prefix: 'other'}).then(({user: user2}) => {
                cy.log('..... now creating user 2 .....');
                testUser2 = user2;
                cy.apiAddUserToTeam(team.id, user2.id);
            });

            cy.apiCreateUser().then(({user: user3}) => {
                testUser3 = user3;
                cy.apiAddUserToTeam(team.id, user3.id);
            });
        });
    });

    it('is disabled in a new playbook', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        // * Verify that the toggle is unchecked
        cy.get('#invite-users label input').should('not.be.checked');
    });

    it('can be enabled', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

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
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        // * Verify that the toggle is unchecked
        cy.get('#invite-users label input').should('not.be.checked');

        // * Verify that the menu is disabled
        cy.getStyledComponent('StyledReactSelect').should('have.class', 'invite-users-selector--is-disabled');
    });

    it('allows adding users when enabled', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        cy.get('#invite-users').within(() => {
            // * Verify that the toggle is unchecked
            cy.get('label input').should('not.be.checked');

            // # Click on the toggle to enable the setting
            cy.get('label input').click({force: true});

            // * Verify that the toggle is checked
            cy.get('label input').should('be.checked');

            // # Open the invited users selector
            cy.openInvitedUsersSelector();

            // # Add one user
            cy.addInvitedUser(`${testUser2.username}`);

            // * Verify that the badge in the selector shows the correct number of members
            cy.get('.invite-users-selector__control')
                .after('content')
                .should('eq', '1 MEMBER');

            // * Verify that the user shows in the group of invited members
            cy.findByText('INVITED MEMBERS').parent().within(() => {
                cy.findByText(`${testUser2.username}`);
            });
        });
    });

    // it('allows adding new users to an already populated list', () => {
    //     // # Visit the selected playbook
    //     cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

    //     // # Switch to Automation tab
    //     cy.get('#root').findByText('Automation').click();

    //     cy.get('#invite-users').within(() => {
    //         // * Verify that the toggle is unchecked
    //         cy.get('label input').should('not.be.checked');

    //         // # Click on the toggle to enable the setting
    //         cy.get('label input').click({force: true});

    //         // * Verify that the toggle is checked
    //         cy.get('label input').should('be.checked');

    //         // # Open the invited users selector
    //         cy.openInvitedUsersSelector();

    //         // # Add one user
    //         cy.addInvitedUser('aaron.medina');

    //         // * Verify that the user shows in the group of invited members
    //         cy.findByText('INVITED MEMBERS').parent().within(() => {
    //             cy.findByText('aaron.medina');
    //         });

    //         // # Add a new user
    //         cy.addInvitedUser('alice.johnston');

    //         // * Verify that the badge in the selector shows the correct number of members
    //         cy.get('.invite-users-selector__control')
    //             .after('content')
    //             .should('eq', '2 MEMBERS');

    //         // * Verify that the user shows in the group of invited members
    //         cy.findByText('INVITED MEMBERS').parent().within(() => {
    //             cy.findByText('aaron.medina');
    //             cy.findByText('alice.johnston');
    //         });
    //     });
    // });

    // it('allows removing users', () => {
    //     // # Visit the selected playbook
    //     cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

    //     // # Switch to Automation tab
    //     cy.get('#root').findByText('Automation').click();

    //     cy.get('#invite-users').within(() => {
    //         // * Verify that the toggle is unchecked
    //         cy.get('label input').should('not.be.checked');

    //         // # Click on the toggle to enable the setting
    //         cy.get('label input').click({force: true});

    //         // * Verify that the toggle is checked
    //         cy.get('label input').should('be.checked');

    //         // # Open the invited users selector
    //         cy.openInvitedUsersSelector();

    //         // # Add a couple of users
    //         cy.addInvitedUser('aaron.medina');
    //         cy.addInvitedUser('alice.johnston');

    //         // * Verify that the badge in the selector shows the correct number of members
    //         cy.get('.invite-users-selector__control')
    //             .after('content')
    //             .should('eq', '2 MEMBERS');

    //         // # Remove the first users added
    //         cy.get('.invite-users-selector__option').eq(0).within(() => {
    //             cy.findByText('Remove').click();
    //         });

    //         // * Verify that there is only one user, the one not removed
    //         cy.get('.invite-users-selector__control')
    //             .after('content')
    //             .should('eq', '1 MEMBER');

    //         cy.findByText('INVITED MEMBERS').parent().within(() => {
    //             cy.get('.invite-users-selector__option')
    //                 .should('have.length', 1)
    //                 .contains('alice.johnston');
    //         });
    //     });
    // });

    // it('persists the list of users persists even if the toggle is off', () => {
    //     // # Visit the selected playbook
    //     cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

    //     // # Switch to Automation tab
    //     cy.get('#root').findByText('Automation').click();

    //     cy.get('#invite-users').within(() => {
    //         // * Verify that the toggle is unchecked
    //         cy.get('label input').should('not.be.checked');

    //         // # Click on the toggle to enable the setting
    //         cy.get('label input').click({force: true});

    //         // * Verify that the toggle is checked
    //         cy.get('label input').should('be.checked');

    //         // # Open the invited users selector
    //         cy.openInvitedUsersSelector();

    //         // # Add a couple of users
    //         cy.addInvitedUser('aaron.medina');
    //         cy.addInvitedUser('alice.johnston');

    //         // * Verify that the badge in the selector shows the correct number of members
    //         cy.get('.invite-users-selector__control')
    //             .after('content')
    //             .should('eq', '2 MEMBERS');

    //         // # Click on the toggle to disable the setting
    //         cy.get('label input').click({force: true});

    //         // * Verify that the toggle is unchecked
    //         cy.get('label input').should('not.be.checked');
    //     });

    //     // # Save the playbook
    //     cy.findByTestId('save_playbook').click();

    //     // # Navigate again to the playbook
    //     cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

    //     // # Switch to Automation tab
    //     cy.get('#root').findByText('Automation').click();

    //     cy.get('#invite-users').within(() => {
    //         // * Verify that the toggle is unchecked
    //         cy.get('label input').should('not.be.checked');

    //         // # Click on the toggle to enable the setting
    //         cy.get('label input').click({force: true});

    //         // * Verify that the toggle is checked
    //         cy.get('label input').should('be.checked');

    //         // * Verify that the badge in the selector shows the correct number of members
    //         cy.get('.invite-users-selector__control')
    //             .after('content')
    //             .should('eq', '2 MEMBERS');

    //         // # Open the invited users selector
    //         cy.openInvitedUsersSelector();

    //         // * Verify that the user shows in the group of invited members
    //         cy.findByText('INVITED MEMBERS').parent().within(() => {
    //             cy.findByText('aaron.medina');
    //             cy.findByText('alice.johnston');
    //         });
    //     });
    // });

    // it('removes invitation from users that are no longer in the team', () => {
    //     let userToRemove;

    //     // # Create a playbook with a user that is later removed from the team
    //     cy.apiLogin('sysadmin').then(() => {
    //         // # We need to increase the maximum number of users per team; otherwise,
    //         // adding a new member to the team fails in CI
    //         cy.apiUpdateConfig({
    //             TeamSettings: {
    //                 MaxUsersPerTeam: 1000,
    //             },
    //         });

    //         cy.apiCreateUser().then((result) => {
    //             userToRemove = result.user;
    //             cy.apiAddUserToTeam(teamId, userToRemove.id);

    //             // # Create a playbook with the user that will be removed from the team.
    //             cy.apiCreatePlaybook({
    //                 teamId,
    //                 title: 'Playbook (' + Date.now() + ')',
    //                 createPublicIncident: true,
    //                 memberIDs: [userId],
    //                 invitedUserIds: [userToRemove.id],
    //                 inviteUsersEnabled: true,
    //             }).then((playbook) => {
    //                 playbookId = playbook.id;
    //             });

    //             // # Remove user from the team
    //             cy.apiRemoveUserFromTeam(teamId, userToRemove.id);
    //         });
    //     }).then(() => {
    //         cy.apiLogin('user-1');

    //         // # Navigate again to the playbook
    //         cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

    //         // # Switch to Automation tab
    //         cy.get('#root').findByText('Automation').click();

    //         // # Save the playbook
    //         cy.findByTestId('save_playbook').click();

    //         // * Make sure the playbook is correctly saved
    //         cy.url().should('not.include', playbookId);

    //         // # Navigate again to the playbook
    //         cy.visit('/ad-1/com.mattermost.plugin-incident-management/playbooks/' + playbookId);

    //         // # Switch to Automation tab
    //         cy.get('#root').findByText('Automation').click();

    //         // # Open the invited users selector
    //         cy.openInvitedUsersSelector();

    //         // * Verify that there are no invited members
    //         cy.findByText('INVITED MEMBERS').should('not.exist');
    //     });
    // });
});
