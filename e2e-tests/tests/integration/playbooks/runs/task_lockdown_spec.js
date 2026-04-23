// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > task lockdown', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let userA;
    let userB;
    let testPlaybook;
    let testRun;

    const LOCKED_TASK = 'Locked Task';
    const UNLOCKED_TASK = 'Unlocked Task';

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create user A then user B sequentially to ensure both are available before playbook setup
            cy.apiCreateAndAddUserToTeam(testTeam.id).then((newUser) => {
                userA = newUser;

                cy.apiCreateAndAddUserToTeam(testTeam.id).then((newUserB) => {
                    userB = newUserB;

                    // # Create the shared playbook with a locked task and an unlocked task
                    cy.apiLogin(user);
                    cy.apiCreatePlaybook({
                        teamId: team.id,
                        title: 'Task Lockdown Playbook ' + getRandomId(),
                        memberIDs: [],
                        makePublic: true,
                        createPublicPlaybookRun: true,
                        checklists: [
                            {
                                title: 'Stage 1',
                                items: [
                                    {
                                        title: LOCKED_TASK,
                                        restrict_completion_to_assignee: true,
                                    },
                                    {
                                        title: UNLOCKED_TASK,
                                    },
                                ],
                            },
                        ],
                    }).then((playbook) => {
                        testPlaybook = playbook;
                    });
                });
            });
        });
    });

    after(() => {
        cy.apiAdminLogin();
        cy.apiArchivePlaybook(testPlaybook.id);
    });

    beforeEach(() => {
        // # Size the viewport
        cy.viewport('macbook-13');

        // # Login as testUser and start a fresh run
        cy.apiLogin(testUser);
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Task Lockdown Run (' + getRandomId() + ')',
            ownerUserId: testUser.id,
        }).then((run) => {
            testRun = run;
        });
    });

    it('shows lock indicator (🔒) on a restricted task', () => {
        // # Visit run as testUser (the owner)
        cy.apiLogin(testUser);
        cy.playbooksVisitRun(testRun.id);

        // * Assert the lock indicator emoji is shown on the locked task (index 0)
        cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
            cy.get('[data-testid="lock-indicator"]').should('exist');
        });

        // * Assert backend: item 0 has restrict_completion_to_assignee = true
        cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
            expect(run.checklists[0].items[0].restrict_completion_to_assignee).to.equal(true);
        });
    });

    it('does not show lock indicator on an unrestricted task', () => {
        // # Visit run as testUser (the owner)
        cy.apiLogin(testUser);
        cy.playbooksVisitRun(testRun.id);

        // * Assert no lock indicator on the unlocked task (index 1)
        cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(1).within(() => {
            cy.get('[data-testid="lock-indicator"]').should('not.exist');
        });

        // * Assert backend: item 1 does not have restrict_completion_to_assignee = true
        cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
            expect(run.checklists[0].items[1].restrict_completion_to_assignee).to.equal(false);
        });
    });

    it('shows disabled checkbox when current user is not the assignee of a locked task', () => {
        // # Assign locked task to userA (testUser is NOT the assignee)
        cy.apiChangeChecklistItemAssignee(testRun.id, 0, 0, userA.id);

        // # Visit run as testUser (the owner, not the assignee)
        cy.apiLogin(testUser);
        cy.playbooksVisitRun(testRun.id);

        // * Assert the checkbox is disabled for a user who is not the assignee
        cy.playbooksAssertChecklistItem(0, {disabled: true});
    });

    it('shows enabled checkbox when current user IS the assignee of a locked task', () => {
        // # Assign locked task to testUser (they ARE the assignee)
        cy.apiChangeChecklistItemAssignee(testRun.id, 0, 0, testUser.id);

        // # Visit run as testUser (the assignee)
        cy.apiLogin(testUser);
        cy.playbooksVisitRun(testRun.id);

        // * Assert the checkbox is enabled for the assignee
        cy.playbooksAssertChecklistItem(0, {disabled: false});
    });

    it('shows enabled checkbox when locked task has no assignee (fail-open)', () => {
        // # No assignee set — task is restricted but unassigned

        // # Visit run as testUser
        cy.apiLogin(testUser);
        cy.playbooksVisitRun(testRun.id);

        // Verify the task still exists before asserting UI, and confirm restrict_completion_to_assignee
        cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
            // task should still exist
            expect(run.checklists[0].items).to.have.length.greaterThan(0);
            expect(run.checklists[0].items[0].restrict_completion_to_assignee).to.equal(true);
        });

        // * Assert the checkbox is enabled (no assignee = no restriction)
        cy.playbooksAssertChecklistItem(0, {disabled: false});
    });

    it('slash command /playbook check returns an error when non-assignee tries to toggle a locked task', () => {
        // # Assign locked task (checklist 0, item 0) to userA
        cy.apiChangeChecklistItemAssignee(testRun.id, 0, 0, userA.id);

        // # Add userA and userB to the run as participants
        cy.apiAddUsersToRun(testRun.id, [userA.id, userB.id]);

        // # Login as userB (participant, non-assignee)
        cy.apiLogin(userB);

        // # Navigate to the run's channel so the slash command reaches the right run
        cy.playbooksVisitRunChannel(testTeam.name, testRun);

        // # Post the /playbook check slash command for item 0 in checklist 0
        cy.uiPostMessageQuickly('/playbook check 0 0');

        // * Assert an ephemeral error message is shown (lockdown blocks the toggle)
        cy.verifyEphemeralMessage('Your request could not be completed');

        // # Login as testUser to verify the task was NOT completed
        cy.apiLogin(testUser);
        cy.apiGetPlaybookRun(testRun.id).then((response) => {
            const item = response.body.checklists[0].items[0];

            // * Assert item state is still open
            expect(item.state).to.equal('');
        });
    });

    it('non-assignee sees a disabled checkbox for a locked task (cannot complete it)', () => {
        // # Assign locked task to userA
        cy.apiChangeChecklistItemAssignee(testRun.id, 0, 0, userA.id);

        // # Add userB to the run as a participant
        cy.apiAddUsersToRun(testRun.id, [userA.id, userB.id]);

        // # Login as userB (participant, non-assignee) and visit the run
        cy.apiLogin(userB);
        cy.playbooksVisitRun(testRun.id);

        // * Assert the checkbox is disabled and not checked — non-assignee cannot complete it
        cy.playbooksAssertChecklistItem(0, {disabled: true, checked: false});
    });

    describe('group-assigned locked tasks', () => {
        let groupTeam;
        let groupOwner;
        let groupMember;
        let nonGroupMember;
        let testGroup;
        let groupPlaybook;
        let groupRun;

        before(() => {
            cy.apiAdminLogin();
            cy.apiInitSetup().then(({team, user}) => {
                groupTeam = team;
                groupOwner = user;

                // # Create groupMember then nonGroupMember sequentially to ensure both are available before group setup
                return cy.apiCreateAndAddUserToTeam(team.id);
            }).then((newUser) => {
                groupMember = newUser;

                return cy.apiCreateAndAddUserToTeam(groupTeam.id);
            }).then((newUser) => {
                nonGroupMember = newUser;
            }).then(() => {
                // # Create a custom group containing only groupMember
                cy.apiCreateCustomGroup(
                    'Task Lockdown Test Group',
                    'task-lockdown-grp-' + getRandomId(),
                    [groupMember.id],
                ).then((group) => {
                    testGroup = group;

                    // # Create playbook with a group-assigned locked task
                    cy.apiLogin(groupOwner);
                    cy.apiCreatePlaybook({
                        teamId: groupTeam.id,
                        title: 'Group Lockdown Playbook ' + getRandomId(),
                        memberIDs: [],
                        makePublic: true,
                        createPublicPlaybookRun: true,
                        checklists: [{
                            title: 'Stage 1',
                            items: [
                                {
                                    title: 'Group-Locked Task',
                                    assignee_type: 'group',
                                    assignee_group_id: testGroup.id,
                                    restrict_completion_to_assignee: true,
                                },
                                {title: UNLOCKED_TASK},
                            ],
                        }],
                    }).then((playbook) => {
                        groupPlaybook = playbook;
                    });
                });
            });
        });

        beforeEach(() => {
            cy.viewport('macbook-13');

            // Restore groupMember's membership in testGroup before each test.
            // If a previous attempt removed them (e.g. the 'member removed from group' test
            // calls apiRemoveGroupMembers), retries would start with the member missing.
            // Calling apiAddGroupMembers here is idempotent and ensures a clean baseline.
            cy.apiAdminLogin();
            cy.apiAddGroupMembers(testGroup.id, [groupMember.id]);

            cy.apiLogin(groupOwner);
            cy.apiRunPlaybook({
                teamId: groupTeam.id,
                playbookId: groupPlaybook.id,
                playbookRunName: 'Group Lockdown Run (' + getRandomId() + ')',
                ownerUserId: groupOwner.id,
            }).then((run) => {
                groupRun = run;
                cy.apiAddUsersToRun(run.id, [groupMember.id, nonGroupMember.id]);
            });
        });

        it('group member can complete a group-locked task', () => {
            // # Login as groupMember (in the group) and visit the run
            cy.apiLogin(groupMember);
            cy.playbooksVisitRun(groupRun.id);

            // * Assert checkbox is enabled for a group member, then click to complete
            cy.playbooksAssertChecklistItem(0, {disabled: false});

            cy.playbooksInterceptChecklistItemState();
            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                cy.findByTestId('task-checkbox').click();
            });
            cy.wait('@SetChecklistItemState');

            // * Assert the checkbox is now checked
            cy.playbooksAssertChecklistItem(0, {checked: true});

            // * Assert the backend state: item.state is 'closed'
            cy.apiGetPlaybookRun(groupRun.id).then((response) => {
                const item = response.body.checklists[0].items[0];
                expect(item.state, 'item state should be closed').to.equal('closed');

                // * Assert unlocked task (index 1) is still uncompleted
                expect(response.body.checklists[0].items[1].state).to.equal('');
            });
        });

        it('non-group member sees a disabled checkbox for a group-locked task', () => {
            // # Login as nonGroupMember (not in the group) and visit the run
            cy.apiLogin(nonGroupMember);
            cy.playbooksVisitRun(groupRun.id);

            // * Assert the checkbox is disabled and not checked — non-group member cannot complete it
            cy.playbooksAssertChecklistItem(0, {disabled: true, checked: false});
        });

        it('member removed from group loses checkbox access', () => {
            // Set up intercept before visiting so Cypress captures the groups fetch that
            // TaskLockdownCheckbox dispatches via getGroupsByUserId when it mounts.
            cy.intercept('GET', `/api/v4/users/${groupMember.id}/groups*`).as('fetchMyGroups');

            // # Login as groupMember (currently in the group) and visit the run
            cy.apiLogin(groupMember);
            cy.playbooksVisitRun(groupRun.id);

            // Wait for group membership to be fetched before asserting — ensures Redux
            // state is populated with the user's groups before the checkbox is checked.
            cy.wait('@fetchMyGroups');

            // * Assert checkbox is enabled — groupMember is a member of the group
            cy.playbooksAssertChecklistItem(0, {disabled: false});

            // # Remove groupMember from the group via the Mattermost REST API
            cy.apiRemoveGroupMembers(testGroup.id, [groupMember.id]);

            // # Confirm server has processed the membership change before reloading.
            // Group membership goes through the groups subsystem and may be eventually
            // consistent; verifying via the API prevents a spurious assertion failure.
            cy.apiGetGroupMembers(testGroup.id).then(({members}) => {
                expect(members.find((m) => m.user_id === groupMember.id)).to.be.undefined;
            });

            // Set up intercept for the groups re-fetch that happens after the page reload.
            cy.intercept('GET', `/api/v4/users/${groupMember.id}/groups*`).as('fetchMyGroupsAfterReload');

            // # Reload the run page — groupMember is no longer in the group
            cy.reload();

            // Wait for the updated group membership to be fetched before asserting.
            cy.wait('@fetchMyGroupsAfterReload');

            // * Assert checkbox is now disabled — groupMember lost group membership
            cy.playbooksAssertChecklistItem(0, {disabled: true});
        });
    });

    describe('owner-typed locked tasks (demo scenario)', () => {
        let ownerTeam;
        let ownerUser;
        let nonOwnerUser;
        let ownerPlaybook;
        let ownerRun;

        before(() => {
            cy.apiAdminLogin();
            cy.apiInitSetup().then(({team, user}) => {
                ownerTeam = team;
                ownerUser = user;

                cy.apiCreateAndAddUserToTeam(team.id).then((newUser) => {
                    nonOwnerUser = newUser;
                });

                cy.apiLogin(user);
                cy.apiCreatePlaybook({
                    teamId: team.id,
                    title: 'Owner-Typed Lockdown Playbook ' + getRandomId(),
                    memberIDs: [],
                    makePublic: true,
                    createPublicPlaybookRun: true,
                    checklists: [{
                        title: 'Containment',
                        items: [
                            {
                                title: 'Isolate affected systems',
                                assignee_type: 'owner',
                                restrict_completion_to_assignee: true,
                            },
                        ],
                    }],
                }).then((playbook) => {
                    ownerPlaybook = playbook;
                });
            });
        });

        beforeEach(() => {
            cy.viewport('macbook-13');
            cy.apiLogin(ownerUser);
            cy.apiRunPlaybook({
                teamId: ownerTeam.id,
                playbookId: ownerPlaybook.id,
                playbookRunName: 'Owner Lockdown Run (' + getRandomId() + ')',
                ownerUserId: ownerUser.id,
            }).then((run) => {
                ownerRun = run;
                cy.apiAddUsersToRun(run.id, [nonOwnerUser.id]);
            });
        });

        it('non-owner sees lock icon and a disabled checkbox on an owner-typed restricted task', () => {
            // # Login as non-owner and visit the run
            cy.apiLogin(nonOwnerUser);
            cy.playbooksVisitRun(ownerRun.id);

            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                // * Lock indicator must be visible
                cy.get('[data-testid="lock-indicator"]').should('exist');

                // * Checkbox must be disabled
                cy.get('[data-testid="task-checkbox"]').should('be.disabled');
            });
        });

        it('owner sees lock icon AND an enabled checkbox on an owner-typed restricted task', () => {
            // The lock icon is always shown — it does not disappear for the permitted user.
            // # Login as owner and visit the run
            cy.apiLogin(ownerUser);
            cy.playbooksVisitRun(ownerRun.id);

            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                // * Lock indicator must still be present for the owner
                cy.get('[data-testid="lock-indicator"]').should('exist');

                // * Checkbox must be enabled (owner is permitted)
                cy.get('[data-testid="task-checkbox"]').should('not.be.disabled');
            });
        });

        it('old owner loses checkbox access after owner is reassigned', () => {
            // # Login as ownerUser (the current owner) and verify the checkbox is enabled
            cy.apiLogin(ownerUser);
            cy.playbooksVisitRun(ownerRun.id);

            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                // * Checkbox must be enabled — ownerUser is still the owner at this point
                cy.get('[data-testid="task-checkbox"]').should('not.be.disabled');
            });

            // # Navigate to the run's channel so the RHS owner-profile-selector is available,
            // then reassign ownership to nonOwnerUser via the RHS.
            cy.playbooksVisitRunChannel(ownerTeam.name, ownerRun);
            cy.playbooksChangeRunOwnerViaRHS(nonOwnerUser.username);

            // # Confirm server has applied the ownership change before navigating back.
            cy.apiGetPlaybookRun(ownerRun.id).then(({body: playbookRun}) => {
                expect(playbookRun.owner_user_id).to.equal(nonOwnerUser.id);
            });

            // # Navigate back to the run detail page — ownerUser is no longer the owner
            cy.playbooksVisitRun(ownerRun.id);

            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                // * Checkbox must now be disabled — ownerUser lost the owner role
                cy.get('[data-testid="task-checkbox"]').should('be.disabled');
            });

            // * Assert new owner (nonOwnerUser) sees an enabled checkbox
            cy.apiLogin(nonOwnerUser);
            cy.playbooksVisitRunChannel(ownerTeam.name, ownerRun);
            cy.playbooksVisitRun(ownerRun.id);
            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                cy.get('[data-testid="task-checkbox"]').should('not.be.disabled');
            });
        });
    });

    describe('creator-typed locked tasks', () => {
        let creatorTeam;
        let runCreator;
        let separateOwner;
        let nonCreatorUser;
        let creatorPlaybook;
        let creatorRun;

        before(() => {
            cy.apiAdminLogin();
            cy.apiInitSetup().then(({team, user}) => {
                creatorTeam = team;
                runCreator = user;

                return cy.apiCreateAndAddUserToTeam(team.id);
            }).then((newUser) => {
                separateOwner = newUser;

                return cy.apiCreateAndAddUserToTeam(creatorTeam.id);
            }).then((newUser) => {
                nonCreatorUser = newUser;

                cy.apiLogin(runCreator);
                cy.apiCreatePlaybook({
                    teamId: creatorTeam.id,
                    title: 'Creator-Typed Lockdown Playbook ' + getRandomId(),
                    memberIDs: [],
                    makePublic: true,
                    createPublicPlaybookRun: true,
                    checklists: [{
                        title: 'Triage',
                        items: [
                            {
                                title: 'File initial incident report',
                                assignee_type: 'creator',
                                restrict_completion_to_assignee: true,
                            },
                        ],
                    }],
                }).then((playbook) => {
                    creatorPlaybook = playbook;
                });
            });
        });

        beforeEach(() => {
            cy.viewport('macbook-13');

            // # runCreator creates the run (becomes reporter/creator),
            //   but separateOwner is the owner — roles are cleanly separated.
            cy.apiLogin(runCreator);
            cy.apiRunPlaybook({
                teamId: creatorTeam.id,
                playbookId: creatorPlaybook.id,
                playbookRunName: 'Creator Lockdown Run (' + getRandomId() + ')',
                ownerUserId: separateOwner.id,
            }).then((run) => {
                creatorRun = run;
                cy.apiAddUsersToRun(run.id, [separateOwner.id, nonCreatorUser.id]);
            });
        });

        it('run creator sees lock icon AND an enabled checkbox on a creator-typed restricted task', () => {
            // # Login as run creator and visit the run
            cy.apiLogin(runCreator);
            cy.playbooksVisitRun(creatorRun.id);

            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                // * Lock indicator must be visible
                cy.get('[data-testid="lock-indicator"]').should('exist');

                // * Checkbox must be enabled (creator is permitted)
                cy.get('[data-testid="task-checkbox"]').should('not.be.disabled');
            });
        });

        it('non-creator sees lock icon AND a disabled checkbox on a creator-typed restricted task', () => {
            // # Login as non-creator and visit the run
            cy.apiLogin(nonCreatorUser);
            cy.playbooksVisitRun(creatorRun.id);

            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                // * Lock indicator must be visible
                cy.get('[data-testid="lock-indicator"]').should('exist');

                // * Checkbox must be disabled (non-creator cannot complete it)
                cy.get('[data-testid="task-checkbox"]').should('be.disabled');
            });
        });

        it('owner (who is not the creator) sees a disabled checkbox on a creator-typed restricted task', () => {
            // separateOwner is the run owner but NOT the creator — they must not
            // be able to complete a creator-typed locked task.

            // # Login as separateOwner (owner, not creator) and visit the run
            cy.apiLogin(separateOwner);
            cy.playbooksVisitRun(creatorRun.id);

            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                // * Checkbox must be DISABLED — separateOwner is the owner but not the creator
                cy.get('[data-testid="task-checkbox"]').should('be.disabled');
            });
        });

        it('owner reassignment does not affect creator access — creator retains enabled checkbox', () => {
            // Verify the creator role is bound to the run creator, not the current owner.
            // Even if ownership is transferred to nonCreatorUser, runCreator (the creator)
            // keeps the enabled checkbox.

            // # Reassign ownership from separateOwner to nonCreatorUser via the RHS
            cy.apiLogin(separateOwner);
            cy.playbooksVisitRunChannel(creatorTeam.name, creatorRun);
            cy.playbooksChangeRunOwnerViaRHS(nonCreatorUser.username);

            // # Confirm server has applied the ownership change
            cy.apiGetPlaybookRun(creatorRun.id).then(({body: playbookRun}) => {
                expect(playbookRun.owner_user_id).to.equal(nonCreatorUser.id);
            });

            // # Visit the run detail page as runCreator (never the owner, always the creator)
            cy.apiLogin(runCreator);
            cy.playbooksVisitRun(creatorRun.id);

            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                // * Checkbox must still be ENABLED — runCreator is the run creator regardless of owner role
                cy.get('[data-testid="task-checkbox"]').should('not.be.disabled');
            });

            // * Assert new owner (nonCreatorUser, who is not the creator) sees a DISABLED checkbox
            cy.apiLogin(nonCreatorUser);
            cy.playbooksVisitRun(creatorRun.id);
            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                cy.get('[data-testid="task-checkbox"]').should('be.disabled');
            });
        });

        it('new owner (who is not the creator) sees a disabled checkbox after reassignment', () => {
            // Reassign ownership to nonCreatorUser, then verify they cannot complete
            // even though they are now the owner.

            // # Reassign ownership from separateOwner to nonCreatorUser
            cy.apiLogin(separateOwner);
            cy.playbooksVisitRunChannel(creatorTeam.name, creatorRun);
            cy.playbooksChangeRunOwnerViaRHS(nonCreatorUser.username);

            // # Confirm ownership change
            cy.apiGetPlaybookRun(creatorRun.id).then(({body: playbookRun}) => {
                expect(playbookRun.owner_user_id).to.equal(nonCreatorUser.id);
            });

            // # Visit the run as nonCreatorUser (new owner, not the creator)
            cy.apiLogin(nonCreatorUser);
            cy.playbooksVisitRun(creatorRun.id);

            cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container').eq(0).within(() => {
                // * Checkbox must be DISABLED — new owner is not the run creator
                cy.get('[data-testid="task-checkbox"]').should('be.disabled');
            });
        });
    });
});
