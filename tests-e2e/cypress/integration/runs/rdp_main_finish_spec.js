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
    describe.skip('finish run', () => {
        // wait for merge
        it('can be confirmed', () => {
            // * Click finish run button
            cy.findByTestId('run-finish-section').find('button').click();

            // # Check that finish run modal is open
            cy.get('#confirmModal').should('be.visible');
            cy.get('#confirmModal').find('h1').contains('Confirm finish run');

            // * Click on confirm
            cy.get('#confirmModal').get('#confirmModalButton').click();

            // * Open dropdown
            cy.findByTestId('run-header-section').find('h1').click();

            // # Assert option is not anymore in context dropdown
            // getDropdownItemByText('Finish run').should('not.exist');

            // TODO: assert badge with status
        });

        it('can be canceled', () => {
            // * Open dropdown
            cy.findByTestId('run-header-section').find('h1').click();

            // * Click on finish run
            getDropdownItemByText('Finish run').click();

            // # Check that finish run modal is open
            cy.get('#confirmModal').should('be.visible');
            cy.get('#confirmModal').find('h1').contains('Confirm finish run');

            // * Click on cancel
            cy.get('#confirmModal').get('#cancelModalButton').click();

            // * Open dropdown
            cy.findByTestId('run-header-section').find('h1').click();

            // # Assert option is not anymore in context dropdown
            getDropdownItemByText('Finish run').should('be.visible');

            // TODO: assert badge with status
        });
    });
});
