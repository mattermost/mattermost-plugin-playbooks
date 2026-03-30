// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > user and date property types', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testUser2;
    let createdPlaybookIds = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateAndAddUserToTeam(testTeam.id).then((u2) => {
                testUser2 = u2;
            });
        });
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        createdPlaybookIds = [];
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    describe('user-type property', () => {
        it('displays avatar and display name when set via API', () => {
            // # Create a playbook with a user-type property field called Reviewer
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'User Property Display Playbook ' + getRandomId(),
                memberIDs: [testUser.id, testUser2.id],
                makePublic: true,
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.apiAddPropertyField(playbook.id, {name: 'Reviewer', type: 'user'}).then(() => {
                    // # Start a run
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: 'User Display Run ' + getRandomId(),
                        ownerUserId: testUser.id,
                    }).then((run) => {
                        // # Set the Reviewer property to testUser2 via API
                        cy.apiSetRunPropertyValueByName(run.id, 'Reviewer', testUser2.id);

                        // # Navigate to the run details page
                        cy.playbooksVisitRun(run.id);

                        // * The Reviewer property should show the user display name (not raw ID)
                        cy.findByTestId('run-property-reviewer').within(() => {
                            cy.findByTestId('property-value').should('not.contain', testUser2.id);
                            cy.findByTestId('property-value').should('contain', testUser2.username);
                        });

                        // * There should be a user avatar element within the property value area
                        cy.findByTestId('run-property-reviewer').within(() => {
                            cy.get('img.image').should('exist');
                        });
                    });
                });
            });
        });

        it('can be set via the UI user picker', () => {
            let savedRunId;

            // # Create a playbook with a user-type property field called Reviewer
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'User Picker Playbook ' + getRandomId(),
                memberIDs: [testUser.id, testUser2.id],
                makePublic: true,
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.apiAddPropertyField(playbook.id, {name: 'Reviewer', type: 'user'}).then(() => {
                    // # Start a run
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: 'User Picker Run ' + getRandomId(),
                        ownerUserId: testUser.id,
                    }).then((run) => {
                        savedRunId = run.id;

                        // # Navigate to run details
                        cy.playbooksVisitRun(run.id);

                        // # Click the Reviewer property value to open the user picker
                        cy.findByTestId('run-property-reviewer').within(() => {
                            cy.findByTestId('property-value').click();
                        });

                        // # Type the second user's username to filter the picker
                        cy.get('.playbook-react-select__input input').type(testUser2.username.substring(0, 4));

                        // # Select testUser2 from the picker suggestions
                        cy.playbooksInterceptGraphQLMutation('SetRunPropertyValue');
                        cy.get('.playbook-react-select__option').
                            contains(testUser2.username).
                            first().
                            click();
                        cy.wait('@SetRunPropertyValue');

                        // * The property should now show testUser2's display name
                        cy.findByTestId('run-property-reviewer').within(() => {
                            cy.findByTestId('property-value').should('contain', testUser2.username);
                        });

                        // * Assert via API that the value was stored
                        cy.assertRunPropertyValueStored(savedRunId, 'Reviewer', testUser2.id);
                    });
                });
            });
        });

        it('shows user column in the runs list when configured as a visible attribute', () => {
            // # Create a playbook with a user-type property field
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'User Column Playbook ' + getRandomId(),
                memberIDs: [testUser.id, testUser2.id],
                makePublic: true,
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Reviewer',
                    type: 'user',
                    attrs: {visibility: 'always', sortOrder: 1},
                }).then(() => {
                    // # Start a run
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: 'User Column Run ' + getRandomId(),
                        ownerUserId: testUser.id,
                    }).then((run) => {
                        // # Set the Reviewer to testUser2 via API
                        cy.apiSetRunPropertyValueByName(run.id, 'Reviewer', testUser2.id);

                        // # Navigate to the runs list and filter by the test playbook
                        cy.visit('/playbooks/runs');
                        cy.playbooksFilterByPlaybook(playbook.title);

                        // * Assert the runs list shows a Reviewer attribute column for the run
                        cy.playbooksGetRunListRow(run.name).within(() => {
                            cy.get('[data-testid="run-list-item-attributes"]').should('contain', 'Reviewer');
                        });
                    });
                });
            });
        });
    });

    describe('date-type property', () => {
        it('can be set via the date picker and displays a formatted date', () => {
            let savedRunId;

            // # Create a playbook with a date-type property field called Due Date
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Date Property Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.apiAddPropertyField(playbook.id, {name: 'Due Date', type: 'date'}).then(() => {
                    // # Start a run
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: 'Date Picker Run ' + getRandomId(),
                        ownerUserId: testUser.id,
                    }).then((run) => {
                        savedRunId = run.id;

                        // # Navigate to run details
                        cy.playbooksVisitRun(run.id);

                        // # Click the Due Date property value to open the date picker
                        cy.findByTestId('run-property-due-date').within(() => {
                            cy.findByTestId('property-value').click();
                        });

                        // # Select the first suggested date option (Today/Tomorrow/Next week)
                        cy.playbooksInterceptGraphQLMutation('SetRunPropertyValue');
                        cy.get('.playbook-react-select__option').first().click();
                        cy.wait('@SetRunPropertyValue');

                        // * The property should now show a formatted date (not empty)
                        cy.findByTestId('run-property-due-date').within(() => {
                            cy.findByTestId('property-value').should('not.contain', 'Empty');
                            cy.findByTestId('property-value').invoke('text').should('match', /\d/);
                        });

                        // * Assert via API that a value was stored
                        cy.assertRunPropertyValueStored(savedRunId, 'Due Date');
                    });
                });
            });
        });
    });
});
