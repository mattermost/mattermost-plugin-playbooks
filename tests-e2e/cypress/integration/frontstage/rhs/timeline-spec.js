// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

describe('timeline', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let teamName;
    let userId;
    let playbookId;
    let incidentName;

    before(() => {
        // # Login as the sysadmin
        cy.apiLogin('sysadmin');

        // # Create a new team for the welcome page test
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            teamName = team.name;
            teamId = team.id;

            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });

            // # Add aaron.peterson to team
            cy.apiGetUserByEmail('user-7@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });

            // # Login as user-1
            cy.apiLogin('user-1');

            // # Create a playbook
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
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');

        // # Create a new incident
        const now = Date.now();
        incidentName = 'Incident (' + now + ')';
        const channelName = 'incident-' + now;
        cy.apiStartIncident({
            teamId,
            playbookId,
            incidentName,
            commanderUserId: userId,
        });

        // # Navigate directly to the application and the incident channel
        cy.visit(`/${teamName}/channels/${channelName}`);

        // # Add a second user
        cy.executeSlashCommand('/invite @aaron.peterson');

        // * Verify the incident RHS is open.
        cy.get('#rhsContainer').should('exist').within(() => {
            cy.findByText(incidentName).should('exist');

            // # Select the timeline tab
            cy.findByTestId('timeline').click();
        });
    });

    describe('the timeline', () => {
        it('shows the incident created, status updated, and commander changed events', () => {
            cy.findByTestId('timeline-view').within(() => {
                // * Verify incident created message is visible in the timeline
                cy.findAllByTestId('incident_created').should('have.length', 1);
                cy.findByTestId('incident_created')
                    .contains('Incident Reported by user-1')
                    .should('be.visible');
            });

            // # Post an update that doesn't change the incident status
            cy.updateStatus('this is a status update');

            // * Verify we can see the update in the timeline
            cy.findByTestId('timeline-view').within(() => {
                cy.findAllByTestId('status_updated').should('have.length', 1);
                cy.findByTestId('status_updated')
                    .contains('user-1 posted a status update')
                    .should('be.visible');
            });

            // # Change commander
            cy.executeSlashCommand('/incident commander @aaron.peterson');

            // * Verify we can see the change commander in the timeline
            cy.findByTestId('timeline-view').within(() => {
                cy.findAllByTestId('commander_changed').should('have.length', 1);
                cy.findByTestId('commander_changed')
                    .contains('Commander changed from @user-1 to @aaron.peterson')
                    .should('be.visible');
            });

            // # Post an update that changes the incident status
            cy.updateStatus('this is a status update', 0, 'Active');

            // * Verify we can see the update in the timeline
            cy.findByTestId('timeline-view').within(() => {
                cy.findAllByTestId('status_updated').should('have.length', 2);
                cy.findAllByTestId('status_updated').eq(1)
                    .contains('Reported to Active')
                    .should('be.visible');
            });

            // # Change commander
            cy.executeSlashCommand('/incident commander @user-1');

            // * Verify we can see the change commander in the timeline
            cy.findByTestId('timeline-view').within(() => {
                cy.findAllByTestId('commander_changed').should('have.length', 2);
                cy.findAllByTestId('commander_changed').eq(1)
                    .contains('changed from @aaron.peterson to @user-1')
                    .should('be.visible');
            });
        });
    });
});
