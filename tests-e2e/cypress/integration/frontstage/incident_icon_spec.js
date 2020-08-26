// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident icon in channel header', () => {
    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin('user-1');
    });

    it('toggles the incident RHS', () => {
        // # Size the viewport to show plugin icons even when RHS is open
        cy.viewport('macbook-13');

        // # Navigate to the application
        cy.visit('/');

        // # Click the incident icon
        cy.get('#channel-header').within(() => {
            cy.get('#incidentIcon').should('be.visible').click();
        });

        // * Verify the incident RHS is open.
        cy.get('#rhsContainer').should('be.visible').within(() => {
            cy.findByText('Incident').should('be.visible');
        });

        // # Click the incident icon again
        cy.get('#channel-header').within(() => {
            cy.get('#incidentIcon').should('be.visible').click();
        });

        // * Verify the incident RHS is no longer open.
        cy.get('#rhsContainer').should('not.be.visible');
    });
});
