// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbooks > onboarding', () => {
    let testUserWithoutTeam;

    before(() => {
        cy.apiInitSetup().then(() => {
            cy.apiCreateUser().then(({user: userWithoutTeam}) => {
                testUserWithoutTeam = userWithoutTeam;
            });
        });
    });

    describe('should redirect to team selection', () => {
        it('on a fresh page load', () => {
            // # Login as testUserWithoutTeam
            cy.apiLogin(testUserWithoutTeam);

            // # Open the product
            cy.visit('/playbooks');

            // # Verify the redirection
            cy.url().should('include', '/select_team');
        });

        it('on redirect after login ', () => {
            // # Login as testUserWithoutTeam
            cy.apiLogin(testUserWithoutTeam);

            // # Open the product, redirecting to /playbooks after loading
            cy.visit('/login?redirect_to=%2Fplaybooks');

            // # Verify the redirection
            cy.url().should('include', '/select_team');
        });
    });
});

