// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident rhs > header', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                // # Create a playbook
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

    describe('shows status', () => {
        it('when ongoing', () => {
            // # Start the incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName,
                commanderUserId: userId,
            });

            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify the title shows "Ongoing"
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Ongoing');
            });
        });

        it('when ended', () => {
            // # Start the incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName,
                commanderUserId: userId,
            }).then((incident) => {
                // # End the incident
                cy.apiDeleteIncident(incident.id);
            });

            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify the title shows "Ended"
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Ended');
            });
        });

        it('for an incident with a long title name', () => {
            // # Start the incident
            const now = Date.now();
            const incidentName = 'Incident with a really long name (' + now + ')';
            const incidentChannelName = 'incident-with-a-really-long-name-' + now;
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName,
                commanderUserId: userId,
            });

            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify the title shows "Ongoing"
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Ongoing');
            });
        });
    });
});
