// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > GM checklist', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let gmPartner1;
    let gmPartner2;
    let gmChannel;

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

            // # Create 2 GM partners and a GM channel
            cy.apiCreateUser().then(({user: u1}) => {
                gmPartner1 = u1;
                cy.apiAddUserToTeam(testTeam.id, gmPartner1.id);

                cy.apiCreateUser().then(({user: u2}) => {
                    gmPartner2 = u2;
                    cy.apiAddUserToTeam(testTeam.id, gmPartner2.id);

                    cy.apiCreateGroupChannel([testUser.id, gmPartner1.id, gmPartner2.id]).then(({channel}) => {
                        gmChannel = channel;
                    });
                });
            });
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    it('can create a checklist in a GM via the RHS', () => {
        // # Navigate to the GM channel (use channel name, not id — MM routes GMs by name)
        cy.visit(`/${testTeam.name}/messages/${gmChannel.name}`);
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
        const taskText = 'My GM task ' + Date.now();
        cy.addNewTaskFromRHS(taskText);

        // * Verify the task was added
        cy.findByText(taskText).should('exist');
    });

    it('rejects playbook run creation in a GM via API', () => {
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Gated GM run ' + Date.now(),
            ownerUserId: testUser.id,
            channelId: gmChannel.id,
        }, {expectedStatusCode: 400});
    });
});
