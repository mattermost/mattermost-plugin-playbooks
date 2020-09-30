// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('backstage playbook details', () => {
    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin('user-1');
        cy.visit('/');
    });

    it('redirects to not found error if the playbook is unknown', () => {
        // # Visit the URL of a non-existing playbook
        cy.visit('/ad-1/com.mattermost.plugin-incident-response/playbooks/an_unknown_id');

        // * Verify that the user has been redirected to the playbooks not found error page
        cy.url().should('include', '/ad-1/com.mattermost.plugin-incident-response/error?type=playbooks');
    });

    it('has playbook specific UI components', () => {
        // # Open backstage
        cy.openBackstage();

        // # Click 'New Playbook' button
        cy.findByText('New Playbook').should('be.visible').click().wait(TIMEOUTS.TINY);

        cy.url().should('include', `playbooks/new`);

        // * Header should have left arrow, playbook name, description and Save button
        cy.findByTestId('backstage-nav-bar').should('be.visible').within(() => {
            cy.findByTestId('icon-arrow-left').should('be.visible');
            cy.get('#playbook-name').should('be.visible');
            cy.get('#playbook-description').should('be.visible');
            cy.findByTestId('save_playbook').should('be.visible');
        });
        
        // * Page should have Stages and Tasks
        cy.findByText('Stages and Tasks').should('be.visible');
        cy.findByText('New Task').should('be.visible');
        cy.findByText('New Stage').should('be.visible');

        // * RHS should have channel settings and playbook share option
        cy.findByTestId('playbook-sidebar').should('be.visible').within(() => {
            cy.findByText('Incident channel').should('be.visible');
            cy.findByText('Public').should('be.visible');
            cy.findByText('Private').should('be.visible');
            cy.findByText('Share Playbook').should('be.visible');
            cy.findByText('Add People').should('be.visible');
        });
        
    });
});
