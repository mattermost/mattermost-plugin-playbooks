// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbooks > list', () => {
    const playbookTitle = 'The Playbook Name';
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
                title: playbookTitle,
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

    it('join/leave playbook', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on the dot menu
        cy.findByTestId('menuButtonActions').click();

        // # Click on leave
        cy.findByText('Leave').click();

        // * Verify it has disappeared from the LHS
        cy.findByTestId('lhs-navigation').findByText(playbookTitle).should('not.exist');

        // # Join a playbook
        cy.findByTestId('join-playbook').click();

        // * Verify it has appeared in LHS
        cy.findByTestId('lhs-navigation').findByText(playbookTitle).should('exist');
    });

    it('can duplicate playbook', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on the dot menu
        cy.findByTestId('menuButtonActions').click();

        // # Click on duplicate
        cy.findByText('Duplicate').click();

        // * Verify that playbook got duplicated
        cy.findByText('Copy of ' + playbookTitle).should('exist');
    });

    context('archived playbooks', () => {
        it('does not show them by default', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // * Assert the archived playbook is not there.
            cy.findAllByTestId('playbook-title').should((titles) => {
                expect(titles).to.have.length(2);
            });
        });
        it('shows them upon click on the filter', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // # Click the With Archived button
            cy.findByTestId('with-archived').click();

            // * Assert the archived playbook is there.
            cy.findAllByTestId('playbook-title').should((titles) => {
                expect(titles).to.have.length(3);
            });
        });
    });
});
