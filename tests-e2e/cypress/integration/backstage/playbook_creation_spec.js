// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbook creation button', () => {
    let testTeam;
    let testUser;
    let testUser2;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser().then(({user: user2}) => {
                testUser2 = user2;
                cy.apiAddUserToTeam(testTeam.id, testUser2.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
            });
        });
    });

    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin(testUser);

        // # Size the viewport to show playbooks without weird scrolling issues
        cy.viewport('macbook-13');
    });

    it('opens playbook creation page with New Playbook button', () => {
        const url = 'playbooks/new';
        const playbookName = 'Untitled playbook';

        // # Open backstage
        cy.visit('/playbooks');

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'New Playbook' button
        cy.findByText('Create playbook').click();

        // * Verify a new playbook creation page opened
        verifyPlaybookCreationPageOpened(url, playbookName);
    });

    it('opens playbook creation page with "Blank" template option', () => {
        const url = 'playbooks/new';
        const playbookName = 'Untitled playbook';

        // # Open backstage
        cy.visit('/playbooks');

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Blank'
        cy.findByText('Blank').click();

        // * Verify a new playbook creation page opened
        verifyPlaybookCreationPageOpened(url, playbookName);
    });

    it('opens Service Outage Incident page from its template option', () => {
        const url1 = 'playbooks/new?teamId=';
        const url2 = '&template_title=Service%20Reliability%20Incident';
        const playbookName = 'Service Reliability Incident';

        // # Open backstage
        cy.visit('/playbooks');

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Service Reliability Incident'
        cy.findByText('Service Reliability Incident').click();

        // * Verify a new 'Service Outage Incident' creation page is opened
        verifyPlaybookCreationPageOpened(url1, playbookName);
        verifyPlaybookCreationPageOpened(url2, playbookName);
    });

    it('shows remove beside members when > 1 member', () => {
        // # Open backstage
        cy.visit('/playbooks');

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Create playbook' button
        cy.findByText('Create playbook').click();

        // # Click 'Permissions' tab
        cy.findByText('Permissions').click();

        // # Click 'only selected users can access'
        cy.get('input[name="enabled"][value="enabled"]').click();

        // * Verify that there is no Remove link when there is one member
        cy.findAllByTestId('user-line').should('have.length', 1);
        cy.findAllByTestId('user-line').eq(0).within(() => {
            cy.get('a').should('not.exist');
        });

        // # Add a new user
        cy.get('.profile-autocomplete__input > input')
            .type(`${testUser2.username}`, {force: true, delay: 100}).wait(100)
            .type('{enter}');

        // * Verify that there is a Remove link when there is more than one member
        cy.findAllByTestId('user-line').should('have.length', 2);
        cy.findAllByTestId('user-line').eq(0).within(() => {
            cy.get('a').contains('Remove').should('exist');
        });
        cy.findAllByTestId('user-line').eq(1).within(() => {
            cy.get('a').contains('Remove').should('exist');
        });
    });
});

function verifyPlaybookCreationPageOpened(url, playbookName) {
    // * Verify the page url contains 'playbooks/playbooks/new'
    cy.url().should('include', url);

    // * Verify the playbook name matches the one provided
    cy.get('#playbook-name').within(() => {
        cy.findByText(playbookName).should('be.visible');
    });

    // * Verify there is 'Save' button
    cy.findByTestId('save_playbook').should('be.visible');
}
