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
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');
    });

    describe('shows name', () => {
        it('of active incident', () => {
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

            // * Verify the title is displayed
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains(incidentName);
            });
        });

        it('of renamed incident', () => {
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

            // * Verify the existing title is displayed
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains(incidentName);
            });

            cy.apiGetChannelByName('ad-1', incidentChannelName).then(({channel}) => {
                // # Rename the channel
                cy.apiPatchChannel(channel.id, {
                    id: channel.id,
                    display_name: 'Updated',
                });
            });

            // * Verify the updated title is displayed
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Updated');
            });
        });
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

            // * Verify the title shows "Reported"
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Reported');
            });
        });

        it('when Resolved', () => {
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
                cy.apiUpdateStatus({
                    incidentId: incident.id,
                    userId,
                    teamId,
                    status: 'Resolved',
                });
            });

            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify the title shows "Resolved"
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Resolved');
            });
        });

        it('when Archived', () => {
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
                cy.apiUpdateStatus({
                    incidentId: incident.id,
                    userId,
                    teamId,
                    status: 'Archived',
                });
            });

            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify the title shows "Archived"
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Archived');
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
                cy.get('.sidebar--right__title').contains('Reported');
            });
        });
    });
});
