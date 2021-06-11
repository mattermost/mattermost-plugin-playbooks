// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbook run creation dialog', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Create a playbook
        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;

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
        cy.visit('/ad-1/');

        // # Trigger the playbook run creation dialog
        cy.openPlaybookRunDialogFromSlashCommand();

        // * Verify the playbook run creation dialog has opened
        cy.get('#interactiveDialogModal').should('exist').within(() => {
            cy.findByText('Run details').should('exist');
        });
    });

    it('cannot create a playbook run without filling required fields', () => {
        cy.get('#interactiveDialogModal').within(() => {
            cy.findByText('Run details').should('exist');

            // # Attempt to submit
            cy.get('#interactiveDialogSubmit').click();
        });

        // * Verify it didn't submit
        cy.get('#interactiveDialogModal').should('exist');

        // * Verify required fields
        cy.findByTestId('autoCompleteSelector').contains('Playbook');
        cy.findByTestId('autoCompleteSelector').contains('This field is required.');
        cy.findByTestId('playbookRunName').contains('This field is required.');
    });

    it('shows create playbook link', () => {
        cy.get('#interactiveDialogModal').within(() => {
            // # Follow link
            cy.findByText('Click here').click();

            // * Verify it's the new playbook page
            cy.url().should('include', '/com.mattermost.plugin-incident-management/playbooks/new');
        });
    });

    it('shows expected metadata', () => {
        cy.get('#interactiveDialogModal').within(() => {
            // * Shows current user as owner.
            cy.findByText('Victor Welch').should('exist');

            // * Verify playbook dropdown prompt
            cy.findByText('Playbook').should('exist');

            // * Verify playbook run name prompt
            cy.findByText('Run name').should('exist');
        });
    });

    it('is canceled when cancel is clicked', () => {
        // # Populate the interactive dialog
        const playbookRunName = 'New Run' + Date.now();
        cy.get('#interactiveDialogModal').within(() => {
            cy.findByTestId('playbookRunNameinput').type(playbookRunName, {force: true});
        });

        // # Cancel the interactive dialog
        cy.get('#interactiveDialogCancel').click();

        // * Verify the modal is no longer displayed
        cy.get('#interactiveDialogModal').should('not.exist');

        // * Verify the playbook run did not get created
        cy.apiGetAllPlaybookRuns(teamId).then((response) => {
            const allPlaybookRuns = response.body;
            const playbookRun = allPlaybookRuns.items.find((inc) => inc.name === playbookRunName);
            expect(playbookRun).to.be.undefined;
        });
    });
});
