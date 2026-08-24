// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > task requirements', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    const enableTaskRequirements = () => {
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            PluginSettings: {
                Plugins: {
                    playbooks: {
                        BetaFeatures: {
                            task_requirements: true,
                        },
                    },
                },
            },
        });
    };

    const createPlaybookWithTask = () => {
        return cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Task Requirements PB ' + Date.now(),
            checklists: [{
                title: 'Checklist',
                items: [{title: 'Required task'}],
            }],
            memberIDs: [testUser.id],
        });
    };

    const openTaskMoreMenu = (index = 0) => {
        cy.findAllByTestId('checkbox-item-container').eq(index).trigger('mouseover');
        cy.findAllByTestId('checkbox-item-container').eq(index).within(() => {
            cy.findByTitle('More').click();
        });
    };

    beforeEach(() => {
        cy.viewport('macbook-13');
        enableTaskRequirements();
        cy.apiLogin(testUser);
    });

    it('adds a requirement in the playbook editor and shows it under the task', () => {
        createPlaybookWithTask().then((playbook) => {
            // # Open the playbook outline
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            // # Add a requirement from the task More menu
            openTaskMoreMenu(0);
            cy.findByTestId('task-menu-add-requirement').should('be.visible').click();

            // # Fill the requirement label and save
            cy.get('#playbooks-edit-requirements-modal').should('be.visible');
            cy.findByTestId('requirement-label-input').clear().type('Ticket URL');
            cy.findByTestId('modal-confirm-button').click();

            // * Accordion appears under the task
            cy.findByTestId('task-requirements-accordion').should('be.visible');
            cy.findByTestId('task-requirements-accordion').should('contain', '1 requirement');

            // # Expand and verify the requirement label
            cy.findByTestId('task-requirements-accordion').find('button').first().click();
            cy.findByTestId('task-requirements-accordion').should('contain', 'Ticket URL');

            // * Persists after reload (outline opens on Summary; scroll Tasks into view)
            cy.reload();
            cy.findByTestId('task-requirements-accordion').scrollIntoView().should('be.visible');
            cy.findByTestId('task-requirements-accordion').find('button').first().click();
            cy.findByTestId('task-requirements-accordion').should('contain', 'Ticket URL');

            // * API has the requirement on the checklist item
            cy.apiGetPlaybook(playbook.id).then((updated) => {
                expect(updated.checklists[0].items[0].requirements).to.have.length(1);
                expect(updated.checklists[0].items[0].requirements[0].label).to.equal('Ticket URL');
            });
        });
    });

    it('prompts for requirement values when checking off a run task', () => {
        createPlaybookWithTask().then((playbook) => {
            // # Add a requirement via the editor
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);
            openTaskMoreMenu(0);
            cy.findByTestId('task-menu-add-requirement').click();
            cy.get('#playbooks-edit-requirements-modal').should('be.visible');
            cy.findByTestId('requirement-label-input').clear().type('Ticket URL');
            cy.findByTestId('modal-confirm-button').click();
            cy.findByTestId('task-requirements-accordion').should('be.visible');

            // * Wait for the requirement to persist before starting a run
            cy.apiGetPlaybook(playbook.id).then((updated) => {
                expect(updated.checklists[0].items[0].requirements).to.have.length(1);
            });

            // # Start a run from the playbook
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Requirements run ' + Date.now(),
                ownerUserId: testUser.id,
            }).then((run) => {
                cy.visit(`/playbooks/runs/${run.id}`);

                // # Try to check off the task
                cy.findByTestId('run-checklist-section').
                    findAllByTestId('checkbox-item-container').
                    eq(0).
                    find('input[type="checkbox"]').
                    click({force: true});

                // * Fill modal opens instead of completing immediately
                cy.get('#playbooks-fill-requirements-modal').should('be.visible');
                cy.get('#playbooks-fill-requirements-modal').within(() => {
                    cy.contains('Ticket URL').should('be.visible');
                    cy.get('[data-testid^="requirement-value-"]').clear().type('https://example.com/T-1');
                    cy.findByTestId('modal-save-and-complete').click();
                });

                // * Modal closes and task is checked
                cy.get('#playbooks-fill-requirements-modal').should('not.exist');
                cy.findByTestId('run-checklist-section').
                    findAllByTestId('checkbox-item-container').
                    eq(0).
                    find('input[type="checkbox"]').
                    should('be.checked');

                // * Accordion shows the saved value when expanded
                cy.findByTestId('task-requirements-accordion').should('be.visible');
                cy.findByTestId('task-requirements-accordion').find('button').first().click();
                cy.findByTestId('task-requirements-accordion').should('contain', 'https://example.com/T-1');

                // * Persisted on the run
                cy.apiGetPlaybookRun(run.id).then(({body}) => {
                    expect(body.checklists[0].items[0].state).to.equal('closed');
                    expect(body.checklists[0].items[0].requirements[0].value).to.equal('https://example.com/T-1');
                });
            });
        });
    });

    it('can save requirement values as a draft without completing the task', () => {
        createPlaybookWithTask().then((playbook) => {
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);
            openTaskMoreMenu(0);
            cy.findByTestId('task-menu-add-requirement').click();
            cy.get('#playbooks-edit-requirements-modal').should('be.visible');
            cy.findByTestId('requirement-label-input').clear().type('Root cause');
            cy.findByTestId('modal-confirm-button').click();
            cy.findByTestId('task-requirements-accordion').should('be.visible');

            cy.apiGetPlaybook(playbook.id).then((updated) => {
                expect(updated.checklists[0].items[0].requirements).to.have.length(1);
            });

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Draft requirements run ' + Date.now(),
                ownerUserId: testUser.id,
            }).then((run) => {
                cy.visit(`/playbooks/runs/${run.id}`);

                cy.findByTestId('run-checklist-section').
                    findAllByTestId('checkbox-item-container').
                    eq(0).
                    find('input[type="checkbox"]').
                    click({force: true});

                cy.get('#playbooks-fill-requirements-modal').should('be.visible');
                cy.get('#playbooks-fill-requirements-modal').within(() => {
                    cy.get('[data-testid^="requirement-value-"]').clear().type('network blip');
                    cy.findByTestId('modal-save-requirements').click();
                });

                cy.get('#playbooks-fill-requirements-modal').should('not.exist');

                // * Task stays open, value is saved under the accordion
                cy.findByTestId('run-checklist-section').
                    findAllByTestId('checkbox-item-container').
                    eq(0).
                    find('input[type="checkbox"]').
                    should('not.be.checked');
                cy.findByTestId('task-requirements-accordion').find('button').first().click();
                cy.findByTestId('task-requirements-accordion').should('contain', 'network blip');

                cy.apiGetPlaybookRun(run.id).then(({body}) => {
                    expect(body.checklists[0].items[0].state).to.not.equal('closed');
                    expect(body.checklists[0].items[0].requirements[0].value).to.equal('network blip');
                });
            });
        });
    });
});
