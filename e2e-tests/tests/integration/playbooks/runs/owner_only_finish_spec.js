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
            cy.verifyEphemeralMessage('You do not have permission to finish this run.');
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
});
