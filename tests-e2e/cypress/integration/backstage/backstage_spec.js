// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('backstage', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Create a playbook
        cy.apiGetTeamByName('ad-1').then((team) => {
            cy.apiGetCurrentUser().then((user) => {
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Navigate to the application
        cy.visit('/');
    });

    it('opens playbooks list view by default', () => {
        // # Open the backstage
        cy.openBackstage();

        // * Verify that when backstage loads, the heading is visible and contains "Incident"
        cy.findByTestId('titlePlaybook').should('be.visible').contains('Playbooks');
    });

    it('switches to playbooks list view via header button', () => {
        // # Open backstage
        cy.openBackstage();

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // * Verify that playbooks are shown
        cy.findByTestId('titlePlaybook').should('be.visible').contains('Playbooks');
    });

    it('switches to incidents list view via header button', () => {
        // # Open backstage
        cy.openBackstage();

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // * Verify that incidents are shown
        cy.findByTestId('titleIncident').should('be.visible').contains('Incidents');
    });
    it('opens playbook creation page with New Playbook button', () => {
        // # Open backstage
        cy.openBackstage();

        // # Click 'New Playbook' button
        cy.findByText('New Playbook').should('be.visible').click().wait(TIMEOUTS.TINY);

        // * Verify a new playbook creation page opened:
        
        verifyPlaybookCreationPageOpened();
    });

    it('opens playbook creation page with "Blank Playbook" template option', () => {
        // # Open backstage
        cy.openBackstage();

        // # Click 'Blank Playbook'
        cy.findByText('Blank Playbook').should('be.visible').click().wait(TIMEOUTS.TINY);

        // * Verify a new playbook creation page opened
        verifyPlaybookCreationPageOpened();
    });

    it('opens Incident Response Playbook page from its template option', () => {
        // # Open backstage
        cy.openBackstage();

        // # Click 'Incident Response Playbook'
        cy.findByText('Incident Response Playbook').should('be.visible').click().wait(TIMEOUTS.TINY);

        // * Verify the page url contains 'Incident Response Playbook'
        cy.url().should('include', `playbooks/new?template_title=Incident%20Response%20Playbook`);

        // * Verify the playbook name is 'Incident Response Playbook'
        cy.get('#playbook-name').should('be.visible').within(() => {
            cy.findByText('Incident Response Playbook').should('be.visible');
        });
    });
});

function verifyPlaybookCreationPageOpened(template=false) {
    // * Verify the page url contains 'com.mattermost.plugin-incident-response/playbooks/new'
    cy.url().should('include', `com.mattermost.plugin-incident-response/playbooks/new`);

    // * Verify the playbook name is 'Untitled Playbook'
    cy.get('#playbook-name').should('be.visible').within(() => {
        cy.findByText('Untitled Playbook').should('be.visible');
    });

    // * Verify there is 'Save' button
    cy.findByTestId('save_playbook').should('be.visible');
}
