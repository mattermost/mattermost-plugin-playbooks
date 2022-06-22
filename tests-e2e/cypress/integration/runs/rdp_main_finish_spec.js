// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('runs > run details page > finish', () => {
    let testTeam;
    let testUser;
    let testPublicPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

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
            // # Visit the playbook run
            cy.visit(`/playbooks/run_details/${playbookRun.id}`);
        });
    });

    it('is visible', () => {
        // * Verify the tasks section is present
        cy.findByTestId('run-finish-section').should('be.visible');
    });

    it('has a placeholder visible', () => {
        // * Verify the tasks section is present
        cy.findByTestId('run-finish-section').contains('Time to wrap up?');
    });
    describe.only('finish run', () => {
        // wait for merge
        it('can be confirmed', () => {
            // * Click finish run button
            cy.findByTestId('run-finish-section').find('button').click();

            // # Check that status badge is in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // # Check that finish run modal is open
            cy.get('#confirmModal').should('be.visible');
            cy.get('#confirmModal').find('h1').contains('Confirm finish run');

            // * Click on confirm
            cy.get('#confirmModal').get('#confirmModalButton').click();

            // # Assert finish section is not visible anymore
            cy.findByTestId('run-finish-section').should('not.exist');

            // assert status badge is finished
            cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');
        });

        it('can be canceled', () => {
            // * Click on finish run
            cy.findByTestId('run-finish-section').find('button').click();

            // # Check that status badge is in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // # Check that finish run modal is open
            cy.get('#confirmModal').should('be.visible');
            cy.get('#confirmModal').find('h1').contains('Confirm finish run');

            // * Click on cancel
            cy.get('#confirmModal').get('#cancelModalButton').click();

            // # Check that status badge is still in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // # Check that section is still visible
            cy.findByTestId('run-finish-section').should('be.visible');
        });
    });
});
