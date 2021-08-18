// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

const BACKSTAGE_LIST_PER_PAGE = 15;

import {HALF_SEC} from '../../fixtures/timeouts';

describe('backstage playbook run list', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;

    before(() => {
        // # Login as the sysadmin
        cy.legacyApiLogin('sysadmin');

        // # Create a new team for the welcome page test
        cy.legacyApiCreateTeam('team', 'Team').then(({team}) => {
            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.legacyApiAddUserToTeam(team.id, user.id);
            });
        });

        // # Create a new team for the welcome page test when filtering
        cy.legacyApiCreateTeam('team', 'Team With No Active Playbook Runs').then(({team}) => {
            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.legacyApiAddUserToTeam(team.id, user.id);
            });

            // # Create a playbook
            cy.legacyApiGetCurrentUser().then((user) => {
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                });
            });
        });

        // # Login as user-1
        cy.legacyApiLogin('user-1');

        // # Create a playbook
        cy.legacyApiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.legacyApiGetCurrentUser().then((user) => {
                userId = user.id;

                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show all of the backstage.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.legacyApiLogin('user-1');
    });

    it('has "Runs" and team name in heading', () => {
        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId,
            playbookId,
            playbookRunName,
            ownerUserId: userId,
        });

        // # Open backstage
        cy.visit('/playbooks');

        // # Switch to playbook runs backstage
        cy.findByTestId('playbookRunsLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titlePlaybookRun').should('exist').contains('Runs');
    });

    it('loads playbook run details page when clicking on a playbook run', () => {
        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId,
            playbookId,
            playbookRunName,
            ownerUserId: userId,
        });

        // # Open backstage
        cy.visit('/playbooks');

        // # Switch to playbook runs backstage
        cy.findByTestId('playbookRunsLHSButton').click();

        // # Find the playbook run and click to open details view
        cy.get('#playbookRunList').within(() => {
            cy.findByText(playbookRunName).click();
        });

        // * Verify that the header contains the playbook run name
        cy.findByTestId('playbook-run-title').contains(playbookRunName);
    });

    describe('resets pagination when filtering', () => {
        const playbookRunTimestamps = [];

        before(() => {
            // # Login as user-1
            cy.legacyApiLogin('user-1');

            // # Start sufficient playbook runs to ensure pagination is possible.
            for (let i = 0; i < BACKSTAGE_LIST_PER_PAGE + 1; i++) {
                const now = Date.now();
                cy.apiRunPlaybook({
                    teamId,
                    playbookId,
                    playbookRunName: 'Playbook Run (' + now + ')',
                    ownerUserId: userId,
                });
                playbookRunTimestamps.push(now);
            }
        });

        beforeEach(() => {
            // # Login as user-1
            cy.legacyApiLogin('user-1');

            // # Open backstage
            cy.visit('/playbooks');

            // # Switch to playbook runs backstage
            cy.findByTestId('playbookRunsLHSButton').click();

            // # Switch to page 2
            cy.findByText('Next').click();

            // * Verify "Previous" now shown
            cy.findByText('Previous').should('exist');
        });

        it('by playbook run name', () => {
            // # Search for a playbook run by name
            cy.get('#playbookRunList input').type(playbookRunTimestamps[0]);

            // # Wait for the playbook run list to update.
            cy.wait(HALF_SEC);

            // * Verify "Previous" no longer shown
            cy.findByText('Previous').should('not.exist');
        });

        it('by owner', () => {
            // # Expose the owner list
            cy.findByTestId('owner-filter').click();

            // # Find the list and chose the first owner in the list
            cy.get('.playbook-run-user-select__container')
                .find('.PlaybookRunProfile').first().parent().click({force: true});

            // # Wait for the playbook run list to update.
            cy.wait(HALF_SEC);

            // * Verify "Previous" no longer shown
            cy.findByText('Previous').should('not.exist');
        });
    });
});
