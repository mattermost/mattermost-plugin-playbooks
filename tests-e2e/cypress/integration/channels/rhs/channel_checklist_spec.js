// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('channels > rhs > channel_checklist', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

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

    // // # Switch to clean display mode
    // cy.apiSaveMessageDisplayPreference('clean');

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to task list without scrolling issues
        cy.viewport('macbook-13');
    });

    describe('rhs stuff', () => {
        beforeEach(() => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Open playbooks RHS.
            cy.getPlaybooksAppBarIcon().should('be.visible').click();
        });

        it('creates channel checklist', () => {
            // # Click create new button
            cy.findByTestId('rhs-runs-create-new').click();

            // # Click start a run button
            cy.findByTestId('rhs-runlist-start-checklist').click();

            // * Verify checklist title
            cy.findByText('Untitled checklist').should('exist');

            // # Type a name
            cy.findByTestId('checklist-item-textarea-title').type('task name');

            // # Save task
            cy.findByTestId('checklist-item-save-button').click();

            // * Verify no section
            cy.findByText('Section 1').should('not.exist');

            // # Click on the button to add a section
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('add-a-section-button').click();
            });

            // # Type a title and click on the Add button
            const title = 'Section - ' + Date.now();
            cy.findByTestId('checklist-title-input').type(title);
            cy.findByTestId('checklist-item-save-button').click();

            // # Click on the button to add a section
            cy.get('#rhsContainer').within(() => {
                cy.findByText(title).should('exist');
            });

            // * Verify section 1 appeared
            cy.findByText('Section 1').should('exist');
        });
    });
});
