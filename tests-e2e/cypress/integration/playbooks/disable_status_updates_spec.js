// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbook > edit > status update on/off', () => {
    let testTeam;
    let testUser;
    let testUser2;
    let testUser3;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

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

        describe('status updates enable / disabled', () => {
            it('is enabled in a new playbook', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Templates tab
                cy.get('#root').findByText('Templates').click();

                // * Verify that the toggle is checked
                cy.get('#status-updates label input').should('be.checked');
            });

            it('can be disabled', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Templates tab
                cy.get('#root').findByText('Templates').click();

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

                //TODO remove
                // cy.get('#status-updates label input').click({force: true});

                // * Verify that the update text is disabled
                cy.get('#status-update-text').within(() => {
                    cy.getStyledComponent('form-control custom-textarea custom-textarea--emoji-picker').contains('disabled')
                });  
/*
                // # Switch to Actions tab
                cy.get('#root').findByText('Actions').click();

                // * Verify that the toggle can't be checked 
                cy.get('#broadcast-channels').within(() => {
                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');

                    // # Click on the toggle to enable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });

                // * Verify that the toggle can't be checked 
                cy.get('#playbook-run-status-update__outgoing-webhook').within(() => {
                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');

                    // # Click on the toggle to enable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });

           */     
            });

            it('disabling status should disable when an update is posted actions', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Actions tab
                cy.get('#root').findByText('Actions').click();

                // # Switch to Templates tab
                cy.get('#root').findByText('Templates').click();

                cy.get('#status-updates').within(() => {
                    // * Verify that the toggle is checked
                    cy.get('label input').should('be.checked');

                    // # Click on the toggle to enable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });
            });
        });
    });
});
