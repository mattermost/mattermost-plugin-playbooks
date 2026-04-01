// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > role-based task assignment', {testIsolation: true}, () => {
    let testTeam;
    let testOwner;
    let testCreator;
    let testNewOwner;
    let createdPlaybookIds = [];

    const ROLE_OWNER = 'owner';
    const ROLE_CREATOR = 'creator';

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testOwner = user;

            cy.apiCreateAndAddUserToTeam(testTeam.id).then((newUser) => {
                testCreator = newUser;
            });

            cy.apiCreateAndAddUserToTeam(testTeam.id).then((newUser) => {
                testNewOwner = newUser;
            });
        });
    });

    afterEach(() => {
        cy.apiLogin(testOwner);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        createdPlaybookIds = [];
    });

    beforeEach(() => {
        cy.viewport('macbook-13');
    });

    it('task with assignee_type=owner is resolved to the run owner at creation', () => {
        cy.apiLogin(testOwner);

        // # Create a playbook with a plain task — no assignee_type set via API
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Owner Assignment Playbook ' + getRandomId(),
            memberIDs: [testOwner.id],
            makePublic: true,
            createPublicPlaybookRun: true,
            checklists: [{title: 'Stage 1', items: [{title: 'Owner Task'}]}],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Set assignee_type=owner via API patch
            cy.apiPatchPlaybook(playbook.id, {
                checklists: [{
                    title: 'Stage 1',
                    items: [{
                        title: 'Owner Task',
                        assignee_type: ROLE_OWNER,
                    }],
                }],
            });

            // * Verify the frontend persisted assignee_type to the server
            cy.apiGetPlaybook(playbook.id).then((resp) => {
                expect(resp.checklists[0].items[0].assignee_type).to.equal(ROLE_OWNER);
            });

            // # Start a run with testOwner as the owner
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Owner Assignment Run ' + getRandomId(),
                ownerUserId: testOwner.id,
            }).then((run) => {
                // * The owner-type task must resolve to the run owner's user ID
                cy.apiGetPlaybookRun(run.id).then((response) => {
                    expect(response.body.checklists[0].items[0].assignee_id).to.equal(testOwner.id);
                });
            });
        });
    });

    it('task with assignee_type=creator is resolved to the run creator at creation', () => {
        cy.apiLogin(testOwner);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Creator Assignment Playbook ' + getRandomId(),
            memberIDs: [testOwner.id, testCreator.id],
            makePublic: true,
            createPublicPlaybookRun: true,
            checklists: [{title: 'Stage 1', items: [{title: 'Creator Task'}]}],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Set assignee_type=creator via API patch
            cy.apiPatchPlaybook(playbook.id, {
                checklists: [{
                    title: 'Stage 1',
                    items: [{
                        title: 'Creator Task',
                        assignee_type: ROLE_CREATOR,
                    }],
                }],
            });

            // * Verify the frontend persisted assignee_type to the server
            cy.apiGetPlaybook(playbook.id).then((resp) => {
                expect(resp.checklists[0].items[0].assignee_type).to.equal(ROLE_CREATOR);
            });

            // # Login as testCreator and start the run (they become the reporter/creator)
            cy.apiLogin(testCreator);
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Creator Assignment Run ' + getRandomId(),
                ownerUserId: testOwner.id,
            }).then((run) => {
                cy.apiGetPlaybookRun(run.id).then((response) => {
                    const task = response.body.checklists[0].items[0];

                    // * The creator-type task must resolve to the run creator, not the owner
                    expect(task.assignee_id).to.equal(testCreator.id);
                    expect(task.assignee_id).to.not.equal(testOwner.id);
                });
            });
        });
    });

    it('changing run owner re-resolves owner-type tasks to the new owner', () => {
        cy.apiLogin(testOwner);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Owner Re-resolve Playbook ' + getRandomId(),
            memberIDs: [testOwner.id, testNewOwner.id],
            makePublic: true,
            createPublicPlaybookRun: true,
            checklists: [{title: 'Stage 1', items: [{title: 'Owner Task'}]}],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Set assignee_type=owner via API patch
            cy.apiPatchPlaybook(playbook.id, {
                checklists: [{
                    title: 'Stage 1',
                    items: [{
                        title: 'Owner Task',
                        assignee_type: ROLE_OWNER,
                    }],
                }],
            });

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Owner Re-resolve Run ' + getRandomId(),
                ownerUserId: testOwner.id,
            }).then((run) => {
                cy.apiAddUsersToRun(run.id, [testNewOwner.id]);

                // # Visit the run channel — RHS opens automatically
                cy.playbooksVisitRunChannel(testTeam.name, run);

                // * Task initially shows the original owner in the RHS
                cy.findByTestId('pb-checklists-inner-container').within(() => {
                    cy.contains('[data-testid="checkbox-item-container"]', 'Owner Task').within(() => {
                        cy.findByTestId('role-indicator-badge').should('contain', 'Run Owner');
                        cy.contains(testOwner.username).should('exist');
                    });
                });

                // # Change the run owner via the RHS profile selector
                cy.playbooksChangeRunOwnerViaRHS(testNewOwner.username);

                // * Owner-type task re-resolves to the new owner in the RHS
                cy.findByTestId('pb-checklists-inner-container').within(() => {
                    cy.contains('[data-testid="checkbox-item-container"]', 'Owner Task').within(() => {
                        cy.findByTestId('role-indicator-badge').should('contain', 'Run Owner');
                        cy.contains(testNewOwner.username).should('exist');
                    });
                });
            });
        });
    });

    it('changing run owner does NOT re-resolve creator-type tasks', () => {
        cy.apiLogin(testOwner);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Creator No Re-resolve Playbook ' + getRandomId(),
            memberIDs: [testOwner.id, testCreator.id, testNewOwner.id],
            makePublic: true,
            createPublicPlaybookRun: true,
            checklists: [{title: 'Stage 1', items: [{title: 'Creator Task'}]}],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Set assignee_type=creator via API patch
            cy.apiPatchPlaybook(playbook.id, {
                checklists: [{
                    title: 'Stage 1',
                    items: [{
                        title: 'Creator Task',
                        assignee_type: ROLE_CREATOR,
                    }],
                }],
            });

            cy.apiLogin(testCreator);
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Creator No Re-resolve Run ' + getRandomId(),
                ownerUserId: testOwner.id,
            }).then((run) => {
                cy.apiLogin(testOwner);
                cy.apiAddUsersToRun(run.id, [testNewOwner.id]);

                // # Visit the run channel — RHS opens automatically
                cy.playbooksVisitRunChannel(testTeam.name, run);

                // * Task initially shows the creator in the RHS
                cy.findByTestId('pb-checklists-inner-container').within(() => {
                    cy.contains('[data-testid="checkbox-item-container"]', 'Creator Task').within(() => {
                        cy.contains(testCreator.username).should('exist');
                    });
                });

                // # Change the run owner via the RHS profile selector
                cy.playbooksChangeRunOwnerViaRHS(testNewOwner.username);

                // * Creator-type task still shows the original creator, NOT the new owner
                cy.findByTestId('pb-checklists-inner-container').within(() => {
                    cy.contains('[data-testid="checkbox-item-container"]', 'Creator Task').within(() => {
                        cy.contains(testCreator.username).should('exist');
                    });
                });
            });
        });
    });

    it('manually assigned task is not re-resolved when owner changes', () => {
        cy.apiLogin(testOwner);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Manual Override Playbook ' + getRandomId(),
            memberIDs: [testOwner.id, testCreator.id, testNewOwner.id],
            makePublic: true,
            createPublicPlaybookRun: true,
            checklists: [{title: 'Stage 1', items: [{title: 'Owner Task'}]}],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Set assignee_type=owner via API patch
            cy.apiPatchPlaybook(playbook.id, {
                checklists: [{
                    title: 'Stage 1',
                    items: [{
                        title: 'Owner Task',
                        assignee_type: ROLE_OWNER,
                    }],
                }],
            });

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Manual Override Run ' + getRandomId(),
                ownerUserId: testOwner.id,
            }).then((run) => {
                cy.apiAddUsersToRun(run.id, [testCreator.id, testNewOwner.id]);

                // # Manually override the role-based assignment to a specific user
                cy.apiChangeChecklistItemAssignee(run.id, 0, 0, testCreator.id);

                // # Visit the run channel — RHS opens automatically
                cy.playbooksVisitRunChannel(testTeam.name, run);

                // * Task shows the manually-assigned user in the RHS
                cy.findByTestId('pb-checklists-inner-container').within(() => {
                    cy.contains('[data-testid="checkbox-item-container"]', 'Owner Task').within(() => {
                        cy.contains(testCreator.username).should('exist');
                    });
                });

                // # Change the run owner via the RHS profile selector
                cy.playbooksChangeRunOwnerViaRHS(testNewOwner.username);

                // * Manual assignment is preserved in the RHS; task still shows the manually-assigned user
                cy.findByTestId('pb-checklists-inner-container').within(() => {
                    cy.contains('[data-testid="checkbox-item-container"]', 'Owner Task').within(() => {
                        cy.contains(testCreator.username).should('exist');
                    });
                });
            });
        });
    });

    // Regression: editing any task through the UI must not silently wipe
    // assignee_type from sibling tasks in the same checklist. This was the
    // root-cause scenario: the useProxyState callback in checklist_list.tsx
    // mapped all items but omitted assignee_type, so every template save
    // reset it to '' on the server.
    // Regression: lock icon (TaskLockdownIcon) must appear in the playbook editor
    // when a task has assignee_type='owner' or 'creator'. Before the fix, the condition
    // in checklist_item.tsx was `assigneeID || assigneeGroupID`, which is always falsy
    // for role-based assignees, so the icon was never rendered.
    describe('lock icon visibility in editor for role-based assignees', () => {
        it('shows the lock icon toggle when assignee_type=owner and task is in edit mode', () => {
            cy.apiLogin(testOwner);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Lock Icon Owner Playbook ' + getRandomId(),
                memberIDs: [testOwner.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Owner Lock Task', assignee_type: ROLE_OWNER}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.visit('/playbooks/playbooks/' + playbook.id + '/outline');
                cy.get('#checklists').within(() => {
                    cy.contains('[data-testid="checkbox-item-container"]', 'Owner Lock Task').within(($item) => {
                        cy.wrap($item).trigger('mouseover');
                        cy.findByTestId('hover-menu-edit-button').click();

                        // * Lock icon must be visible when assignee_type=owner and editing
                        cy.findByTestId('lock-icon').should('exist');
                    });
                });
            });
        });

        it('shows the lock icon toggle when assignee_type=creator and task is in edit mode', () => {
            cy.apiLogin(testOwner);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Lock Icon Creator Playbook ' + getRandomId(),
                memberIDs: [testOwner.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Creator Lock Task', assignee_type: ROLE_CREATOR}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.visit('/playbooks/playbooks/' + playbook.id + '/outline');
                cy.get('#checklists').within(() => {
                    cy.contains('[data-testid="checkbox-item-container"]', 'Creator Lock Task').within(($item) => {
                        cy.wrap($item).trigger('mouseover');
                        cy.findByTestId('hover-menu-edit-button').click();

                        // * Lock icon must be visible when assignee_type=creator and editing
                        cy.findByTestId('lock-icon').should('exist');
                    });
                });
            });
        });

        it('toggling lock on an owner-assigned task persists restrict_completion_to_assignee=true', () => {
            cy.apiLogin(testOwner);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Lock Toggle Owner Playbook ' + getRandomId(),
                memberIDs: [testOwner.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Owner Lockable Task', assignee_type: ROLE_OWNER}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.visit('/playbooks/playbooks/' + playbook.id + '/outline');

                // # Alias the UpdatePlaybook mutation so we can wait for the debounced save
                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');

                cy.get('#checklists').within(() => {
                    cy.contains('[data-testid="checkbox-item-container"]', 'Owner Lockable Task').within(($item) => {
                        cy.wrap($item).trigger('mouseover');
                        cy.findByTestId('hover-menu-edit-button').click();

                        // # Click the lock icon to enable restrict_completion_to_assignee
                        cy.findByTestId('lock-icon').should('have.attr', 'data-locked', 'false');
                        cy.findByTestId('lock-icon').click();
                        cy.findByTestId('lock-icon').should('have.attr', 'data-locked', 'true');
                    });
                });

                // # Wait for the debounced UpdatePlaybook mutation to complete
                cy.wait('@UpdatePlaybook');

                // * Server must persist both assignee_type and restrict_completion_to_assignee
                cy.apiGetPlaybook(playbook.id).then((resp) => {
                    const item = resp.checklists[0].items[0];
                    expect(item.assignee_type).to.equal(ROLE_OWNER);
                    expect(item.restrict_completion_to_assignee).to.equal(true);
                });
            });
        });
    });

    it('editing one task via UI does not wipe assignee_type from sibling tasks', () => {
        cy.apiLogin(testOwner);

        // # Create a playbook where the first task already has a role assignment
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Sibling Regression Playbook ' + getRandomId(),
            memberIDs: [testOwner.id],
            makePublic: true,
            createPublicPlaybookRun: true,
            checklists: [{
                title: 'Stage 1',
                items: [
                    {title: 'Owner Task', assignee_type: ROLE_OWNER},
                    {title: 'Unassigned Task'},
                ],
            }],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Edit the unassigned sibling task's title via the UI.
            // This triggers a full checklists save that previously overwrote
            // assignee_type='' on Owner Task.
            cy.visit('/playbooks/playbooks/' + playbook.id + '/outline');

            // # Alias the UpdatePlaybook mutation so we can wait for the debounced save
            cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');

            cy.get('#checklists').within(() => {
                cy.contains('[data-testid="checkbox-item-container"]', 'Unassigned Task').within(($item) => {
                    cy.wrap($item).trigger('mouseover');
                    cy.findByTestId('hover-menu-edit-button').click();
                    cy.findByDisplayValue('Unassigned Task').clear().type('Renamed Task');
                });

                // Re-query the save button after typing (the $item ref above goes stale on re-render)
                cy.findByTestId('checklist-item-save-button').click();
            });

            // # Wait for the debounced UpdatePlaybook mutation to complete
            cy.wait('@UpdatePlaybook');

            // * Owner Task must still carry assignee_type=owner after the sibling edit
            cy.apiGetPlaybook(playbook.id).then((resp) => {
                const items = resp.checklists[0].items;
                const ownerTask = items.find((i) => i.title === 'Owner Task');
                expect(ownerTask).to.exist;
                expect(ownerTask.assignee_type).to.equal(ROLE_OWNER);
            });
        });
    });

    it('task item is accessible in the run checklist section', () => {
        cy.apiLogin(testOwner);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Task Item Access Playbook ' + getRandomId(),
            memberIDs: [testOwner.id],
            makePublic: true,
            createPublicPlaybookRun: true,
            checklists: [{title: 'Stage 1', items: [{title: 'Owner Task', assignee_type: ROLE_OWNER}]}],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Task Item Access Run ' + getRandomId(),
                ownerUserId: testOwner.id,
            }).then((run) => {
                cy.playbooksVisitRun(run.id);

                // * findTaskItem helper returns the correct container
                cy.playbooksFindTaskItem('Owner Task').should('exist');
            });
        });
    });

    describe('switching from role/group assignment to a user', () => {
        it('switching from role assignment to a specific user clears the role', () => {
            cy.apiLogin(testOwner);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Role-to-User Switch Playbook ' + getRandomId(),
                memberIDs: [testOwner.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Switchable Task', assignee_type: ROLE_OWNER}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Start a run so we can test in the run context
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Role-to-User Switch Run ' + getRandomId(),
                    ownerUserId: testOwner.id,
                }).then((run) => {
                    // * Verify the task starts with assignee_type=owner
                    cy.apiGetPlaybookRun(run.id).then((response) => {
                        const task = response.body.checklists[0].items[0];
                        expect(task.assignee_type).to.equal(ROLE_OWNER);
                    });

                    // # Visit the run channel to open the RHS
                    cy.playbooksVisitRunChannel(testTeam.name, run);

                    // # Manually reassign the task to a specific user via the API
                    cy.apiChangeChecklistItemAssignee(run.id, 0, 0, testOwner.id);

                    // * After reassignment, assignee_type must be cleared and assignee_id set
                    cy.apiGetPlaybookRun(run.id).then((response) => {
                        const task = response.body.checklists[0].items[0];
                        expect(task.assignee_id).to.equal(testOwner.id);
                        expect(task.assignee_type).to.equal('');
                    });

                    // * The task in the RHS must show the user profile, not the role badge
                    cy.findByTestId('pb-checklists-inner-container').within(() => {
                        cy.contains('[data-testid="checkbox-item-container"]', 'Switchable Task').within(() => {
                            cy.contains(testOwner.username).should('exist');
                            cy.findByTestId('role-indicator-badge').should('not.exist');
                        });
                    });
                });
            });
        });

        it('switching from role to user in the playbook editor clears assignee_type', () => {
            cy.apiLogin(testOwner);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Editor Role-to-User Playbook ' + getRandomId(),
                memberIDs: [testOwner.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{title: 'Stage 1', items: [{title: 'Switchable Task', assignee_type: ROLE_OWNER}]}],
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Open the task editor in the playbook outline
                cy.playbooksOpenTaskAssigneeEditor(playbook.id, 'Switchable Task');

                cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');

                cy.get('#checklists').within(() => {
                    // # Select "None" from the role dropdown to clear the role
                    cy.findByTestId('role-options').select('none');

                    // # Then assign a specific user via the profile selector
                    cy.findByTestId('assignee-profile-selector').click();
                });

                // # Pick the user from the profile selector dropdown (rendered as @username)
                cy.get('.playbook-react-select').contains('@' + testOwner.username).click();

                cy.wait('@UpdatePlaybook');

                // * Server must have assignee_type cleared and assignee_id set
                cy.apiGetPlaybook(playbook.id).then((resp) => {
                    const item = resp.checklists[0].items[0];
                    expect(item.assignee_type).to.equal('');
                    expect(item.assignee_id).to.equal(testOwner.id);
                });
            });
        });
    });

    it('changing owner in RHS preserves property_user task display', () => {
        // Regression: changing the run owner via the RHS profile selector used to
        // wipe property_values from the WebSocket update, causing the resolved
        // user profile on property_user tasks to disappear from the checklist.
        cy.apiLogin(testOwner);

        // # Create a playbook with a user-type property field and two tasks:
        //   one assigned to Run Owner, one assigned to the user property field.
        cy.apiCreatePlaybookWithProperties(
            {
                teamId: testTeam.id,
                title: 'PropUser Owner Change PB ' + getRandomId(),
                memberIDs: [testOwner.id, testNewOwner.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                checklists: [{
                    title: 'Stage 1',
                    items: [
                        {title: 'Owner Task', assignee_type: ROLE_OWNER},
                        {title: 'Manager Task'},
                    ],
                }],
            },
            [{name: 'Manager', type: 'user'}],
        ).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Fetch property fields separately (REST playbook response doesn't include them)
            cy.apiGetPropertyFields(playbook.id).then((propertyFields) => {
                const managerField = propertyFields.find((f) => f.name === 'Manager');
                expect(managerField).to.exist;

                // # Patch the second task to use property_user assignment
                cy.apiPatchPlaybook(playbook.id, {
                    checklists: [{
                        title: 'Stage 1',
                        items: [
                            {title: 'Owner Task', assignee_type: ROLE_OWNER},
                            {title: 'Manager Task', assignee_type: 'property_user', assignee_property_field_id: managerField.id},
                        ],
                    }],
                });

                // # Start the run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'PropUser Owner Change Run ' + getRandomId(),
                    ownerUserId: testOwner.id,
                }).then((run) => {
                    cy.apiAddUsersToRun(run.id, [testNewOwner.id]);

                    // # Set the Manager property to testNewOwner so the task resolves
                    cy.apiSetRunPropertyValueByName(run.id, 'Manager', testNewOwner.id);

                    // # Visit the run channel — the RHS opens automatically
                    cy.playbooksVisitRunChannel(testTeam.name, run);

                    // * The property_user task shows the "Run Manager" badge AND the resolved user
                    cy.findByTestId('pb-checklists-inner-container').within(() => {
                        cy.contains('[data-testid="checkbox-item-container"]', 'Manager Task').within(() => {
                            cy.findByTestId('property-user-indicator-badge').should('exist').and('contain', 'Manager');
                            cy.contains(testNewOwner.username).should('exist');
                        });
                    });

                    // # Change the owner via the RHS
                    cy.playbooksChangeRunOwnerViaRHS(testNewOwner.username);

                    // * Owner task now shows the new owner's profile and the Run Owner badge
                    cy.findByTestId('pb-checklists-inner-container').within(() => {
                        cy.contains('[data-testid="checkbox-item-container"]', 'Owner Task').within(() => {
                            cy.findByTestId('role-indicator-badge').should('contain', 'Run Owner');
                            cy.contains(testNewOwner.username).should('exist');
                        });
                    });

                    // * The property_user task STILL shows the badge AND the resolved user
                    //   (before the fix, the resolved user profile disappeared here)
                    cy.findByTestId('pb-checklists-inner-container').within(() => {
                        cy.contains('[data-testid="checkbox-item-container"]', 'Manager Task').within(() => {
                            cy.findByTestId('property-user-indicator-badge').should('exist').and('contain', 'Manager');
                            cy.contains(testNewOwner.username).should('exist');
                        });
                    });
                });
            });
        });
    });
});
