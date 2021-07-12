// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('backstage playbook run details', () => {
    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin('user-1');
    });

    it('redirects to not found error if the playbook run is unknown', () => {
        // # Visit the URL of a non-existing playbook run
        cy.visit('/ad-1/com.mattermost.plugin-incident-management/runs/an_unknown_id');

        // * Verify that the user has been redirected to the playbook runs not found error page
        cy.url().should('include', '/ad-1/com.mattermost.plugin-incident-management/error?type=playbook_runs');
    });
});
