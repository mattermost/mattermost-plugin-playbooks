// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('navigation', () => {
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
            }).then((playbook) => {
                cy.apiRunPlaybook({
                    teamId: team.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Playbook Run',
                    ownerUserId: user.id,
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Navigate to the application
        cy.visit(`/${testTeam.name}/`);
    });

    it('switches to playbooks list view via header button', () => {
        // # Open backstage
        cy.visit('/playbooks');

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // * Verify that playbooks are shown
        cy.findByTestId('titlePlaybook').should('exist').contains('Playbooks');
    });

    it('switches to playbook runs list view via header button', () => {
        // # Open backstage
        cy.visit('/playbooks');

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Switch to playbook runs backstage
        cy.findByTestId('playbookRunsLHSButton').click();

        // * Verify that playbook runs are shown
        cy.findByTestId('titlePlaybookRun').should('exist').contains('Runs');
    });
});
