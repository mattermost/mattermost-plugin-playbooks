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

    /**
     * Helper: navigate to a GM, open the RHS, create a checklist via UI.
     * Uses channel.name for navigation (GM routing requires name, not id).
     */
    const createChecklistInGM = (channel) => {
        cy.visit(`/${testTeam.name}/messages/${channel.name}`);
        cy.get('#post_textbox').should('exist');

        // # Open the Playbooks RHS
        cy.getPlaybooksAppBarIcon().should('exist').click();

        // * Verify the empty state appears
        cy.get('[data-testid="no-active-runs"]').should('be.visible');

        // # Click "New checklist" in the empty state
        cy.get('[data-testid="no-active-runs"]').find('[data-testid="create-blank-checklist"]').click();

        // * Verify RHS shows the checklist detail view
        cy.get('#rhsContainer').should('exist').within(() => {
            cy.findByText('Untitled checklist').should('be.visible');
            cy.findByText('Tasks').should('be.visible');
        });
    };

    // -----------------------------------------------------------
    // TC2: Create checklist in GM + add task
    // -----------------------------------------------------------
    it('can create a checklist in a GM and add a task', () => {
        // # Use a fresh GM to avoid prior state
        cy.apiCreateUser().then(({user: u1}) => {
            cy.apiAddUserToTeam(testTeam.id, u1.id);
            cy.apiCreateUser().then(({user: u2}) => {
                cy.apiAddUserToTeam(testTeam.id, u2.id);
                cy.apiCreateGroupChannel([testUser.id, u1.id, u2.id]).then(({channel}) => {
                    createChecklistInGM(channel);

                    // # Add a task
                    const taskText = 'GM task ' + Date.now();
                    cy.addNewTaskFromRHS(taskText);
                    cy.findByText(taskText).should('exist');
                });
            });
        });
    });

    // -----------------------------------------------------------
    // TC7: Task assignment in GM — shows channel members
    // -----------------------------------------------------------
    it('shows channel members in task assignee selector', () => {
        createChecklistInGM(gmChannel);

        // # Add a task
        const taskText = 'Assign GM ' + Date.now();
        cy.addNewTaskFromRHS(taskText);

        // # Hover over the task to reveal the menu
        cy.findByText(taskText).parents('[data-testid="checkbox-item-container"]').trigger('mouseover');

        // # Click edit to enter edit mode
        cy.findByTestId('hover-menu-edit-button').click();

        // # Click the assignee selector
        cy.findByTestId('assignee-profile-selector').click();

        // * Verify GM members appear in the dropdown
        cy.findByText(`@${gmPartner1.username}`).should('exist');
        cy.findByText(`@${gmPartner2.username}`).should('exist');
    });

    // -----------------------------------------------------------
    // AC4: Playbook run gate — rejects via API
    // -----------------------------------------------------------
    it('rejects playbook run creation in a GM via API', () => {
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Gated GM run ' + Date.now(),
            ownerUserId: testUser.id,
            channelId: gmChannel.id,
        }, {expectedStatusCode: 400});
    });

    // -----------------------------------------------------------
    // AC5: "Run a playbook" available in GM (modal gates DM/GM channels)
    // -----------------------------------------------------------
    it('"Run a playbook" is available in the GM channel dropdown', () => {
        // # Setup: create a fresh GM with 2 checklists via API so list view shows
        cy.apiCreateUser().then(({user: u1}) => {
            cy.apiAddUserToTeam(testTeam.id, u1.id);
            cy.apiCreateUser().then(({user: u2}) => {
                cy.apiAddUserToTeam(testTeam.id, u2.id);
                cy.apiCreateGroupChannel([testUser.id, u1.id, u2.id]).then(({channel}) => {
                    const ts = Date.now();
                    cy.apiRunPlaybook({teamId: '', playbookId: '', playbookRunName: 'A-' + ts, ownerUserId: testUser.id, channelId: channel.id});
                    cy.apiRunPlaybook({teamId: '', playbookId: '', playbookRunName: 'B-' + ts, ownerUserId: testUser.id, channelId: channel.id});

                    cy.visit(`/${testTeam.name}/messages/${channel.name}`);
                    cy.get('#post_textbox').should('exist');
                    cy.getPlaybooksAppBarIcon().should('exist').click();

                    // * Verify list view
                    cy.get('[data-testid="run-list-card"]').should('have.length.at.least', 2);

                    // # Open the create dropdown — chevron next to "New checklist"
                    cy.get('[data-testid="create-blank-checklist"]')
                        .parent()
                        .find('.icon-chevron-down')
                        .click({force: true});

                    // * Verify "Run a playbook" IS available
                    // (DM/GM gating happens in the run modal's channel selector, not here)
                    cy.get('[data-testid="create-from-playbook"]').should('exist');

                    // * Verify "Go to Playbooks" IS there
                    cy.get('[data-testid="go-to-playbooks"]').should('exist');
                });
            });
        });
    });
});
