// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > DM checklist', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create a playbook (for gate test only)
            cy.apiCreatePlaybook({
                teamId: team.id,
                title: 'Gate Test Playbook',
                checklists: [{title: 'Stage 1', items: [{title: 'Step 1'}]}],
                memberIDs: [user.id],
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    it('can create a checklist in a DM via the RHS', () => {
        // # Setup: create a fresh DM partner
        cy.apiCreateUser().then(({user: dmPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, dmPartner.id);

            // # Navigate to the DM
            cy.visit(`/${testTeam.name}/messages/@${dmPartner.username}`);
            cy.get('#post_textbox').should('exist');

            // # Open the Playbooks RHS
            cy.getPlaybooksAppBarIcon().should('exist').click();

            // * Verify the empty state appears
            cy.get('[data-testid="no-active-runs"]').should('be.visible');

            // # Click "New checklist"
            cy.get('[data-testid="no-active-runs"]').find('[data-testid="create-blank-checklist"]').click();

            // * Verify RHS shows the checklist detail view
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Untitled checklist').should('be.visible');
                cy.findByText('Tasks').should('be.visible');
            });

            // # Add a task
            const taskText = 'My DM task ' + Date.now();
            cy.addNewTaskFromRHS(taskText);

            // * Verify the task was added
            cy.findByText(taskText).should('exist');
        });
    });

    it('can create a checklist in a self-DM via the RHS', () => {
        // # Navigate to self-DM
        cy.visit(`/${testTeam.name}/messages/@${testUser.username}`);
        cy.get('#post_textbox').should('exist');

        // # Open the Playbooks RHS
        cy.getPlaybooksAppBarIcon().should('exist').click();

        // * Verify the empty state appears
        cy.get('[data-testid="no-active-runs"]').should('be.visible');

        // # Click "New checklist"
        cy.get('[data-testid="no-active-runs"]').find('[data-testid="create-blank-checklist"]').click();

        // * Verify RHS shows the checklist detail view
        cy.get('#rhsContainer').should('exist').within(() => {
            cy.findByText('Untitled checklist').should('be.visible');
            cy.findByText('Tasks').should('be.visible');
        });
    });

    it('rejects playbook run creation in a DM via API', () => {
        cy.apiCreateUser().then(({user: dmPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, dmPartner.id);
            cy.apiCreateDirectChannel([testUser.id, dmPartner.id]).then(({channel}) => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Gated DM run ' + Date.now(),
                    ownerUserId: testUser.id,
                    channelId: channel.id,
                }, {expectedStatusCode: 400});
            });
        });
    });
});
