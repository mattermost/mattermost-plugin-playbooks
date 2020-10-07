// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

const BACKSTAGE_LIST_PER_PAGE = 15;

import {TINY} from '../../fixtures/timeouts';

describe('backstage incident list', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Create a playbook
        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
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
        // # Login as user-1
        cy.apiLogin('user-1');
    });

    it('shows welcome page when no incidents', () => {
        // # Navigate to a team with no incidents.
        cy.visit('/reiciendis-0');

        // # Open backstage
        cy.openBackstage();

        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // * Assert welcome page title text.
        cy.get('#root').findByText('What are Incidents?').should('be.visible');
    });

    it('has "Incidents" and team name in heading', () => {
        // # Navigate to the application
        cy.visit('/ad-1');

        // # Open backstage
        cy.openBackstage();

        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titleIncident').should('be.visible').contains('Incidents');
        cy.findByTestId('titleIncident').contains('eligendi');
    });

    it('loads incident details page when clicking on an incident', () => {
        // # Start the incident
        const now = Date.now();
        const incidentName = 'Incident (' + now + ')';
        cy.apiStartIncident({
            teamId,
            playbookId,
            incidentName,
            commanderUserId: userId,
        });

        // # Navigate to the application
        cy.visit('/ad-1');

        // # Open backstage
        cy.openBackstage();

        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // # Find the incident `incident_backstage_1` and click to open details view
        cy.get('#incidentList').within(() => {
            cy.findByText(incidentName).click();
        });

        // * Verify that the header contains the incident name
        cy.findByTestId('incident-title').contains(incidentName);
    });

    describe('resets pagination when filtering', () => {
        const incidentTimestamps = [];

        before(() => {
            // # Login as user-1
            cy.apiLogin('user-1');

            // # Start sufficient incidents to ensure pagination is possible.
            for (let i = 0; i < BACKSTAGE_LIST_PER_PAGE + 1; i++) {
                const now = Date.now();
                cy.apiStartIncident({
                    teamId,
                    playbookId,
                    incidentName: 'Incident (' + now + ')',
                    commanderUserId: userId,
                });
                incidentTimestamps.push(now);
            }
        });

        beforeEach(() => {
            // # Login as user-1
            cy.apiLogin('user-1');

            // # Navigate to the application
            cy.visit('/ad-1');

            // # Open backstage
            cy.openBackstage();

            // # Switch to incidents backstage
            cy.findByTestId('incidentsLHSButton').click();

            // # Switch to page 2
            cy.findByText('Next').click();

            // * Verify "Previous" now shown
            cy.findByText('Previous').should('exist');
        });

        it('by incident name', () => {
            // # Search for an incident by name
            cy.get('#incidentList input').type(incidentTimestamps[0]);

            // # Wait for the incident list to update.
            cy.wait(TINY);

            // * Verify "Previous" no longer shown
            cy.findByText('Previous').should('not.exist');
        });

        it('by commander', () => {
            cy.get('.profile-dropdown').
                click().
                find('.IncidentProfile').first().parent().click({force: true});

            // # Wait for the incident list to update.
            cy.wait(TINY);

            // * Verify "Previous" no longer shown
            cy.findByText('Previous').should('not.exist');
        });

        it('by status', () => {
            cy.get('.status-filter-dropdown').click();
            cy.get('.status-filter-dropdown').findByText('Ongoing').parent().click();

            // # Wait for the incident list to update.
            cy.wait(TINY);

            // * Verify "Previous" no longer shown
            cy.findByText('Previous').should('not.exist');
        });
    });
});
