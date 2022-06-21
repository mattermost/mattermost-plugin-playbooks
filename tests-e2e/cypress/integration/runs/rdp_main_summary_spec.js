// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('runs > run details page > summary', () => {
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

    // UnSkip after giorgi's merge
    it.skip('redirects to not found error if the playbook run is unknown', () => {
        // # Visit the URL of a non-existing playbook run
        cy.visit('/playbooks/run_details/an_unknown_id');

        // * Verify that the user has been redirected to the playbook runs not found error page
        cy.url().should('include', '/playbooks/error?type=playbook_runs');
    });

    it('is visible', () => {
        // * Verify the summary section is present
        cy.findByTestId('run-summary-section').should('be.visible');
    });

    it('has title', () => {
        // * Verify the summary section is present
        cy.findByTestId('run-summary-section').find('h3').contains('Summary');
    });

    it('has a placeholder', () => {
        // * Assert the placeholder content
        cy.findByTestId('run-summary-section').within(() => {
            cy.findByTestId('rendered-text').contains('Add a run summary');
        });
    });

    it('can be edited', () => {
        // * Mouseover the summary
        cy.findByTestId('run-summary-section').trigger('mouseover');

        cy.findByTestId('run-summary-section').within(() => {
            // * Click the edit icon
            cy.findByTestId('hover-menu-edit-button').click();

            // * Write a summary
            cy.findByTestId('editabletext-markdown-textbox1').clear().type('This is my new summary');

            // * Save changes
            cy.findByTestId('checklist-item-save-button').click();

            // * Assert that data has changed
            cy.findByTestId('rendered-text').contains('This is my new summary');
        });

        // * Assert last edition date is visible
        cy.findByTestId('run-summary-section').contains('Last edited');
    });

    it('can be canceled', () => {
        // * Mouseover the summary
        cy.findByTestId('run-summary-section').trigger('mouseover');

        cy.findByTestId('run-summary-section').within(() => {
            // * Click the edit icon
            cy.findByTestId('hover-menu-edit-button').click();

            // * Write a summary
            cy.findByTestId('editabletext-markdown-textbox1').clear().type('This is my new summary');

            // * Cancel changes
            cy.findByText('Cancel').click();

            // * Assert that data has changed
            cy.findByTestId('rendered-text').contains('Add a run summary');
        });

        // * Assert last edition date is visible
        cy.findByTestId('run-summary-section').should('not.contain', 'Last edited');
    });
});
