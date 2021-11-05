// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('channels > channel header', () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Start a playbook run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Playbook Run',
                    ownerUserId: testUser.id,
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('tooltip text', () => {
        it('should show "Toggle Playbook List" outside a playbook run channel', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Hover over the channel header icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').trigger('mouseover');
            });

            // # Verify tooltip text
            cy.get('#pluginTooltip').contains('Toggle Playbook List');
        });

        it('should show "Toggle Run Details" inside a playbook run channel', () => {
            // # Navigate directly to a playbook run channel
            cy.visit(`/${testTeam.name}/channels/playbook-run`);

            // # Hover over the channel header icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').trigger('mouseover');
            });

            // # Verify tooltip text
            cy.get('#pluginTooltip').contains('Toggle Run Details');
        });
    });
});
