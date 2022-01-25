// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbooks > list', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as user-1
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('has "Playbooks" in heading', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titlePlaybook').should('exist').contains('Playbooks');
    });

    it('can duplicate playbook', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on the dot menu
        cy.get('.icon-dots-horizontal').click();

        // # Click on duplicate
        cy.findByText('Duplicate').click();

        // * Verify that playbook got duplicated
        cy.findByText('Copy of Playbook').should('exist');
    });
});
