// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('api > settings', () => {
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({user}) => {
            testUser = user;
        });
    });

    describe('settings', () => {
        const getSettings = () => {
            return cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: '/plugins/playbooks/api/v0/settings',
                method: 'GET',
            }).then((response) => {
                expect(response.status).to.equal(200);
                return cy.wrap(response.body);
            });
        };

        it('should return true for flag link_run_to_existing_channel_enabled when enabled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable feature flag
            cy.apiEnsureFeatureFlag('linkruntoexistingchannelenabled', true);

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Verify feature flag
            getSettings().then((settings) => {
                expect(settings.link_run_to_existing_channel_enabled).to.equal(true);
            });
        });

        it('should still return true for flag link_run_to_existing_channel_enabled when disabled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable feature flag
            cy.apiEnsureFeatureFlag('linkruntoexistingchannelenabled', false);

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Verify feature flag
            getSettings().then((settings) => {
                expect(settings.link_run_to_existing_channel_enabled).to.equal(true);
            });
        });
    });
});
