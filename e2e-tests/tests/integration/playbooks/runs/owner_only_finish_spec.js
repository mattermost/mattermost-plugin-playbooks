// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > owner only finish', {testIsolation: true}, () => {
    // Team and users are shared between both modes.
    let testTeam;
    let testOwner;
    let testParticipant;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testOwner = user;

            cy.apiCreateAndAddUserToTeam(testTeam.id).then((newUser) => {
                testParticipant = newUser;
            });
        });
    });

    // ---------------------------------------------------------------
    // Mode 1 — no custom status field configured
    //
    // rhs-finish-section is the finish surface (plain "Finish" button
    // when no Status field is configured, or a status dropdown when the
    // system auto-creates one). Either way it should be visible only to
    // the owner.  The /playbook finish slash command is also owner-only.
    // ---------------------------------------------------------------
    describe('without custom status field', () => {
        let testPlaybook;
        let testPlaybookRun;

        // Assert that the current user can see the finish section in the RHS
        const assertCanFinish = () => {
            cy.findByTestId('rhs-finish-section').should('be.visible');
        };

        // Assert that the current user cannot see the finish section in the RHS
        const assertCannotFinish = () => {
            cy.findByTestId('rhs-finish-section').should('not.exist');
        };

        beforeEach(() => {
            cy.viewport('macbook-13');
            cy.apiLogin(testOwner);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Owner Only Playbook ' + getRandomId(),
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Enable owner_group_only_actions via the playbook editor UI toggle
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
                cy.playbooksToggleWithConfirmation('owner-group-only-actions-toggle');

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Owner Only Run ' + getRandomId(),
                    ownerUserId: testOwner.id,
                }).then((playbookRun) => {
                    testPlaybookRun = playbookRun;
                    cy.apiAddUsersToRun(testPlaybookRun.id, [testParticipant.id]);
                });
            });
        });

        afterEach(() => {
            // Use sysadmin for cleanup: ownership may have been transferred during
            // the test (e.g. "old owner cannot finish after reassignment"), which
            // would cause a 403 if we tried to finish as testOwner.
            cy.apiAdminLogin();
            if (testPlaybookRun) {
                cy.apiFinishRun(testPlaybookRun.id);
            }
            if (testPlaybook) {
                cy.apiArchivePlaybook(testPlaybook.id);
            }
        });

        // --- RHS (channel view) ---

        it('shows finish section in RHS to the run owner', () => {
            cy.apiLogin(testOwner);
            cy.playbooksVisitRunChannel(testTeam.name, testPlaybookRun);
            assertCanFinish();
        });

        it('hides finish section in RHS from non-owner participant', () => {
            cy.apiLogin(testParticipant);
            cy.playbooksVisitRunChannel(testTeam.name, testPlaybookRun);
            assertCannotFinish();
        });

        // --- Slash command ---

        it('slash command /playbook finish returns permission error to non-owner participant', () => {
            cy.apiLogin(testParticipant);
            cy.playbooksVisitRunChannel(testTeam.name, testPlaybookRun);

            cy.uiPostMessageQuickly('/playbook finish');
            cy.verifyEphemeralMessage(`userID \`${testParticipant.id}\` is not an admin or channel member`);

            // * Assert backend: run is still active (not finished)
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
                expect(run.current_status).to.not.equal('Finished');
            });
        });

        it('old owner cannot finish the run after ownership is reassigned to another user', () => {
            // # Verify original owner can see the finish section before reassignment
            cy.apiLogin(testOwner);
            cy.playbooksVisitRunChannel(testTeam.name, testPlaybookRun);

            // * Original owner should see the finish section
            assertCanFinish();

            // # Reassign ownership to testParticipant via UI (RHS owner selector)
            cy.playbooksChangeRunOwnerViaRHS(testParticipant.username);

            // # Confirm the owner change was persisted on the server
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
                expect(run.owner_user_id).to.equal(testParticipant.id);
            });

            // # Reload the channel page as the old owner
            cy.playbooksVisitRunChannel(testTeam.name, testPlaybookRun);

            // * Old owner should no longer see the finish section
            assertCannotFinish();

            // # Login as the new owner (testParticipant) and visit the run channel
            cy.apiLogin(testParticipant);
            cy.playbooksVisitRunChannel(testTeam.name, testPlaybookRun);

            // * New owner should now see the finish section
            assertCanFinish();
        });

        it('owner can finish the run end-to-end via RHS', () => {
            // # Login as the owner and visit the run channel
            cy.apiLogin(testOwner);
            cy.playbooksVisitRunChannel(testTeam.name, testPlaybookRun);

            // * Verify the finish section is visible
            assertCanFinish();

            // # Finish the run via the RHS finish button
            cy.findByTestId('rhs-finish-section').findByRole('button', {name: /Finish/i}).click();

            // # Confirm the finish modal
            cy.playbooksConfirmFinishModal();

            // * Verify via API that the run is actually finished
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
                expect(run.current_status).to.equal('Finished');
                expect(run.end_at).to.be.greaterThan(0);
            });

            // * Verify the associated channel was not deleted (delete_at should be 0)
            cy.apiGetChannel(testPlaybookRun.channel_id).then(({channel}) => {
                expect(channel.delete_at).to.equal(0);
            });
        });

        it('system admin can finish the run even when not the owner', () => {
            // * Assert backend: run is still active before admin clicks finish
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
                expect(run.current_status).to.not.equal('Finished');
            });

            // # Login as sysadmin
            cy.apiAdminLogin();

            // # Visit the run channel as sysadmin
            cy.playbooksVisitRunChannel(testTeam.name, testPlaybookRun);

            // * Sysadmin should see the finish section (admin bypass)
            assertCanFinish();
        });

        it('playbook admin (non-owner) cannot see the finish section', () => {
            // # Create a playbook admin user
            cy.apiCreateAndAddUserToTeam(testTeam.id).then((playbookAdminUser) => {
                // * Assert backend: playbook admin is not the run owner
                cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
                    expect(run.owner_user_id).to.not.equal(playbookAdminUser.id);
                });

                // # Add as playbook admin
                cy.apiLogin(testOwner);
                cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                    const updatedMembers = [
                        ...playbook.members,
                        {user_id: playbookAdminUser.id, roles: ['playbook_member', 'playbook_admin']},
                    ];
                    cy.apiUpdatePlaybook({...playbook, members: updatedMembers});
                });

                // # Add to the run
                cy.apiAddUsersToRun(testPlaybookRun.id, [playbookAdminUser.id]);

                // # Login as playbook admin and visit the run channel
                cy.apiLogin(playbookAdminUser);
                cy.playbooksVisitRunChannel(testTeam.name, testPlaybookRun);

                // * Playbook admin should NOT see the finish section — owner-only
                // actions restrict finish to run owner + system admin. Playbook admins
                // can reassign ownership to themselves first, then finish (intentional
                // two-step workaround).
                assertCannotFinish();
            });
        });

        it('creator who is not the owner cannot finish the run', () => {
            // # Create a separate run where testOwner is the creator but testParticipant is the owner
            cy.apiLogin(testOwner);
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Creator Not Owner Playbook ' + getRandomId(),
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                // # Enable owner_group_only_actions via the playbook editor UI toggle
                cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);
                cy.playbooksToggleWithConfirmation('owner-group-only-actions-toggle');

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Creator Not Owner Run ' + getRandomId(),
                    ownerUserId: testParticipant.id,
                }).then((playbookRun) => {
                    cy.apiAddUsersToRun(playbookRun.id, [testOwner.id]);

                    // # Login as testOwner (the creator, not the owner) and visit the run channel
                    cy.apiLogin(testOwner);
                    cy.playbooksVisitRunChannel(testTeam.name, playbookRun);

                    // * Creator (non-owner) should not see the finish section
                    assertCannotFinish();

                    // # Login as testParticipant (the designated owner) and visit the run channel
                    cy.apiLogin(testParticipant);
                    cy.playbooksVisitRunChannel(testTeam.name, playbookRun);

                    // * Owner should see the finish section
                    assertCanFinish();

                    // # Cleanup: finish and archive the inner run/playbook
                    cy.apiAdminLogin();
                    cy.apiFinishRun(playbookRun.id);
                    cy.apiArchivePlaybook(playbook.id);
                });
            });
        });
    });

    // ---------------------------------------------------------------
    // Mode 2 — restore (un-finish) is equally owner-restricted
    //
    // When owner_group_only_actions is enabled, only the run owner or a
    // system admin can restore (un-finish) a run. Non-owner participants
    // are blocked at the API level with a 403.
    // ---------------------------------------------------------------
    describe('restore is owner-restricted', () => {
        let testPlaybook;
        let testPlaybookRun;

        beforeEach(() => {
            cy.viewport('macbook-13');
            cy.apiLogin(testOwner);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Owner Only Restore Playbook ' + getRandomId(),
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                testPlaybook = playbook;

                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
                cy.playbooksToggleWithConfirmation('owner-group-only-actions-toggle');

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Owner Only Restore Run ' + getRandomId(),
                    ownerUserId: testOwner.id,
                }).then((playbookRun) => {
                    testPlaybookRun = playbookRun;
                    cy.apiAddUsersToRun(testPlaybookRun.id, [testParticipant.id]);

                    // Finish the run so restore tests can proceed
                    cy.apiAdminLogin();
                    cy.apiFinishRun(testPlaybookRun.id);
                    cy.apiLogin(testOwner);
                });
            });
        });

        afterEach(() => {
            cy.apiAdminLogin();
            if (testPlaybookRun) {
                cy.apiFinishRun(testPlaybookRun.id);
            }
            if (testPlaybook) {
                cy.apiArchivePlaybook(testPlaybook.id);
            }
        });

        it('owner can restore the run via API', () => {
            cy.apiLogin(testOwner);
            cy.apiRestoreRun(testPlaybookRun.id);

            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
                expect(run.current_status).to.equal('InProgress');
            });
        });

        it('non-owner participant cannot restore the run', () => {
            cy.apiLogin(testParticipant);

            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: `/plugins/playbooks/api/v0/runs/${testPlaybookRun.id}/restore`,
                method: 'PUT',
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(403);
            });

            // * Run remains finished
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
                expect(run.current_status).to.equal('Finished');
            });
        });

        it('system admin can restore the run even when not the owner', () => {
            cy.apiAdminLogin();
            cy.apiRestoreRun(testPlaybookRun.id);

            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
                expect(run.current_status).to.equal('InProgress');
            });
        });
    });

    // ---------------------------------------------------------------
});
