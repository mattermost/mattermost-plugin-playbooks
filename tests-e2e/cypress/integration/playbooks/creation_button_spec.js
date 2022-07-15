// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbooks > creation button', () => {
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
            // # Creating this playbook ensures the list view
            // # specifically is shown in the backstage content section.
            // # Without it there is a brief flicker from the list view
            // # to the no content view, which causes some flake
            // # on clicking the 'Create playbook' button
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
        const playbookName = 'Untitled Playbook';

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'New Playbook' button
        cy.findByTestId('titlePlaybook').findByText('Create playbook').click();
        cy.get('#playbooks_create').findByText('Create playbook').click();

        // * Verify playbook outline page opened
        verifyPlaybookOutlineOpened(playbookName);
    });

    it('auto creates a playbook with "Blank" template option', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Blank'
        cy.findByText('Blank').click();

        // * Verify playbook outline opened
        verifyPlaybookOutlineOpened(`@${testUser.username}'s Blank`);
    });

    it('opens Service Outage Incident page from its template option', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Incident Resolution'
        cy.findByText('Incident Resolution').click();

        // * Verify playbook outline opened
        verifyPlaybookOutlineOpened(`@${testUser.username}'s Incident Resolution`);
    });
});

function verifyPlaybookOutlineOpened(playbookName) {
    // * Verify the page url contains 'playbooks/playbooks/new'
    cy.url().should('contain', '/outline');

    // * Verify the playbook name matches the one provided
    cy.findByTestId('playbook-editor-title').within(() => {
        cy.findByText(playbookName).should('be.visible');
    });
}
