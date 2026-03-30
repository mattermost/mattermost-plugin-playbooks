// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > select attribute filter', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let runTriaging;
    let runResolved;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create playbook with a Status select field
            const suffix = getRandomId();
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Filter Test PB ' + suffix,
                memberIDs: [testUser.id],
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Add a Status select attribute
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Status',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        options: [
                            {name: 'Triaging'},
                            {name: 'Resolved'},
                        ],
                    },
                });

                // # Create two runs with different status values set via UI
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Run Triaging ' + suffix,
                    ownerUserId: testUser.id,
                }).then((run) => {
                    runTriaging = run;

                    // # Set Status to Triaging via the run details page
                    cy.playbooksVisitRun(run.id);
                    cy.playbooksSetRunPropertyViaUI('run-property-status', 'Triaging');

                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: testPlaybook.id,
                        playbookRunName: 'Run Resolved ' + suffix,
                        ownerUserId: testUser.id,
                    }).then((run2) => {
                        runResolved = run2;

                        // # Set Status to Resolved via the run details page
                        cy.playbooksVisitRun(run2.id);
                        cy.playbooksSetRunPropertyViaUI('run-property-status', 'Resolved');
                    });
                });
            });
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    after(() => {
        cy.apiLogin(testUser);
        if (testPlaybook) {
            cy.apiArchivePlaybook(testPlaybook.id);
        }
    });

    it('shows select attribute filter dropdown when a playbook with select fields is selected', () => {
        // # Visit runs list
        cy.visit('/playbooks/runs');

        // # Select the test playbook in the playbook filter
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // * Assert the Status filter dropdown appears
        cy.get('[data-testid^="select-field-filter-"]').should('exist');
        cy.get('[data-testid^="select-field-filter-"]').should('contain', 'Status');
    });

    it('does not show select attribute filter when no playbook is selected', () => {
        // # Visit runs list without selecting a playbook
        cy.visit('/playbooks/runs');

        // * Assert no select field filter exists
        cy.get('[data-testid^="select-field-filter-"]').should('not.exist');
    });

    it('filters runs by select attribute value', () => {
        // # Visit runs list
        cy.visit('/playbooks/runs');

        // # Select the test playbook
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // * Both runs should be visible initially
        cy.findByTestId('playbookRunList').within(() => {
            cy.findAllByText(runTriaging.name).should('have.length.gte', 1);
            cy.findAllByText(runResolved.name).should('have.length.gte', 1);
        });

        // # Filter by Triaging
        cy.get('[data-testid^="select-field-filter-"]').select('Triaging');

        // * Only the Triaging run should be visible
        cy.findByTestId('playbookRunList').within(() => {
            cy.findAllByText(runTriaging.name).should('have.length.gte', 1);
            cy.findAllByText(runResolved.name).should('have.length', 0);
        });

        // # Filter by Resolved
        cy.get('[data-testid^="select-field-filter-"]').select('Resolved');

        // * Only the Resolved run should be visible
        cy.findByTestId('playbookRunList').within(() => {
            cy.findAllByText(runResolved.name).should('have.length.gte', 1);
            cy.findAllByText(runTriaging.name).should('have.length', 0);
        });
    });

    it('clearing the filter shows all runs again', () => {
        // # Visit runs list
        cy.visit('/playbooks/runs');

        // # Select the test playbook
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // # Filter by Triaging
        cy.get('[data-testid^="select-field-filter-"]').select('Triaging');

        // * Only the Triaging run visible
        cy.findByTestId('playbookRunList').within(() => {
            cy.findAllByText(runTriaging.name).should('have.length.gte', 1);
            cy.findAllByText(runResolved.name).should('have.length', 0);
        });

        // # Clear the filter by selecting the empty option (field name)
        cy.get('[data-testid^="select-field-filter-"]').select('Status');

        // * Both runs visible again
        cy.findByTestId('playbookRunList').within(() => {
            cy.findAllByText(runTriaging.name).should('have.length.gte', 1);
            cy.findAllByText(runResolved.name).should('have.length.gte', 1);
        });
    });
});
