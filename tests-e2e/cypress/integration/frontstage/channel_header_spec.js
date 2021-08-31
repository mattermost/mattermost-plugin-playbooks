// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

describe('channel header', () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Turn off growth onboarding screens
            cy.apiUpdateConfig({
                ServiceSettings: {EnableOnboardingFlow: false},
            });

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
        it('should show "Run Playbook" outside a playbook run channel', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Hover over the channel header icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').trigger('mouseover');
            });

            // # Verify tooltip text
            cy.get('#pluginTooltip').contains('Run Playbook');
        });

        it('should show "View Run Details" inside a playbook run channel', () => {
            // # Navigate directly to a playbook run channel
            cy.visit(`/${testTeam.name}/channels/playbook-run`);

            // # Hover over the channel header icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').trigger('mouseover');
            });

            // # Verify tooltip text
            cy.get('#pluginTooltip').contains('View Run Details');
        });
    });
});
