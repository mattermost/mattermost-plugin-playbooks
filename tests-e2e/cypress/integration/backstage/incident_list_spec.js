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
    let newTeamName;
    let userId;
    let playbookId;

    before(() => {
        // # Login as the sysadmin
        cy.apiLogin('sysadmin');

        // # Create a new team for the welcome page test
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            newTeamName = team.name;

            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });
        });

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
        // # Size the viewport to show all of the backstage.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');
    });

    it('shows welcome page when no incidents', () => {
        // # Navigate to a team with no incidents.
        cy.visit(`/${newTeamName}/channels/town-square`);

        // # Open backstage
        cy.openBackstage();

        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // * Assert welcome page title text.
        cy.get('#root').findByText('What are Incidents?').should('be.visible');
    });

    it('New incident works when the backstage is the first page loaded', () => {
        // # Navigate to the incidents backstage of a team with no incidents.
        cy.visit(`/${newTeamName}/com.mattermost.plugin-incident-management/incidents`);

        // # Make sure that the Redux store is empty
        cy.reload();

        // # Click on New Incident button
        cy.findByText('New Incident').click();

        // * Verify that we are in the centre channel view, out of the backstage
        cy.url().should('include', `/${newTeamName}/channels`);

        // * Verify that the interactive dialog modal to create an incident is visible
        cy.get('#interactiveDialogModal').should('exist');
    });

    it('has "Incidents" and team name in heading', () => {
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

        // * Assert contents of heading.
        cy.findByTestId('titleIncident').should('exist').contains('Incidents');
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

        it.only('by commander', () => {
            // # Expose the commander list
            cy.findByTestId('commander-filter').click();

            // # Find the list and chose the first commander in the list
            cy.get('.incident-user-select__container')
                .find('.IncidentProfile').first().parent().click({force: true});

            // # Wait for the incident list to update.
            cy.wait(TINY);

            // * Verify "Previous" no longer shown
            cy.findByText('Previous').should('not.exist');
        });
    });
});
