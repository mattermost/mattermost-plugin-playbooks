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
    let dmPartner;

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

            // # Create a DM partner used across tests
            cy.apiCreateUser().then(({user: partner}) => {
                dmPartner = partner;
                cy.apiAddUserToTeam(testTeam.id, dmPartner.id);
            });
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    /**
     * Helper: navigate to a fresh DM, open the RHS, create a checklist via UI.
     * Returns with the RHS showing the new checklist detail view.
     * @param {string} partnerUsername - the DM partner's username
     */
    const createChecklistInDM = (partnerUsername) => {
        cy.visit(`/${testTeam.name}/messages/@${partnerUsername}`);
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

    it('can create a checklist in a DM via the RHS', () => {
        cy.apiCreateUser().then(({user: freshPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, freshPartner.id);
            createChecklistInDM(freshPartner.username);
        });
    });

    it('can create a checklist in a self-DM via the RHS', () => {
        createChecklistInDM(testUser.username);
    });

    it('can add a task and check it off in a DM checklist', () => {
        cy.apiCreateUser().then(({user: freshPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, freshPartner.id);
            createChecklistInDM(freshPartner.username);

            // # Add a new task
            const taskText = 'DM task ' + Date.now();
            cy.addNewTaskFromRHS(taskText);
            cy.findByText(taskText).should('exist');

            // # Check off the task
            cy.findByText(taskText).parents('[data-testid="checkbox-item-container"]').within(() => {
                cy.get('input[type="checkbox"]').click();
                cy.get('input[type="checkbox"]').should('be.checked');
            });
        });
    });

    it('can post a status update in a DM checklist', () => {
        cy.apiCreateUser().then(({user: freshPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, freshPartner.id);
            createChecklistInDM(freshPartner.username);

            const updateMessage = 'DM status update ' + Date.now();

            // # Post status update using the established helper
            // (handles react-select reminder field properly)
            cy.updateStatus(updateMessage, '60 min');

            // * Verify status update was posted in the channel
            cy.getLastPost().within(() => {
                cy.findByText(updateMessage).should('exist');
            });
        });
    });

    it('shows channel members in task assignee selector', () => {
        createChecklistInDM(dmPartner.username);

        // # Add a task
        const taskText = 'Assign me ' + Date.now();
        cy.addNewTaskFromRHS(taskText);

        // # Hover over the task to reveal the menu
        cy.findByText(taskText).parents('[data-testid="checkbox-item-container"]').trigger('mouseover');

        // # Click the edit button to enter edit mode
        cy.findByTestId('hover-menu-edit-button').click();

        // # Click the assignee selector
        cy.findByTestId('assignee-profile-selector').click();

        // * Verify the DM partner appears in the assignee dropdown
        cy.findByText(`@${dmPartner.username}`).should('exist');
    });

    it('rejects playbook run creation in a DM via API', () => {
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

    it('"Run a playbook" is available in the DM channel dropdown', () => {
        // # Setup: create a fresh DM with 2 checklists via API so the list view shows
        cy.apiCreateUser().then(({user: dropdownPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, dropdownPartner.id);
            cy.apiCreateDirectChannel([testUser.id, dropdownPartner.id]).then(({channel}) => {
                const ts = Date.now();
                cy.apiRunPlaybook({teamId: '', playbookId: '', playbookRunName: 'A-' + ts, ownerUserId: testUser.id, channelId: channel.id});
                cy.apiRunPlaybook({teamId: '', playbookId: '', playbookRunName: 'B-' + ts, ownerUserId: testUser.id, channelId: channel.id});

                // # Navigate and open RHS
                cy.visit(`/${testTeam.name}/messages/@${dropdownPartner.username}`);
                cy.get('#post_textbox').should('exist');
                cy.getPlaybooksAppBarIcon().should('exist').click();

                // * Verify the list view is showing (multiple runs = list, not detail)
                cy.get('[data-testid="run-list-card"]').should('have.length.at.least', 2);

                // # Open the create dropdown — the chevron is the sibling button
                // next to the "New checklist" primary action button
                cy.get('[data-testid="create-blank-checklist"]').
                    parent().
                    find('.icon-chevron-down').
                    should('be.visible').
                    click();

                // * Verify "Run a playbook" IS in the dropdown
                // (DM/GM gating happens in the run modal's channel selector, not in the dropdown)
                cy.get('[data-testid="create-from-playbook"]').should('exist');

                // * Verify "Go to Playbooks" IS there (sanity check the dropdown opened)
                cy.get('[data-testid="go-to-playbooks"]').should('exist');
            });
        });
    });

    it('move-channel modal offers DM channels for checklists', () => {
        cy.apiCreateUser().then(({user: movePartner}) => {
            cy.apiAddUserToTeam(testTeam.id, movePartner.id);
            cy.apiCreateUser().then(({user: targetPartner}) => {
                cy.apiAddUserToTeam(testTeam.id, targetPartner.id);
                cy.apiCreateDirectChannel([testUser.id, movePartner.id]).then(({channel: srcDM}) => {
                    const ts = Date.now();
                    cy.apiRunPlaybook({teamId: '', playbookId: '', playbookRunName: 'Move-A-' + ts, ownerUserId: testUser.id, channelId: srcDM.id});
                    cy.apiRunPlaybook({teamId: '', playbookId: '', playbookRunName: 'Move-B-' + ts, ownerUserId: testUser.id, channelId: srcDM.id});

                    // # Visit target DM first so it loads into Redux store
                    cy.apiCreateDirectChannel([testUser.id, targetPartner.id]);
                    cy.visit(`/${testTeam.name}/messages/@${targetPartner.username}`);
                    cy.get('#post_textbox').should('exist');

                    // # Navigate to the source DM and open RHS
                    cy.visit(`/${testTeam.name}/messages/@${movePartner.username}`);
                    cy.get('#post_textbox').should('exist');
                    cy.getPlaybooksAppBarIcon().should('exist').click();

                    // * Verify list view
                    cy.findByTestId('rhs-runs-list').should('exist');
                    cy.findAllByTestId('run-list-card').should('have.length.at.least', 2);

                    // # Click the dot menu on the first card
                    cy.findByTestId('rhs-runs-list').
                        findAllByTestId('run-list-card').
                        first().
                        findByRole('button').
                        click();

                    // # Click "Move to a different channel"
                    cy.findByText('Move to a different channel').click();

                    // # Type the target DM partner's username in the channel selector
                    cy.get('#link_existing_channel_selector').click().type(targetPartner.username);

                    // * Verify a DM channel option appears (DM/GM channels allowed for checklists)
                    cy.get('.playbooks-rselect__menu').should('exist').within(() => {
                        cy.get('.playbooks-rselect__option').should('have.length.at.least', 1);
                    });

                    // # Close the modal
                    cy.get('body').type('{esc}');
                });
            });
        });
    });

    it('moving a DM checklist to a public channel populates team_id', () => {
        cy.apiCreateUser().then(({user: movePartner}) => {
            cy.apiAddUserToTeam(testTeam.id, movePartner.id);
            cy.apiCreateChannel(testTeam.id, 'dm-move-target', 'DM Move Target', 'O').then(({channel: targetChannel}) => {
                cy.apiCreateDirectChannel([testUser.id, movePartner.id]).then(({channel: dmChannel}) => {
                    cy.apiRunPlaybook({
                        teamId: '',
                        playbookId: '',
                        playbookRunName: 'DM-move-' + Date.now(),
                        ownerUserId: testUser.id,
                        channelId: dmChannel.id,
                    }).then((run) => {
                        // # Move via API (UI flow is covered indirectly through dm_checklist_spec move test)
                        cy.apiUpdateRun(run.id, {channelID: targetChannel.id});

                        // * team_id is now the test team's id
                        cy.apiGetPlaybookRun(run.id).then((response) => {
                            expect(response.body.team_id).to.equal(testTeam.id);
                            expect(response.body.channel_id).to.equal(targetChannel.id);
                        });
                    });
                });
            });
        });
    });
});
