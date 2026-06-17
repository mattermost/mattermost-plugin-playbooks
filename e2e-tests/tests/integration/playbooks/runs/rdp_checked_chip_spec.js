// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > RHS > checked/unchecked chip', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.viewport('macbook-13');
        cy.apiLogin(testUser);
    });

    /**
     * Create a fresh DM partner + blank-checklist run via API, then yield the run
     * so each test starts from a known clean state (mirrors rdp_dm_checklist_spec).
     */
    const setupRunWithChecklist = (callback) => {
        cy.apiCreateUser().then(({user: partner}) => {
            cy.apiAddUserToTeam(testTeam.id, partner.id);
            cy.apiCreateDirectChannel([testUser.id, partner.id]).then(({channel}) => {
                cy.apiRunPlaybook({
                    teamId: '',
                    playbookId: '',
                    playbookRunName: 'chip-' + Date.now(),
                    ownerUserId: testUser.id,
                    channelId: channel.id,
                }).then((run) => {
                    callback({partner, channel, run});
                });
            });
        });
    };

    // # Open the run's RHS task list in the DM channel
    const openRunRHS = (partner) => {
        cy.visit(`/${testTeam.name}/messages/@${partner.username}`);
        cy.get('#post_textbox').should('exist');
        cy.getPlaybooksAppBarIcon().should('exist').click();
        cy.get('body').then(($body) => {
            if ($body.find('[data-testid="run-list-card"]').length) {
                cy.findAllByTestId('run-list-card').first().click();
            }
        });
    };

    it('shows a checked-by chip after a task is checked, then flips to unchecked', () => {
        setupRunWithChecklist(({partner}) => {
            openRunRHS(partner);

            // # Add a task and check it off
            const taskTitle = 'Chip task ' + Date.now();
            cy.addNewTaskFromRHS(taskTitle);
            cy.findByText(taskTitle).parents('[data-testid="checkbox-item-container"]').as('taskRow');

            cy.get('@taskRow').within(() => {
                cy.get('input[type="checkbox"]').click();
                cy.get('input[type="checkbox"]').should('be.checked');

                // * The checked chip appears in the task's metadata row
                cy.findByTestId('checklist-item-checked-chip').should('be.visible');
            });

            // * Hovering the chip reveals the activity-style tooltip with the verb "checked off".
            //   Tooltip renders in a body-level portal, so assert at document scope.
            cy.get('@taskRow').findByTestId('checklist-item-checked-chip').realHover();
            cy.contains(/checked off/i).should('be.visible');

            // # Uncheck the task
            cy.get('@taskRow').within(() => {
                cy.get('input[type="checkbox"]').click();
                cy.get('input[type="checkbox"]').should('not.be.checked');

                // * The chip remains, now reflecting the uncheck
                cy.findByTestId('checklist-item-checked-chip').should('be.visible');
            });

            // * Tooltip now reads "unchecked"
            cy.get('@taskRow').findByTestId('checklist-item-checked-chip').realHover();
            cy.contains(/unchecked/i).should('be.visible');
        });
    });

    it('shows no chip for an unchecked, never-touched task', () => {
        setupRunWithChecklist(({partner}) => {
            openRunRHS(partner);

            const taskTitle = 'Untouched task ' + Date.now();
            cy.addNewTaskFromRHS(taskTitle);

            // * A brand-new task (never checked) shows no checked-by chip
            cy.findByText(taskTitle).parents('[data-testid="checkbox-item-container"]').within(() => {
                cy.findByTestId('checklist-item-checked-chip').should('not.exist');
            });
        });
    });
});
