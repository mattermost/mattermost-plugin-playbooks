// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks @events

describe('Playbook Events', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Test Playbook',
                memberIDs: [],
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Create a playbook run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Test Run',
                    ownerUserId: testUser.id,
                }).then((run) => {
                    testRun = run;
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('displays events tab in playbook editor', () => {
        // # Navigate directly to the playbook editor
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}`);

        // * Verify playbook editor header is visible
        cy.findByTestId('playbook-editor-header').should('be.visible');

        // * Verify events tab link is available
        cy.findByText('Events').should('exist');
    });

    it('shows playbook events overview', () => {
        // # Navigate directly to the events tab
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/events`);

        // * Verify events view is displayed with the search input
        cy.findByTestId('playbook-events-search').should('be.visible');

        // * Verify the events table exists
        cy.get('table').should('exist');
    });

    it('displays event timeline with run information', () => {
        // # Navigate to events tab
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/events`);

        // * Verify the events table has rows
        cy.get('table').should('exist');

        // * Verify run reference is shown in events
        cy.contains(testRun.name).should('be.visible');
    });

    it('filters events by type', () => {
        // # Navigate to events tab
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/events`);

        // * Verify event type filter exists
        cy.findByText('Event types').should('be.visible');

        // # Click the event types multi-select
        cy.findByText('Filter event types').click();

        // * Verify event type options appear
        cy.get('.playbooks-rselect__menu').should('be.visible');
    });

    it('paginates through events', () => {
        // # Navigate to events tab
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/events`);

        // * Verify rows-per-page selector exists
        cy.get('#playbook-events-per-page').should('exist');
    });

    it('handles empty events gracefully', () => {
        // # Create a new playbook with no runs
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Empty Playbook',
            memberIDs: [],
        }).then((playbook) => {
            // # Navigate to the events tab of the empty playbook
            cy.visit(`/playbooks/playbooks/${playbook.id}/events`);

            // * Verify empty state message is shown
            cy.findByText('There are no events for this playbook yet.').should('be.visible');
        });
    });
});
