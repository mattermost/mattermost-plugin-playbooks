// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import users from '../../fixtures/users.json';

describe('playbook overview', () => {
    let testTeam;
    let testUser;
    let testPublicPlaybook;
    let testPrivateOnlyMinePlaybook;
    let testPrivateSharedPlaybook;

    before(() => {
        // # Turn off growth onboarding screens
        cy.apiLogin(users.sysadmin);
        cy.apiUpdateConfig({
            ServiceSettings: {EnableOnboardingFlow: false},
        });

        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create another user
            cy.apiCreateUser().then(({user: anotherUser}) => {
                // # Login as testUser
                cy.apiLogin(testUser);

                // # Create a public playbook
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Public Playbook',
                    memberIDs: [],
                }).then((playbook) => {
                    testPublicPlaybook = playbook;
                });

                // # Create a private playbook with only the current user
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Private Only Mine Playbook',
                    memberIDs: [testUser.id],
                }).then((playbook) => {
                    testPrivateOnlyMinePlaybook = playbook;
                });

                // # Create a private playbook with multiple users
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Private Shared Playbook',
                    memberIDs: [testUser.id, anotherUser.id],
                }).then((playbook) => {
                    testPrivateSharedPlaybook = playbook;
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('permissions text', () => {
        it('should describe public playbooks', () => {
            // # Navigate directly to the playbook
            cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);

            // # Verify permissions icon
            cy.findByTestId('playbookPermissionsDescription').within(() => {
                cy.get('.icon-globe').should('be.visible');
            });

            // # Verify permissions text
            cy.findByTestId('playbookPermissionsDescription').contains(`Everyone in ${testTeam.name} can access this playbook`);
        });

        it('should describe playbooks private only to the current user', () => {
            // # Navigate directly to the playbook
            cy.visit(`/playbooks/playbooks/${testPrivateOnlyMinePlaybook.id}`);

            // # Verify permissions icon
            cy.findByTestId('playbookPermissionsDescription').within(() => {
                cy.get('.icon-lock-outline').should('be.visible');
            });

            // # Verify permissions text
            cy.findByTestId('playbookPermissionsDescription').contains('Only you can access this playbook');
        });

        it('should describe playbooks private to multiple users', () => {
            // # Navigate directly to the playbook
            cy.visit(`/playbooks/playbooks/${testPrivateSharedPlaybook.id}`);

            // # Verify permissions icon
            cy.findByTestId('playbookPermissionsDescription').within(() => {
                cy.get('.icon-lock-outline').should('be.visible');
            });

            // # Verify permissions text
            cy.findByTestId('playbookPermissionsDescription').contains('2 people can access this playbook');
        });
    });
});
