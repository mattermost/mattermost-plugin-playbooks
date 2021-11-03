// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

describe('playbook overview', () => {
    let testTeam;
    let testUser;
    let testPublicPlaybook;
    let testPrivateOnlyMinePlaybook;
    let testPrivateSharedPlaybook;

    before(() => {
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
            cy.findByTestId('playbookPermissionsDescription').contains(`Everyone in ${testTeam.display_name} can access this playbook`);
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

    it('should switch to channels and prompt to run when clicking run', () => {
        // # Navigate directly to the playbook
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);

        // # Click Run Playbook
        cy.findByTestId('run-playbook').click({force: true});

        // * Verify the playbook run creation dialog has opened
        cy.get('#interactiveDialogModal').should('exist').within(() => {
            cy.findByText('Start run').should('exist');
        });
    });
});
