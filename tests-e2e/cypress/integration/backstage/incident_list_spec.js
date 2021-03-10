// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('backstage incident list', () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let teamId;
    let playbookId;
    let userId;

    before(() => {
        cy.apiInitSetup({createPlaybook: true}).then(({team, user, playbook}) => {
            testTeam = team;
            testUser = user;
            testPlaybook = playbook;
            teamId = team.id;
            playbookId = playbook.id;
            userId = user.id;
        });
    });

    beforeEach(() => {
        // # Login as test user
        cy.apiLogin(testUser);
    });

    it('shows welcome page when no incidents', () => {
        // # Navigate to a team with no incidents.
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open backstage
        cy.visit(`/${newTeam.name}/com.mattermost.plugin-incident-management`);

        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // * Assert welcome page title text.
        cy.get('#root').findByText('What are Incidents?').should('be.visible');
    });

    it('shows welcome page when no incidents, even when filtering', () => {
        // # Navigate to a filtered incident list on a team with no incidents.
        cy.visit(`/${newTeam.name}/com.mattermost.plugin-incident-management/incidents?status=Active`);

        // * Assert welcome page title text.
        cy.get('#root').findByText('What are Incidents?').should('be.visible');
    });

    it('does not show welcome page when filtering yields no incidents', () => {
        // # Start the incident
        const now = Date.now();
        const incidentName = 'Incident (' + now + ')';
        cy.apiStartIncident({
            teamId: newTeamWithNoActiveIncidents.id,
            playbookId,
            incidentName,
            commanderUserId: userId,
        });

        // # Navigate to a filtered incident list on a team with no active incidents.
        cy.visit(`/${newTeamWithNoActiveIncidents.name}/com.mattermost.plugin-incident-management/incidents?status=Active`);

        // * Assert welcome page is not visible.
        cy.get('#root').findByText('What are Incidents?').should('not.be.visible');

        // * Assert incident listing is visible.
        cy.findByTestId('titleIncident').should('exist').contains('Incidents');
        cy.findByTestId('titleIncident').contains(newTeamWithNoActiveIncidents.display_name);
    });

    it('New incident works when the backstage is the first page loaded', () => {
        // # Navigate to the incidents backstage of a team with no incidents.
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/incidents`);

        // # Make sure that the Redux store is empty
        cy.reload();

        // # Click on New Incident button
        cy.findByText('New Incident').click();

        // * Verify that we are in the centre channel view, out of the backstage
        cy.url().should('include', `/${testTeam.name}/channels`);

        // * Verify that the interactive dialog modal to create an incident is visible
        cy.get('#interactiveDialogModal').should('exist');
    });

    it('has "Incidents" and team name in heading', () => {
        // # Start the incident
        let incidentPrefix = "inc";
        cy.apiStartIncident(
            incidentPrefix,
            testUser.id,
            testTeam.id,
            playbookId
        );

        // # Navigate to the application
        cy.visit(`${testTeam.name}/`);

        // # Open backstage
        cy.visit('/ad-1/com.mattermost.plugin-incident-management');

        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titleIncident').should('exist').contains('Incidents');
        cy.findByTestId('titleIncident').contains(`${testTeam.display_name}`);
    });

    it('loads incident details page when clicking on an incident', () => {
        // # Start the incident
        let incidentPrefix = "inc";
        cy.apiStartIncident(
            incidentPrefix,
            userId,
            teamId,
            playbookId
        ).then(({incident}) => {

            // # Navigate to the application
            cy.visit(`${testTeam.name}/`);

            // # Open backstage
            cy.visit('/ad-1/com.mattermost.plugin-incident-management');

            // # Switch to incidents backstage
            cy.findByTestId('incidentsLHSButton').click();

            // # Find the incident `incident_backstage_1` and click to open details view
            cy.get('#incidentList').within(() => {
                cy.findByText(`${incident.name}`).click();
            });

            // * Verify that the header contains the incident name
            cy.findByTestId('incident-title').contains(`${incident.name}`);
        });
    });
});
