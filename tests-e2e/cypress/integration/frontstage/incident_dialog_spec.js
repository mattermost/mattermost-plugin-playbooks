// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident creation dialog', () => {
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

        // # Trigger the incident creation dialog
        cy.openIncidentDialogFromSlashCommand();

        // * Verify the incident creation dialog has opened
        cy.get('#interactiveDialogModal').should('be.visible').within(() => {
            cy.findByText('Incident Details').should('be.visible');
        });
    });

    it('cannot create without filling required fields', () => {
        cy.get('#interactiveDialogModal').within(() => {
            cy.findByText('Incident Details').should('be.visible');

            // # Attempt to submit
            cy.get('#interactiveDialogSubmit').click();
        });

        // * Verify it didn't submit
        cy.get('#interactiveDialogModal').should('be.visible');

        // * Verify required fields
        cy.findByTestId('autoCompleteSelector').contains('Playbook');
        cy.findByTestId('autoCompleteSelector').contains('This field is required.');
        cy.findByTestId('incidentName').contains('This field is required.');
    });

    it('shows create playbook link', () => {
        cy.get('#interactiveDialogModal').within(() => {
            // * Verify link is configured to open in a new window (for Desktop compatibility)
            cy.findByText('Create a playbook.').invoke('attr', 'target').should('equal', '_blank');

            // # Strip target attribute to enable Cypress testing.
            cy.findByText('Create a playbook.').invoke('removeAttr', 'target');

            // # Follow link
            cy.findByText('Create a playbook.').click();

            // * Verify it's the new playbook page
            cy.url().should('include', '/com.mattermost.plugin-incident-response/playbooks/new');
        });
    });

    it('shows expected metadata', () => {
        cy.get('#interactiveDialogModal').within(() => {
            // * Shows current user as commander.
            cy.findByText('Victor Welch').should('be.visible');

            // * Verify playbook dropdown prompt
            cy.findByText('Playbook').should('be.visible');

            // * Verify channel name prompt
            cy.findByText('Channel Name').should('be.visible');
        });
    });

    it('is canceled when cancel is clicked', () => {
        // # Populate the interactive dialog
        const incidentName = 'New Incident' + Date.now();
        cy.get('#interactiveDialogModal').within(() => {
            cy.findByTestId('incidentNameinput').type(incidentName, {force: true});
        });

        // # Cancel the interactive dialog
        cy.get('#interactiveDialogCancel').click();

        // * Verify the modal is no longer displayed
        cy.get('#interactiveDialogModal').should('not.be.visible');

        // * Verify the incident did not get created
        cy.apiGetAllIncidents().then((response) => {
            const allIncidents = JSON.parse(response.body);
            const incident = allIncidents.items.find((inc) => inc.name === incidentName);
            expect(incident).to.be.undefined;
        });
    });
});
