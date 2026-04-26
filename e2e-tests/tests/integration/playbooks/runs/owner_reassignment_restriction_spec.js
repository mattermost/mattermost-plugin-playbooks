// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > owner reassignment restriction', {testIsolation: true}, () => {
    let testTeam;
    let testOwner;
    let testParticipant;
    let testNewOwner;
    let testPlaybook;
    let testPlaybookRun;
    let testChannelName;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testOwner = user;
            cy.apiCreateAndAddUserToTeam(testTeam.id).then((newUser) => {
                testParticipant = newUser;
                cy.apiCreateAndAddUserToTeam(testTeam.id).then((newUserB) => {
                    testNewOwner = newUserB;
                    cy.apiLogin(testOwner);
                    cy.apiCreatePlaybook({
                        teamId: testTeam.id,
                        title: 'Owner Reassignment Restricted Playbook ' + getRandomId(),
                        memberIDs: [],
                        makePublic: true,
                        createPublicPlaybookRun: true,
                    }).then((playbook) => {
                        testPlaybook = playbook;
                        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
                        cy.playbooksToggleWithConfirmation('owner-group-only-actions-toggle');
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport
        cy.viewport('macbook-13');

        // # Login as testOwner
        cy.apiLogin(testOwner);

        // # Start a fresh run for each test
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Restriction Run ' + getRandomId(),
            ownerUserId: testOwner.id,
        }).then((playbookRun) => {
            testPlaybookRun = playbookRun;

            // # Add participant and potential new owner to the run
            cy.apiAddUsersToRun(testPlaybookRun.id, [testParticipant.id, testNewOwner.id]);

            // * Brief verification that users were added before navigating
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
                expect(run.participant_ids).to.have.length.greaterThan(0);
            });

            // # Fetch the channel name so tests can navigate without extra API calls
            cy.apiGetChannel(testPlaybookRun.channel_id).then(({channel}) => {
                testChannelName = channel.name;
            });
        });
    });

    it('owner can reassign ownership to another participant', () => {
        // # Login as the current run owner
        cy.apiLogin(testOwner);

        // # Navigate to the run channel where the RHS owner selector is shown
        cy.visit(`/${testTeam.name}/channels/${testChannelName}`);

        // # Change ownership via the owner profile selector
        cy.playbooksChangeRunOwnerViaRHS(testNewOwner.username);

        // * Assert the owner-profile-selector now shows the new owner's username
        cy.findByTestId('owner-profile-selector').should('contain', testNewOwner.username);

        // * Assert via API that the ownership change was persisted server-side
        cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
            expect(run.owner_user_id, 'server should reflect the new owner').to.equal(testNewOwner.id);
        });
    });

    it('non-owner participant cannot open the owner selector or change ownership when owner_group_only_actions is enabled', () => {
        // # Login as participant (non-owner)
        cy.apiLogin(testParticipant);

        // # Navigate to the run channel
        cy.visit(`/${testTeam.name}/channels/${testChannelName}`);

        // # Attempt to click the owner profile selector
        cy.findByTestId('owner-profile-selector').click();

        // * Assert no dropdown options appear — the selector is read-only for non-owners
        cy.get('.playbook-react-select__option').should('not.exist');

        // * Assert the owner selector still shows the original owner's username
        cy.findByTestId('owner-profile-selector').should('contain', testOwner.username);

        // * Verify server-side: owner_user_id is unchanged
        cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
            expect(run.owner_user_id).to.equal(testOwner.id);
        });
    });

    it('slash command /playbook owner returns permission error to non-owner participant', () => {
        // # Login as participant (non-owner)
        cy.apiLogin(testParticipant);

        // # Navigate to the run's channel so the slash command reaches the right run
        cy.playbooksVisitRunChannel(testTeam.name, testPlaybookRun);

        // # Post the /playbook owner slash command targeting a different user
        cy.uiPostMessageQuickly(`/playbook owner @${testNewOwner.username}`);

        // * Assert the ephemeral error message is shown to the non-owner
        cy.verifyEphemeralMessage('You do not have permission to change the owner of this run.');

        // * Assert backend: owner_user_id is unchanged (still testOwner)
        cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
            expect(run.owner_user_id).to.equal(testOwner.id);
        });
    });

    it('playbook admin (non-owner) can reassign ownership when owner_group_only_actions is enabled', () => {
        // # Create a playbook admin user
        cy.apiCreateAndAddUserToTeam(testTeam.id).then((playbookAdminUser) => {
            // # Add as playbook admin
            cy.apiLogin(testOwner);
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                const updatedMembers = [
                    ...playbook.members,
                    {user_id: playbookAdminUser.id, roles: ['playbook_member', 'playbook_admin']},
                ];
                cy.apiUpdatePlaybook({...playbook, members: updatedMembers});
            });

            // # Add playbook admin to the run
            cy.apiAddUsersToRun(testPlaybookRun.id, [playbookAdminUser.id]);

            // # Login as playbook admin and navigate to the run channel
            cy.apiLogin(playbookAdminUser);
            cy.visit(`/${testTeam.name}/channels/${testChannelName}`);

            // # Change ownership via the owner profile selector
            cy.playbooksChangeRunOwnerViaRHS(testNewOwner.username);

            // * Assert the reassignment succeeded
            cy.findByTestId('owner-profile-selector').should('contain', testNewOwner.username);

            // * Assert via API that the ownership change was persisted
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: run}) => {
                expect(run.owner_user_id, 'playbook admin should be able to reassign ownership').to.equal(testNewOwner.id);
            });
        });
    });

    it('non-owner can reassign ownership when owner_group_only_actions is false', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Open Ownership Playbook ' + getRandomId(),
            memberIDs: [],
            makePublic: true,
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Open Ownership Run ' + getRandomId(),
                ownerUserId: testOwner.id,
            }).then((run) => {
                cy.apiAddUsersToRun(run.id, [testParticipant.id, testNewOwner.id]);
                cy.apiGetChannel(run.channel_id).then(({channel}) => {
                    cy.apiLogin(testParticipant);
                    cy.visit(`/${testTeam.name}/channels/${channel.name}`);
                    cy.playbooksChangeRunOwnerViaRHS(testNewOwner.username);
                    cy.findByTestId('owner-profile-selector').should('contain', testNewOwner.username);
                    cy.apiGetPlaybookRun(run.id).then(({body: updatedRun}) => {
                        expect(updatedRun.owner_user_id).to.equal(testNewOwner.id);
                    });
                });
            });
        });
    });
});
