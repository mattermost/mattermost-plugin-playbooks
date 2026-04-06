// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

// NOTE: Run with --browser chrome. The default Electron browser throws
// "RegExp.escape is not a function" errors that crash the webapp.

import {getRandomId} from '../../../utils';

describe('runs > attribute columns applied to all rows', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    // Shared run objects; populated in the single test.
    let run1;
    let run2;
    let run3;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a playbook with two visible property fields
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Multirow Attribute Columns Playbook ' + getRandomId(),
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
            });
        });
    });

    after(() => {
        cy.apiLogin(testUser);
        cy.apiArchivePlaybook(testPlaybook.id);
    });

    beforeEach(() => {
        // # Login as testUser before each test
        cy.apiLogin(testUser);

        // # Use a consistent viewport
        cy.viewport('macbook-13');

        // # Create 3 runs from the shared playbook
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Multirow Run Alpha ' + getRandomId(),
            ownerUserId: testUser.id,
        }).then((run) => {
            run1 = run;
        });

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Multirow Run Beta ' + getRandomId(),
            ownerUserId: testUser.id,
        }).then((run) => {
            run2 = run;
        });

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Multirow Run Gamma ' + getRandomId(),
            ownerUserId: testUser.id,
        }).then((run) => {
            run3 = run;
        });
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        if (run1) {
            cy.apiFinishRun(run1.id);
        }
        if (run2) {
            cy.apiFinishRun(run2.id);
        }
        if (run3) {
            cy.apiFinishRun(run3.id);
        }
    });

    it('shows attribute columns on every row when all runs share a playbook', () => {
        // # Set distinct property values on run 1
        cy.playbooksVisitRun(run1.id);
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'High');
        cy.playbooksSetRunPropertyViaUI('run-property-zone', 'US-East', {type: 'text'});

        // # Set distinct property values on run 2
        cy.playbooksVisitRun(run2.id);
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'Medium');
        cy.playbooksSetRunPropertyViaUI('run-property-zone', 'EU-West', {type: 'text'});

        // # Set distinct property values on run 3
        cy.playbooksVisitRun(run3.id);
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'Low');
        cy.playbooksSetRunPropertyViaUI('run-property-zone', 'AP-South', {type: 'text'});

        // * Assert each run's property values are persisted server-side
        cy.assertRunPropertyValueStored(run1.id, 'Severity');
        cy.assertRunPropertyValueStored(run1.id, 'Zone', 'US-East');
        cy.assertRunPropertyValueStored(run2.id, 'Severity');
        cy.assertRunPropertyValueStored(run2.id, 'Zone', 'EU-West');
        cy.assertRunPropertyValueStored(run3.id, 'Severity');
        cy.assertRunPropertyValueStored(run3.id, 'Zone', 'AP-South');

        // # Visit the runs list
        cy.visit('/playbooks/runs');
        cy.get('#playbookRunList').should('exist');

        // # Filter to the test playbook so the list enters single-playbook mode
        // # (attribute columns are only rendered in single-playbook mode)
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // * Assert that attribute columns are present on the row for run 1
        cy.playbooksGetRunListRow(run1.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('exist');
            cy.findByTestId('run-list-item-attributes').should('contain', 'High');
            cy.findByTestId('run-list-item-attributes').should('contain', 'US-East');
        });

        // * Assert that attribute columns are present on the row for run 2
        cy.playbooksGetRunListRow(run2.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('exist');
            cy.findByTestId('run-list-item-attributes').should('contain', 'Medium');
            cy.findByTestId('run-list-item-attributes').should('contain', 'EU-West');
        });

        // * Assert that attribute columns are present on the row for run 3
        cy.playbooksGetRunListRow(run3.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('exist');
            cy.findByTestId('run-list-item-attributes').should('contain', 'Low');
            cy.findByTestId('run-list-item-attributes').should('contain', 'AP-South');
        });
    });

    it('shows dash placeholder on every row for runs with no property values', () => {
        // # Visit the runs list without setting any property values on any run
        cy.visit('/playbooks/runs');
        cy.get('#playbookRunList').should('exist');

        // # Filter to the test playbook to enter single-playbook mode
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // * All three rows must render the attribute columns section with the dash placeholder
        cy.playbooksGetRunListRow(run1.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('exist');
            cy.findByTestId('run-list-item-attributes').should('contain', '—');
        });

        cy.playbooksGetRunListRow(run2.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('exist');
            cy.findByTestId('run-list-item-attributes').should('contain', '—');
        });

        cy.playbooksGetRunListRow(run3.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('exist');
            cy.findByTestId('run-list-item-attributes').should('contain', '—');
        });
    });

    it('shows attribute columns on every row after a column is deselected', () => {
        // # Set Severity property values on each run
        cy.playbooksVisitRun(run1.id);
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'Critical');

        cy.playbooksVisitRun(run2.id);
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'High');

        cy.playbooksVisitRun(run3.id);
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'Medium');

        // # Visit the runs list
        cy.visit('/playbooks/runs');
        cy.get('#playbookRunList').should('exist');

        // # Filter to the test playbook to enter single-playbook mode
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // # Open the configure columns dropdown and deselect the Zone column
        cy.findByTestId('configure-columns-button').click();
        cy.findByTestId('column-selector-dropdown').within(() => {
            cy.findByText('Zone').click();
        });

        // # Close the dropdown
        cy.get('body').click(0, 0);

        // * The attribute section must still be present on every row (not just the first),
        // * and the Zone column must be absent from all rows
        cy.playbooksGetRunListRow(run1.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('exist');
            cy.findByTestId('run-list-item-attributes').should('not.contain', 'Zone');
        });

        cy.playbooksGetRunListRow(run2.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('exist');
            cy.findByTestId('run-list-item-attributes').should('not.contain', 'Zone');
        });

        cy.playbooksGetRunListRow(run3.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('exist');
            cy.findByTestId('run-list-item-attributes').should('not.contain', 'Zone');
        });

        // * Severity column must still appear on every row after Zone is deselected
        cy.playbooksGetRunListRow(run1.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('contain', 'Critical');
        });

        cy.playbooksGetRunListRow(run2.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('contain', 'High');
        });

        cy.playbooksGetRunListRow(run3.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('contain', 'Medium');
        });
    });

    it('shows distinct property values on each row when values differ across runs', () => {
        // # Set a unique Severity on each run so we can distinguish one row from another
        cy.playbooksVisitRun(run1.id);
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'Critical');

        cy.playbooksVisitRun(run2.id);
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'Low');

        cy.playbooksVisitRun(run3.id);
        cy.playbooksSetRunPropertyViaUI('run-property-severity', 'Medium');

        // * Assert each run has a Severity value persisted server-side
        cy.assertRunPropertyValueStored(run1.id, 'Severity');
        cy.assertRunPropertyValueStored(run2.id, 'Severity');
        cy.assertRunPropertyValueStored(run3.id, 'Severity');

        // # Visit the runs list and apply the playbook filter
        cy.visit('/playbooks/runs');
        cy.get('#playbookRunList').should('exist');
        cy.playbooksFilterByPlaybook(testPlaybook.title);

        // * Each row must show its own value, not a value from another row
        cy.playbooksGetRunListRow(run1.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('contain', 'Critical');
            cy.findByTestId('run-list-item-attributes').should('not.contain', 'Low');
            cy.findByTestId('run-list-item-attributes').should('not.contain', 'Medium');
        });

        cy.playbooksGetRunListRow(run2.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('contain', 'Low');
            cy.findByTestId('run-list-item-attributes').should('not.contain', 'Critical');
            cy.findByTestId('run-list-item-attributes').should('not.contain', 'Medium');
        });

        cy.playbooksGetRunListRow(run3.name).within(() => {
            cy.findByTestId('run-list-item-attributes').should('contain', 'Medium');
            cy.findByTestId('run-list-item-attributes').should('not.contain', 'Critical');
            cy.findByTestId('run-list-item-attributes').should('not.contain', 'Low');
        });
    });
});
