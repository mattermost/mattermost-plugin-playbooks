// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > attribute columns', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a single playbook with property fields shared across all tests
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Attribute Columns Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Add Severity select property field
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Severity',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [
                            {name: 'Low'},
                            {name: 'Medium'},
                            {name: 'High'},
                            {name: 'Critical'},
                        ],
                    },
                });

                // # Add Zone text property field
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Zone',
                    type: 'text',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 2,
                    },
                });

                // # Add Priority select property field (third column, not shown by default)
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Priority',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 3,
                        options: [
                            {name: 'Low'},
                            {name: 'Medium'},
                            {name: 'High'},
                        ],
                    },
                });
            });
        });
    });

    after(() => {
        cy.apiLogin(testUser);
        cy.apiArchivePlaybook(testPlaybook.id);
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport
        cy.viewport('macbook-13');

        // # Start a run from the shared playbook
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Attribute Columns Run (' + getRandomId() + ')',
            ownerUserId: testUser.id,
        }).then((run) => {
            testRun = run;
        });
    });

    it('shows first 2 property values below run name by default in runs list', () => {
        // # Visit run details to set property values
        cy.playbooksVisitRun(testRun.id);

        // # Set Severity to High
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'High');

        // # Set Zone text value
        cy.playbooksSetRunPropertyViaUI('run-property-zone', 'US-East', {type: 'text'});

        // * Assert property values are persisted server-side (guards against optimistic UI bugs)
        cy.assertRunPropertyValueStored(testRun.id, 'Severity');
        cy.assertRunPropertyValueStored(testRun.id, 'Zone', 'US-East');

        // # Visit the runs list
        cy.visit('/playbooks/runs');

        // # Find the run in the list and assert attribute values
        cy.playbooksGetRunListRow(testRun.name).within(() => {
            // * Assert first property value (Severity) is shown
            cy.findByTestId('run-list-item-attributes').should('contain', 'High');

            // * Assert second property value (Zone) is shown
            cy.findByTestId('run-list-item-attributes').should('contain', 'US-East');
        });
    });

    it('shows property values matching what was set', () => {
        // # Visit run details to set property values
        cy.playbooksVisitRun(testRun.id);

        // # Set Severity to Critical
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'Critical');

        // # Set Zone text value
        cy.playbooksSetRunPropertyViaUI('run-property-zone', 'EU-West', {type: 'text'});

        // * Assert property values are persisted server-side (guards against optimistic UI bugs)
        cy.assertRunPropertyValueStored(testRun.id, 'Severity');
        cy.assertRunPropertyValueStored(testRun.id, 'Zone', 'EU-West');

        // # Visit the runs list
        cy.visit('/playbooks/runs');

        // # Find the run in the list and assert attribute values
        cy.playbooksGetRunListRow(testRun.name).within(() => {
            // * Assert property values match what was set
            cy.findByTestId('run-list-item-attributes').should('contain', 'Critical');
            cy.findByTestId('run-list-item-attributes').should('contain', 'EU-West');
        });
    });

    it('shows dash placeholder for run with no property values set', () => {
        // # Visit the runs list without setting any property values
        cy.visit('/playbooks/runs');

        // # Find the run in the list and assert attribute values
        cy.playbooksGetRunListRow(testRun.name).within(() => {
            // * Assert dash placeholder is shown for empty properties
            cy.findByTestId('run-list-item-attributes').should('contain', '—');
        });
    });

    it('lists all available property fields in the configure columns dropdown', () => {
        // # Visit the runs list
        cy.visit('/playbooks/runs');

        // # Filter to the test playbook so the list enters single-playbook mode
        // # (configure-columns-button is only shown when all visible runs share one playbook)
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // # Open the configure columns dropdown
        cy.findByTestId('configure-columns-button').click();

        // * Assert all property fields are listed
        cy.findByTestId('column-selector-dropdown').within(() => {
            cy.findByText('Severity').should('exist');
            cy.findByText('Zone').should('exist');
            cy.findByText('Priority').should('exist');
        });
    });

    it('hides column after deselecting it in configure columns dropdown', () => {
        // # Visit the runs list
        cy.visit('/playbooks/runs');

        // # Filter to the test playbook so the list enters single-playbook mode
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // # Open the configure columns dropdown
        cy.findByTestId('configure-columns-button').click();

        // # Deselect the Zone column
        cy.findByTestId('column-selector-dropdown').within(() => {
            cy.findByText('Zone').click();
        });

        // # Close the dropdown
        cy.get('body').click(0, 0);

        // # Find the run in the list and assert attribute values
        cy.playbooksGetRunListRow(testRun.name).within(() => {
            // * Assert Zone column is no longer shown
            cy.findByTestId('run-list-item-attributes').should('not.contain', 'Zone');
        });
    });

    it('persists column preferences after page reload', () => {
        // # Visit the runs list
        cy.visit('/playbooks/runs');
        cy.get('#playbookRunList').should('exist');

        // # Filter to the test playbook so the list enters single-playbook mode
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // # Open the configure columns dropdown
        cy.findByTestId('configure-columns-button').click();

        // # Deselect the Zone column
        cy.findByTestId('column-selector-dropdown').within(() => {
            cy.findByText('Zone').click();
        });

        // # Close the dropdown
        cy.get('body').click(0, 0);

        // # Reload the page
        cy.reload();

        // # Re-apply the playbook filter after reload (filter state is not persisted in the URL)
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // # Open the configure columns dropdown again
        cy.findByTestId('configure-columns-button').click();

        // * Assert Zone is still deselected after reload
        cy.findByTestId('column-selector-dropdown').within(() => {
            cy.get('[data-testid="column-option"]').contains('Zone').should('have.attr', 'data-selected', 'false');
        });
    });

    it('shows a third property column after enabling it in the configure columns dropdown', () => {
        // # Visit run details to set property values for all three fields
        cy.playbooksVisitRun(testRun.id);

        // # Set Severity to Medium
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'Medium');

        // # Set Zone text value
        cy.playbooksSetRunPropertyViaUI('run-property-zone', 'AP-South', {type: 'text'});

        // # Set Priority to High
        cy.playbooksSetRunPropertyViaUI('run-property-priority', 'High');

        // # Visit the runs list
        cy.visit('/playbooks/runs');

        // # Filter to the test playbook so the list enters single-playbook mode
        // # (configure-columns-button is only shown when all visible runs share one playbook)
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // # Open the configure columns dropdown
        cy.findByTestId('configure-columns-button').click();

        // # Enable the Priority column by clicking its entry in the dropdown
        cy.findByTestId('column-selector-dropdown').within(() => {
            cy.findByText('Priority').click();
        });

        // # Close the dropdown
        cy.get('body').click(0, 0);

        // # Find the run in the list and assert all three property values are shown
        cy.playbooksGetRunListRow(testRun.name).within(() => {
            // * Assert first property value (Severity) is shown
            cy.findByTestId('run-list-item-attributes').should('contain', 'Medium');

            // * Assert second property value (Zone) is shown
            cy.findByTestId('run-list-item-attributes').should('contain', 'AP-South');

            // * Assert third property value (Priority) is now shown after enabling
            cy.findByTestId('run-list-item-attributes').should('contain', 'High');
        });
    });
});
