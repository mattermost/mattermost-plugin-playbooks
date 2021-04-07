// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident rhs', () => {
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

    describe('does not open', () => {
        it('when navigating to a non-incident channel', () => {
            // # Navigate to the application
            cy.visit('/');

            // # Select a channel without an incident.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Wait until the channel loads enough to show the post textbox.
            cy.get('#post-create').should('exist');

            // # Wait a bit longer to be confident.
            cy.wait(2000);

            // * Verify the incident RHS is not open.
            cy.get('#rhsContainer').should('not.exist');
        });

        it('when navigating to an incident channel with the RHS already open', () => {
            // # Navigate to the application.
            cy.visit('/');

            // # Select a channel without an incident.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Start the incident after loading the application
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName,
                commanderUserId: userId,
            });

            // # Open the flagged posts RHS
            cy.get('#channelHeaderFlagButton').click({force: true});

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click({force: true});

            // # Wait until the channel loads enough to show the post textbox.
            cy.get('#post-create').should('exist');

            // # Wait a bit longer to be confident.
            cy.wait(2000);

            // * Verify the incident RHS is not open.
            cy.get('#rhsContainer').should('not.exist');
        });
    });

    describe('opens', () => {
        it('when navigating directly to an ongoing incident channel', () => {
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

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');
            });
        });

        it('when navigating directly to a resolved incident channel', () => {
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
                    message: 'resolved',
                    description: 'description',
                    status: 'Resolved',
                });
            });

            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');
            });
        });

        it('when navigating directly to an archived incident channel', () => {
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
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });

            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');
            });
        });

        it('for a new, ongoing incident channel opened from the lhs', () => {
            // # Navigate to the application.
            cy.visit('/');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Select a channel without an incident.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Start the incident after loading the application
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName,
                commanderUserId: userId,
            });

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click({force: true});

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');
            });
        });

        it('for a new, resolved incident channel opened from the lhs', () => {
            // # Navigate to the application.
            cy.visit('/');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Select a channel without an incident.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Start the incident after loading the application
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
                    message: 'resolving',
                    description: 'description',
                    status: 'Resolved',
                });
            });

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click({force: true});

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');
            });
        });

        it('for a new, archived incident channel opened from the lhs', () => {
            // # Navigate to the application.
            cy.visit('/');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Select a channel without an incident.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Start the incident after loading the application
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
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click({force: true});

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');
            });
        });

        it('for an existing, ongoing incident channel opened from the lhs', () => {
            // # Start the incident before loading the application
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName,
                commanderUserId: userId,
            });

            // # Navigate to a channel without an incident.
            cy.visit('/ad-1/channels/off-topic');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click({force: true});

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');
            });
        });

        it('for an existing, resolved incident channel opened from the lhs', () => {
            // # Start the incident before loading the application
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
                    message: 'resolving',
                    description: 'description',
                    status: 'Resolved',
                });
            });

            // # Navigate to a channel without an incident.
            cy.visit('/ad-1/channels/off-topic');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click({force: true});

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');
            });
        });

        it('for an existing, archived incident channel opened from the lhs', () => {
            // # Start the incident before loading the application
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
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });

            // # Navigate to a channel without an incident.
            cy.visit('/ad-1/channels/off-topic');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click({force: true});

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');
            });
        });

        it('when starting an incident', () => {
            // # Navigate to the application and a channel without an incident
            cy.visit('/ad-1/channels/off-topic');

            // # Start an incident with a slash command
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';

            // const incidentChannelName = 'incident-' + now;
            cy.startIncidentWithSlashCommand(playbookName, incidentName);

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');
            });
        });
    });

    describe('is toggled', () => {
        it('by incident icon in channel header', () => {
            // # Size the viewport to show plugin icons even when RHS is open
            cy.viewport('macbook-13');

            // # Navigate to the application and a channel without an incident
            cy.visit('/ad-1/channels/off-topic');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Your Ongoing Incidents').should('exist');
            });

            // # Click the incident icon again
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });

            // * Verify the incident RHS is no longer open.
            cy.get('#rhsContainer').should('not.exist');
        });
    });
});
