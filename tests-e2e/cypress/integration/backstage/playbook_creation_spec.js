// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('playbook creation button', () => {
    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Create a playbook
        cy.apiGetTeamByName('ad-1').then((team) => {
            cy.apiGetCurrentUser().then((user) => {
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    userId: user.id,
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Navigate to a team without playbooks
        cy.visit('/ad-1');
    });

    it('opens playbook creation page with New Playbook button', () => {
        const url = 'com.mattermost.plugin-incident-response/playbooks/new';
        const playbookName = 'Untitled Playbook';

        // # Open backstage
        cy.openBackstage();

        // # Click 'New Playbook' button
        // TODO: This is brittle, since this button only shows up if there are no playbooks in the
        // team.
        cy.findByText('New Playbook').should('be.visible').click().wait(TIMEOUTS.TINY);

        // * Verify a new playbook creation page opened
        verifyPlaybookCreationPageOpened(url, playbookName);
    });

    it('opens playbook creation page with "Blank Playbook" template option', () => {
        const url = 'com.mattermost.plugin-incident-response/playbooks/new';
        const playbookName = 'Untitled Playbook';

        // # Open backstage
        cy.openBackstage();

        // # Click 'Blank Playbook'
        cy.findByText('Blank Playbook').should('be.visible').click().wait(TIMEOUTS.TINY);

        // * Verify a new playbook creation page opened
        verifyPlaybookCreationPageOpened(url, playbookName);
    });

    it('opens Incident Response Playbook page from its template option', () => {
        const url = 'playbooks/new?template_title=Incident%20Response%20Playbook';
        const playbookName = 'Incident Response Playbook';
        
        // # Open backstage
        cy.openBackstage();

        // # Click 'Incident Response Playbook'
        cy.findByText('Incident Response Playbook').should('be.visible').click().wait(TIMEOUTS.TINY);

        //Verify a new 'Incident Response Playbook' creation page is opened
        verifyPlaybookCreationPageOpened(url, playbookName);
    });
});

function verifyPlaybookCreationPageOpened(url, playbookName) {
    // * Verify the page url contains 'com.mattermost.plugin-incident-response/playbooks/new'
    cy.url().should('include', url);

    // * Verify the playbook name is 'Untitled Playbook'
    cy.get('#playbook-name').should('be.visible').within(() => {
        cy.findByText(playbookName).should('be.visible');
    });

    // * Verify there is 'Save' button
    cy.findByTestId('save_playbook').should('be.visible');
}
