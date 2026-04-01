// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > task assignee — group and run attribute selection', {testIsolation: true}, () => {
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
    // Group assignment                                                     //
    // ------------------------------------------------------------------ //

    describe('group assignment', () => {
        let testGroup;

        before(() => {
            // # Create a custom group that will appear in the assignee dropdown.
            // testTeam and testUser are already set by the outer before block.
            cy.apiLogin(testUser);
            cy.apiCreateCustomGroup(
                'Playbooks QA Group ' + getRandomId(),
                'pb-qa-' + getRandomId(),
                [testUser.id],
            ).then((group) => {
                testGroup = group;
            });
        });

        it('selecting a group from the dropdown immediately reflects the selected value', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Group Selection Visual Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');

                cy.get('#checklists').within(() => {
                    // # Select the group from the dropdown
                    cy.findByTestId('group-options').select(testGroup.id);

                    // * The dropdown must immediately show the selected group
                    cy.findByTestId('group-options').should('have.value', testGroup.id);
                });
            });
        });

        it('selected group retains its value after selection', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Group Retain Value Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');

                cy.get('#checklists').within(() => {
                    cy.findByTestId('group-options').select(testGroup.id);

                    // * Selected value persists without any save action
                    cy.findByTestId('group-options').should('have.value', testGroup.id);

                    // * The ASSIGN TO A PERSON section is still visible
                    cy.findByText('ASSIGN TO A PERSON').should('exist');
                });
            });
        });

        it('selecting a group persists assignee_type and assignee_group_id to the server', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Group Server Persist Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');
                cy.get('#checklists').within(() => {
                    cy.findByTestId('group-options').select(testGroup.id);
                });
                cy.wait('@UpdatePlaybook');

                // * Verify persistence: reload the outline page and reopen the task editor
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');
                cy.get('#checklists').within(() => {
                    cy.findByTestId('group-options').should('have.value', testGroup.id);
                });
            });
        });

        it('reopening the editor shows the previously selected group', () => {
            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Group Reopen Value Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Select the group
                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');
                cy.get('#checklists').within(() => {
                    cy.findByTestId('group-options').select(testGroup.id);
                });
                cy.wait('@UpdatePlaybook');
                cy.playbooksReopenTaskAssigneeEditor('Assignee Task');

                cy.get('#checklists').within(() => {
                    // * The dropdown must show the previously selected group after reopening
                    cy.findByTestId('group-options').should('have.value', testGroup.id);
                });
            });
        });

        it('switching to a different group updates the selected value', () => {
            cy.apiLogin(testUser);

            cy.apiCreateCustomGroup(
                'Second QA Group ' + getRandomId(),
                'pb-qa2-' + getRandomId(),
                [testUser.id],
            ).then((secondGroup) => {
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Group Switch Playbook ' + getRandomId(),
                    memberIDs: [testUser.id],
                    makePublic: true,
                    createPublicPlaybookRun: true,
                    checklists: [{title: 'Stage 1', items: [{title: 'Assignee Task'}]}],
                }).then((playbook) => {
                    createdPlaybookIds.push(playbook.id);
                    cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');

                    cy.get('#checklists').within(() => {
                        // # Select the first group
                        cy.findByTestId('group-options').select(testGroup.id);
                        cy.findByTestId('group-options').should('have.value', testGroup.id);

                        // # Switch to the second group
                        cy.findByTestId('group-options').select(secondGroup.id);

                        // * Dropdown now shows the second group
                        cy.findByTestId('group-options').should('have.value', secondGroup.id);

                        // * First group is no longer the selected value
                        cy.findByTestId('group-options').should('not.have.value', testGroup.id);
                    });
                });
            });
        });

        it('shows the group name badge in read-only mode within a run', () => {
            cy.apiLogin(testUser);

            // # Create a playbook with a group-assigned task pre-set via API
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Group Badge Run Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{
                    title: 'Stage 1',
                    items: [{
                        title: 'Group Task',
                        assignee_type: 'group',
                        assignee_group_id: testGroup.id,
                    }],
                }],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Start the run via UI — lands on the run detail page
                cy.playbooksStartRunViaModal(playbook.id, 'Group Badge Run ' + getRandomId());

                // * The task must render the group badge in the run checklist
                cy.findByTestId('group-indicator-badge').should('exist');
                cy.findByTestId('group-indicator-badge').should('contain', testGroup.display_name);
            });
        });

        it('shows the group name badge in the channel RHS checklist view', () => {
            cy.apiLogin(testUser);

            // # Create a playbook with a group-assigned task pre-set via API
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Group Badge RHS Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{
                    title: 'Stage 1',
                    items: [{
                        title: 'Group RHS Task',
                        assignee_type: 'group',
                        assignee_group_id: testGroup.id,
                    }],
                }],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Start the run via API so we have the run object with channel_id
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Group Badge RHS Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((run) => {
                    // # Navigate to the run's channel — the RHS checklist is shown here
                    cy.playbooksVisitRunChannel(testTeam.name, run);

                    // * The group badge must be visible in the RHS checklist
                    cy.get('#rhsContainer').within(() => {
                        cy.findByTestId('group-indicator-badge').should('exist');
                        cy.findByTestId('group-indicator-badge').should('contain', testGroup.display_name);
                    });
                });
            });
        });
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
                cy.wait('@UpdatePlaybook');
                cy.playbooksReopenTaskAssigneeEditor('Assignee Task');

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

                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Assignee Task');

                cy.get('#checklists').within(() => {
                    // # Select Run User role, then pick Reviewer
                    cy.findByTestId('role-options').select('property_user');
                    cy.findByTestId('property-user-field-options').select('Reviewer');
                    cy.findByTestId('property-user-field-options').find(':selected').should('have.text', 'Reviewer');

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
