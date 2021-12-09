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

            // # Create an archived public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook archived',
                memberIDs: [],
            }).then(({id}) => cy.apiArchivePlaybook(id));
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

    context('archived playbooks', () => {
        it('does not show them by default', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // * Assert the archived playbook is not there.
            cy.findAllByTestId('playbook-title').should((titles) => {
                expect(titles).to.have.length(1);
                expect(titles.eq(0)).to.contain('Playbook');
            });
        });
        it('shows them upon click on the filter', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // # Click the With Archived button
            cy.findByTestId('with-archived').click();

            // * Assert the archived playbook is not there.
            cy.findAllByTestId('playbook-title').should((titles) => {
                expect(titles).to.have.length(2);
                expect(titles.eq(0)).to.contain('Playbook');
                expect(titles.eq(1)).to.contain('Playbook archived');
            });
        });
    });
});
