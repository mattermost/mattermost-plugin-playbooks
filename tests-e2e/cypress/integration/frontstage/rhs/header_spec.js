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
        cy.legacyApiLogin('user-1');

        cy.legacyApiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.legacyApiGetCurrentUser().then((user) => {
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
        cy.legacyApiLogin('user-1');
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
            cy.get('#rhsContainer').contains(playbookRunName);
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
            cy.get('#rhsContainer').contains(playbookRunName);

            cy.legacyApiGetChannelByName('ad-1', playbookRunChannelName).then(({channel}) => {
                // # Rename the channel
                cy.legacyApiPatchChannel(channel.id, {
                    id: channel.id,
                    display_name: 'Updated',
                });
            });

            // * Verify the updated title is displayed
            cy.get('#rhsContainer').contains(playbookRunName);
        });
    });
});
