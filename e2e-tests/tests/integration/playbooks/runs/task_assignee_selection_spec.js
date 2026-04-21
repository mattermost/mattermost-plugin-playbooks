// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > task assignee — run attribute selection', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let createdPlaybookIds = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        createdPlaybookIds = [];
    });

    beforeEach(() => {
        cy.viewport('macbook-13');
    });

    // ------------------------------------------------------------------ //
    // Run attribute (property_user) assignment                            //
    // ------------------------------------------------------------------ //

    describe('run attribute (property_user) assignment', () => {
        it('selecting a run attribute from the dropdown immediately reflects the selected value', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Attribute Selection Visual Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Add a user-type property field via the playbook attributes UI
                cy.playbooksAddPropertyFieldViaUI(playbook.id, 'Reviewer', 'user');

                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');

                cy.get('#checklists').within(() => {
                    // # Select the Run User role to reveal the field sub-dropdown
                    cy.findByTestId('role-options').select('property_user');

                    // # Pick the Reviewer field from the sub-dropdown
                    cy.findByTestId('property-user-field-options').select('Reviewer');

                    // * The sub-dropdown must immediately show Reviewer as selected
                    cy.findByTestId('property-user-field-options').find(':selected').should('have.text', 'Reviewer');
                });
            });
        });

        it('selected run attribute retains its value after selection', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Attribute Retain Value Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.playbooksAddPropertyFieldViaUI(playbook.id, 'Reviewer', 'user');

                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');

                cy.get('#checklists').within(() => {
                    cy.findByTestId('role-options').select('property_user');
                    cy.findByTestId('property-user-field-options').select('Reviewer');

                    // * Selected value persists without any save action
                    cy.findByTestId('property-user-field-options').find(':selected').should('have.text', 'Reviewer');

                    // * The ASSIGN TO A PERSON section is still visible
                    cy.findByText('ASSIGN TO A PERSON').should('exist');
                });
            });
        });

        it('selecting a run attribute persists assignee_type and field id to the server', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Attribute Server Persist Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.playbooksAddPropertyFieldViaUI(playbook.id, 'Reviewer', 'user');

                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');
                cy.get('#checklists').within(() => {
                    cy.findByTestId('role-options').select('property_user');
                    cy.findByTestId('property-user-field-options').select('Reviewer');
                });
                cy.wait('@UpdatePlaybook');

                // * Verify persistence: re-navigate to the outline and reopen the editor
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');
                cy.get('#checklists').within(() => {
                    cy.findByTestId('role-options').should('have.value', 'property_user');
                    cy.findByTestId('property-user-field-options').find(':selected').should('have.text', 'Reviewer');
                });
            });
        });

        it('reopening the editor shows the previously selected run attribute', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Attribute Reopen Value Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.playbooksAddPropertyFieldViaUI(playbook.id, 'Reviewer', 'user');

                // # Select the run attribute
                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');
                cy.get('#checklists').within(() => {
                    cy.findByTestId('role-options').select('property_user');
                    cy.findByTestId('property-user-field-options').select('Reviewer');
                });

                // # Wait for save+refetch to complete (refetch closes the editor)
                cy.wait('@UpdatePlaybook');

                // # Reopen the editor on the now-refreshed page
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');

                cy.get('#checklists').within(() => {
                    // * Run User role must be selected and sub-dropdown must show Reviewer
                    cy.findByTestId('role-options').should('have.value', 'property_user');
                    cy.findByTestId('property-user-field-options').find(':selected').should('have.text', 'Reviewer');
                });
            });
        });

        it('switching between run attribute options updates the selected value', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Attribute Switch Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.playbooksAddPropertyFieldViaUI(playbook.id, 'Reviewer', 'user');
                cy.playbooksAddPropertyFieldViaUI(playbook.id, 'Approver', 'user');

                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');

                cy.get('#checklists').within(() => {
                    // # Select Run User role, then pick Reviewer
                    cy.findByTestId('role-options').select('property_user');
                    cy.findByTestId('property-user-field-options').select('Reviewer');
                    cy.findByTestId('property-user-field-options').find(':selected').should('have.text', 'Reviewer');
                });

                // # Wait for save+refetch to complete (refetch closes the editor)
                cy.wait('@UpdatePlaybook');

                // # Reopen editor and switch to Approver
                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');

                cy.get('#checklists').within(() => {
                    // # Switch to Approver
                    cy.findByTestId('property-user-field-options').select('Approver');

                    // * Dropdown now shows Approver
                    cy.findByTestId('property-user-field-options').find(':selected').should('have.text', 'Approver');

                    // * Reviewer is no longer the selected value
                    cy.findByTestId('property-user-field-options').find(':selected').should('not.have.text', 'Reviewer');
                });
            });
        });

        it('shows the field name badge in read-only mode within a run', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Attribute Badge Run Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Attribute Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Add a user-type property field via the attributes UI
                cy.playbooksAddPropertyFieldViaUI(playbook.id, 'Reviewer', 'user');

                // # Pre-set the assignment via the template editor and save
                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Attribute Task');
                cy.get('#checklists').within(() => {
                    cy.findByTestId('role-options').select('property_user');
                    cy.findByTestId('property-user-field-options').select('Reviewer');
                });
                cy.wait('@UpdatePlaybook');

                // # Start the run via UI — lands on the run detail page
                cy.playbooksStartRunViaModal(playbook.id, 'Attribute Badge Run ' + getRandomId());

                // * The task must render the field name badge in the run checklist
                cy.findByTestId('property-user-indicator-badge').should('exist');
                cy.findByTestId('property-user-indicator-badge').should('contain', 'Reviewer');

                // * Verify via API that the run's checklist item has assignee_type set to property_user
                cy.playbooksGetRunIdFromUrl().then((runId) => {
                    cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                        expect(run.checklists[0].items[0].assignee_type).to.equal('property_user');
                    });
                });
            });
        });

        it('non-user property fields do not appear in the Run User sub-dropdown', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Attribute Filter Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Add a user field and a non-user (select) field via the attributes UI
                cy.playbooksAddPropertyFieldViaUI(playbook.id, 'Reviewer', 'user');
                cy.playbooksAddPropertyFieldViaUI(playbook.id, 'Priority', 'select');

                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');

                // * Verify via API that Priority field has type 'select' (not 'user') so filtering it is correct
                cy.apiGetPropertyFields(playbook.id).then((fields) => {
                    const field = fields.find((f) => f.name === 'Priority');
                    expect(field.type).to.equal('select');
                    expect(field.type).to.not.equal('user');
                });

                cy.get('#checklists').within(() => {
                    // * The Run User option must exist (user field present)
                    cy.findByTestId('role-options').find('option[value="property_user"]').should('exist');

                    // # Open the sub-dropdown
                    cy.findByTestId('role-options').select('property_user');

                    // * Priority (select type) must NOT appear as an option in the sub-dropdown
                    cy.findByTestId('property-user-field-options').within(() => {
                        cy.contains('option', 'Priority').should('not.exist');
                    });
                });
            });
        });
    });
});
