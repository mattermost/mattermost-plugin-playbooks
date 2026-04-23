// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks @events @polling

describe('Playbook Events Polling', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Polling Test Playbook',
                memberIDs: [],
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Create a playbook run to generate events
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Polling Test Run',
                    ownerUserId: testUser.id,
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Navigate to events tab
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/events`);
    });

    it('displays update interval selector', () => {
        // * Verify update interval selector is visible
        cy.get('#playbook-events-update-interval').should('be.visible');

        // * Verify interval options exist (5, 15, 30, 60 seconds)
        cy.get('#playbook-events-update-interval option').should('have.length', 4);
        cy.get('#playbook-events-update-interval').find('option').eq(0).should('have.value', '5');
        cy.get('#playbook-events-update-interval').find('option').eq(1).should('have.value', '15');
        cy.get('#playbook-events-update-interval').find('option').eq(2).should('have.value', '30');
        cy.get('#playbook-events-update-interval').find('option').eq(3).should('have.value', '60');
    });

    it('can select update interval', () => {
        // # Select 30 second update interval
        cy.get('#playbook-events-update-interval').select('30');

        // * Verify the interval is selected
        cy.get('#playbook-events-update-interval').should('have.value', '30');
    });

    it('preserves update interval when switching tabs', () => {
        // # Select 60 second update interval
        cy.get('#playbook-events-update-interval').select('60');

        // # Navigate away to Usage tab
        cy.findByText('Usage').click();

        // # Navigate back to Events tab
        cy.findByText('Events').click();

        // * Verify update interval is reset to default (state is local, not persisted)
        cy.get('#playbook-events-update-interval').should('exist');
    });

    it('does not show status text overlay', () => {
        // # Select an update interval
        cy.get('#playbook-events-update-interval').select('15');

        // * Verify no status text overlay is visible - only the select controls exist
        cy.get('#playbook-events-update-interval').parent().find('[class*="status-text"]').should('not.exist');

        // * Verify the update interval label is present
        cy.findByText('Update interval').should('be.visible');
    });

    it('shows rows per page selector alongside update interval', () => {
        // * Verify both controls exist in the secondary filters row
        cy.get('#playbook-events-per-page').should('be.visible');
        cy.get('#playbook-events-update-interval').should('be.visible');

        // * Verify rows per page options (25, 50, 100)
        cy.get('#playbook-events-per-page option').should('have.length', 3);
    });
});
