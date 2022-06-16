// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {onlyOn} from '@cypress/skip-test';

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('channels > App Bar', () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let siteURL;
    let appBarEnabled;

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

            cy.apiGetConfig(true).then(({config}) => {
                siteURL = config.SiteURL;
                appBarEnabled = config.EnableAppBar === 'true';
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    const getAppBarImageSelector = () => `.app-bar .app-bar__icon-inner img[src="${siteURL}/plugins/playbooks/public/app-bar-icon.png"]`;

    describe('App Bar disabled', () => {
        it('should not show the Playbook App Bar icon', () => {
            onlyOn(!appBarEnabled);

            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * Verify App Bar icon is not showing
            cy.get('#channel_view').within(() => {
                cy.get(getAppBarImageSelector()).should('not.exist');
            });
        });
    });

    describe('App Bar enabled', () => {
        it('should show the Playbook App Bar icon', () => {
            onlyOn(appBarEnabled);

            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * Verify App Bar icon is showing
            cy.get('#channel_view').within(() => {
                cy.get(getAppBarImageSelector()).should('exist');
            });
        });

        describe('tooltip text', () => {
            it('should show "Toggle Playbook List" outside a playbook run channel', () => {
                onlyOn(appBarEnabled);

                // # Navigate directly to a non-playbook run channel
                cy.visit(`/${testTeam.name}/channels/town-square`);

                // # Hover over the channel header icon
                cy.get(getAppBarImageSelector()).trigger('mouseover');

                // * Verify tooltip text
                cy.findByRole('tooltip', {name: 'Toggle Playbook List'}).should('be.visible');
            });

            it('should show "Toggle Run Details" inside a playbook run channel', () => {
                onlyOn(appBarEnabled);

                // # Navigate directly to a playbook run channel
                cy.visit(`/${testTeam.name}/channels/playbook-run`);

                // # Hover over the channel header icon
                cy.get(getAppBarImageSelector()).trigger('mouseover');
                cy.wait(TIMEOUTS.HALF_SEC);

                // * Verify tooltip text
                cy.findByRole('tooltip', {name: 'Toggle Run Details'}).should('be.visible');
            });
        });
    });
});
