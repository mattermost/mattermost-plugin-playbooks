// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('backstage playbook list', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';

    before(() => {
        // # Login as user-1
        cy.legacyApiLogin('user-1');

        // # Create a playbook
        cy.legacyApiGetTeamByName('ad-1').then((team) => {
            cy.legacyApiGetCurrentUser().then((user) => {
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
        cy.legacyApiLogin('user-1');

        // # Navigate to the application
        cy.visit('/ad-1/');
    });

    it('has "Playbooks" in heading', () => {
        // # Open backstage
        cy.visit('/plug/com.mattermost.plugin-incident-management');

        // # Switch to Playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titlePlaybook').should('exist').contains('Playbooks');
    });
});
