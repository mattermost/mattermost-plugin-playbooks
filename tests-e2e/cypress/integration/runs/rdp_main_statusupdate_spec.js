// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('runs > run details page > status update', () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // Create another user in the same team
            cy.apiCreateUser().then(({user: viewer}) => {
                testViewerUser = viewer;
                cy.apiAddUserToTeam(testTeam.id, testViewerUser.id);
            });

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
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName: 'the run name',
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            testRun = playbookRun;

            // # Visit the playbook run
            cy.visit(`/playbooks/run_details/${playbookRun.id}`);
        });
    });

    describe('participant', () => {
        it('is visible', () => {
            // # Verify the status update section is present
            cy.findByTestId('run-statusupdate-section').should('be.visible');
        });

        it('has no title', () => {
            // # Verify the title
            cy.findByTestId('run-statusupdate-section').find('h3').should('not.exist');
        });

        describe('post update', () => {
            it('button disappears if we finish the run', () => {
                // # Check that post update button is visible
                cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').should('be.visible');

                // * Click finish button and confirm modal
                cy.findByTestId('run-finish-section').find('button').click();
                cy.get('#confirmModal').get('#confirmModalButton').click();

                // # Check that post update button does not exsit anymore
                cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').should('not.exist');
            });

            it('button triggers post udpate modal', () => {
                // # Check due date
                cy.findByTestId('update-due-date-text').contains('Update due');
                cy.findByTestId('update-due-date-time').contains('in 24 hours');

                // * Click post update
                cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').click();

                // # Assert modal is opened
                cy.getStatusUpdateDialog().should('be.visible');

                // * Write message
                cy.findByTestId('update_run_status_textbox').clear().type('my nice update');
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('input').type('15 minutes', {delay: 200, force: true}).type('{enter}', {force: true});
                });

                // * Post update
                cy.getStatusUpdateDialog().findByTestId('modal-confirm-button').click();

                // # Check new due date
                cy.findByTestId('update-due-date-text').contains('Update due');
                cy.findByTestId('update-due-date-time').contains('in 15 minutes');
            });
        });
    });

    describe('viewer', () => {
        beforeEach(() => {
            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/run_details/${testRun.id}`);
            });
        });

        it('is visible', () => {
            // # Verify the status update section is present
            cy.findByTestId('run-statusupdate-section').should('be.visible');
        });

        it('has a title', () => {
            // # Verify the title
            cy.findByTestId('run-statusupdate-section').find('h3').contains('Recent status update');
        });

        it('has placeholder', () => {
            // # Verify the placeholder
            cy.findByTestId('run-statusupdate-section').find('i').contains('No updates have been posted yet');
        });

        it('has a due date', () => {
            // # Verify the due date
            cy.findByTestId('update-due-date-text').contains('Update due');
            cy.findByTestId('update-due-date-time').contains('in 24 hours');
        });

        it('shows the most recent update', () => {
            // * Login as participant
            cy.apiLogin(testUser).then(() => {
                cy.visit(`/playbooks/run_details/${testRun.id}`);
            });

            // * Click post update
            cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').click();

            // # Assert modal is opened
            cy.getStatusUpdateDialog().should('be.visible');

            // * Write message
            cy.findByTestId('update_run_status_textbox').clear().type('my nice update');
            cy.get('#reminder_timer_datetime').within(() => {
                cy.get('input').type('15 minutes', {delay: 200, force: true}).type('{enter}', {force: true});
            });

            // * Post update
            cy.getStatusUpdateDialog().findByTestId('modal-confirm-button').click();

            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/run_details/${testRun.id}`);

                // # Check new due date
                cy.findByTestId('update-due-date-text').contains('Update due');
                cy.findByTestId('update-due-date-time').contains('in 15 minutes');

                // # Assert the recent updated text
                cy.findByTestId('run-statusupdate-section').contains('my nice update');
            });
        });
    });
});
