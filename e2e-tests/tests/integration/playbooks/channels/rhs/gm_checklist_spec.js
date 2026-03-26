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

            // # Create 2 GM partners and a GM channel used across tests
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
     * Helper: create a fresh GM channel and create a checklist via UI.
     * Returns with the RHS showing the new checklist detail view.
     * Uses channel.name for navigation (GM routing requires name, not id).
     */
    const createChecklistInFreshGM = () => {
        // # Create fresh users so we get a clean GM
        cy.apiCreateUser().then(({user: u1}) => {
            cy.apiAddUserToTeam(testTeam.id, u1.id);
            cy.apiCreateUser().then(({user: u2}) => {
                cy.apiAddUserToTeam(testTeam.id, u2.id);
                cy.apiCreateGroupChannel([testUser.id, u1.id, u2.id]).then(({channel}) => {
                    cy.visit(`/${testTeam.name}/messages/${channel.name}`);
                    cy.get('#post_textbox').should('exist');

                    cy.getPlaybooksAppBarIcon().should('exist').click();
                    cy.get('[data-testid="no-active-runs"]').should('be.visible');
                    cy.get('[data-testid="no-active-runs"]').find('[data-testid="create-blank-checklist"]').click();

                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.findByText('Untitled checklist').should('be.visible');
                        cy.findByText('Tasks').should('be.visible');
                    });
                });
            });
        });
    };

    /**
     * Helper: create a checklist in the shared gmChannel via UI.
     */
    const createChecklistInGM = () => {
        cy.visit(`/${testTeam.name}/messages/${gmChannel.name}`);
        cy.get('#post_textbox').should('exist');

        cy.getPlaybooksAppBarIcon().should('exist').click();
        cy.get('[data-testid="no-active-runs"]').should('be.visible');
        cy.get('[data-testid="no-active-runs"]').find('[data-testid="create-blank-checklist"]').click();

        cy.get('#rhsContainer').should('exist').within(() => {
            cy.findByText('Untitled checklist').should('be.visible');
            cy.findByText('Tasks').should('be.visible');
        });
    };

    // -----------------------------------------------------------
    // TC2: Create checklist in GM
    // -----------------------------------------------------------
    it('can create a checklist in a GM via the RHS', () => {
        createChecklistInFreshGM();
    });

    // -----------------------------------------------------------
    // TC2 + AC2: Add a task and check it off
    // -----------------------------------------------------------
    it('can add a task and check it off in a GM checklist', () => {
        createChecklistInFreshGM();

        // # Add a new task
        const taskText = 'GM task ' + Date.now();
        cy.addNewTaskFromRHS(taskText);
        cy.findByText(taskText).should('exist');

        // # Check off the task
        cy.findByText(taskText).parents('[data-testid="checkbox-item-container"]').within(() => {
            cy.get('input[type="checkbox"]').click();
            cy.get('input[type="checkbox"]').should('be.checked');
        });
    });

    // -----------------------------------------------------------
    // TC4/AC2: Post status update via UI
    // -----------------------------------------------------------
    it('can post a status update in a GM checklist', () => {
        createChecklistInFreshGM();

        const updateMessage = 'GM status update ' + Date.now();
        cy.updateStatus(updateMessage, '60 min');

        cy.getLastPost().within(() => {
            cy.findByText(updateMessage).should('exist');
        });
    });

    // -----------------------------------------------------------
    // TC7: Task assignment shows GM channel members
    // -----------------------------------------------------------
    it('shows channel members in task assignee selector', () => {
        createChecklistInGM();

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
    // AC4: Playbook run creation accepted in GM via API
    // -----------------------------------------------------------
    it('allows playbook run creation in a GM via API', () => {
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'GM playbook run ' + Date.now(),
            ownerUserId: testUser.id,
            channelId: gmChannel.id,
        });
    });

    // -----------------------------------------------------------
    // AC5: "Run a playbook" available in GM dropdown
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

                    // # Ensure the RHS is open (may auto-open for DM/GM)
                    cy.get('body').then(($body) => {
                        if ($body.find('[data-testid="run-list-card"]').length === 0) {
                            cy.getPlaybooksAppBarIcon().should('exist').click();
                        }
                    });

                    // * Verify list view
                    cy.get('[data-testid="run-list-card"]').should('have.length.at.least', 2);

                    // # Open the create dropdown
                    cy.get('[data-testid="create-blank-checklist"]').
                        parent().
                        find('.icon-chevron-down').
                        should('be.visible').
                        click();

                    // * Verify "Run a playbook" IS available
                    cy.get('[data-testid="create-from-playbook"]').should('exist');

                    // * Verify "Go to Playbooks" IS there
                    cy.get('[data-testid="go-to-playbooks"]').should('exist');
                });
            });
        });
    });
});
