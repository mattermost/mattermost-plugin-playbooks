// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbook run rhs > header', () => {
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
        it('of active playbook run', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit('/ad-1/channels/' + playbookRunChannelName);

            // * Verify the title is displayed
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains(playbookRunName);
            });
        });

        it('of renamed playbook run', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit('/ad-1/channels/' + playbookRunChannelName);

            // * Verify the existing title is displayed
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains(playbookRunName);
            });

            cy.apiGetChannelByName('ad-1', playbookRunChannelName).then(({channel}) => {
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
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit('/ad-1/channels/' + playbookRunChannelName);

            // * Verify the title shows "Reported"
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Reported');
            });
        });

        it('when Resolved', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId,
                    teamId,
                    message: 'ending',
                    description: 'description',
                    status: 'Resolved',
                });
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit('/ad-1/channels/' + playbookRunChannelName);

            // * Verify the title shows "Resolved"
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Resolved');
            });
        });

        it('when Archived', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId,
                    teamId,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit('/ad-1/channels/' + playbookRunChannelName);

            // * Verify the title shows "Archived"
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Archived');
            });
        });

        it('for a playbook run with a long title name', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook run with a really long name (' + now + ')';
            const playbookRunChannelName = 'playbook-run-with-a-really-long-name-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit('/ad-1/channels/' + playbookRunChannelName);

            // * Verify the title shows "Ongoing"
            cy.get('#rhsContainer').within(() => {
                cy.get('.sidebar--right__title').contains('Reported');
            });
        });
    });
});
