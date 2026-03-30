// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId, resolvedDisplayName} from '../../../utils';

describe('runs > {OWNER} and {CREATOR} template tokens', {testIsolation: true}, () => {
    let testTeam;
    let testOwner;
    let testCreator;
    let testNewOwner;
    let createdPlaybookIds = [];

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

    it('{OWNER} in run name template resolves to the owner display name at creation', () => {
        cy.apiLogin(testOwner);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Owner Token Playbook ' + getRandomId(),
            memberIDs: [testOwner.id],
            makePublic: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiPatchPlaybook(playbook.id, {channel_name_template: 'Run by {OWNER}'}).then(() => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Owner Token Run ' + getRandomId(),
                    ownerUserId: testOwner.id,
                }).then((run) => {
                    const ownerName = resolvedDisplayName(testOwner);

                    // * Visit run details page and verify the resolved run name is shown
                    cy.playbooksVisitRun(run.id);
                    cy.get('h1').should('not.contain', '{OWNER}');
                    cy.get('h1').should('contain', ownerName);

                    // * Run name must contain the resolved owner display name
                    cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                        expect(runData.name, 'run name should not contain raw {OWNER} token').to.not.include('{OWNER}');
                        expect(runData.name, 'run name should contain owner display name').to.include(ownerName);
                    });
                });
            });
        });
    });

    it('{CREATOR} in run name template resolves to the run creator display name', () => {
        // # Login as testOwner to create the playbook, then testCreator starts the run
        cy.apiLogin(testOwner);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Creator Token Playbook ' + getRandomId(),
            memberIDs: [testOwner.id, testCreator.id],
            makePublic: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiPatchPlaybook(playbook.id, {channel_name_template: 'Started by {CREATOR}'}).then(() => {
                // # testCreator starts the run — they become reporter_user_id
                cy.apiLogin(testCreator);
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Creator Token Run ' + getRandomId(),
                    ownerUserId: testOwner.id,
                }).then((run) => {
                    const creatorName = resolvedDisplayName(testCreator);

                    // * Visit run details page and verify the resolved run name is shown
                    cy.playbooksVisitRun(run.id);
                    cy.get('h1').should('not.contain', '{CREATOR}');
                    cy.get('h1').should('contain', creatorName);

                    // * Run name must contain testCreator's display name, not the owner's
                    cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                        expect(runData.name, 'run name should not contain raw {CREATOR} token').to.not.include('{CREATOR}');
                        expect(runData.name, 'run name should contain creator display name').to.include(creatorName);
                        expect(runData.name, 'run name should NOT contain owner display name in CREATOR slot').to.not.include(resolvedDisplayName(testOwner));
                    });
                });
            });
        });
    });

    it('{OWNER} and {CREATOR} resolve independently in the same run name template', () => {
        cy.apiLogin(testOwner);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Both Tokens Playbook ' + getRandomId(),
            memberIDs: [testOwner.id, testCreator.id],
            makePublic: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{CREATOR} for {OWNER}'}).then(() => {
                // # testCreator starts the run, testOwner is the owner — they differ
                cy.apiLogin(testCreator);
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Both Tokens Run ' + getRandomId(),
                    ownerUserId: testOwner.id,
                }).then((run) => {
                    const ownerName = resolvedDisplayName(testOwner);
                    const creatorName = resolvedDisplayName(testCreator);

                    // * Visit run details page and verify both names appear (no raw tokens)
                    cy.playbooksVisitRun(run.id);
                    cy.get('h1').should('not.contain', '{OWNER}');
                    cy.get('h1').should('not.contain', '{CREATOR}');

                    cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                        expect(runData.name).to.not.include('{OWNER}');
                        expect(runData.name).to.not.include('{CREATOR}');
                        expect(runData.name, 'owner display name should appear').to.include(ownerName);
                        expect(runData.name, 'creator display name should appear').to.include(creatorName);
                    });
                });
            });
        });
    });

    it('{SEQ}, {OWNER}, and {CREATOR} all resolve together in the same template', () => {
        cy.apiLogin(testOwner);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'All System Tokens Playbook ' + getRandomId(),
            memberIDs: [testOwner.id, testCreator.id],
            makePublic: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiPatchPlaybook(playbook.id, {run_number_prefix: 'TST', channel_name_template: '{SEQ} by {CREATOR} owned by {OWNER}'}).then(() => {
                cy.apiLogin(testCreator);
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'All Tokens Run ' + getRandomId(),
                    ownerUserId: testOwner.id,
                }).then((run) => {
                    const ownerName = resolvedDisplayName(testOwner);
                    const creatorName = resolvedDisplayName(testCreator);

                    // * Visit run details page and verify resolved name (no raw tokens remain)
                    cy.playbooksVisitRun(run.id);
                    cy.get('h1').should('not.contain', '{SEQ}');
                    cy.get('h1').should('not.contain', '{OWNER}');
                    cy.get('h1').should('not.contain', '{CREATOR}');
                    cy.get('h1').should('contain', 'TST-');

                    cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                        // * All three system tokens must be resolved — no raw token remains
                        expect(runData.name).to.not.include('{SEQ}');
                        expect(runData.name).to.not.include('{OWNER}');
                        expect(runData.name).to.not.include('{CREATOR}');

                        // * Sequential ID prefix must appear
                        expect(runData.name, 'SEQ token should resolve to prefix').to.include('TST-');
                        expect(runData.name, 'owner name should appear').to.include(ownerName);
                        expect(runData.name, 'creator name should appear').to.include(creatorName);

                        // * sequential_id must be stored (not just rendered)
                        expect(runData.sequential_id).to.not.be.empty;
                        expect(runData.sequential_id).to.include('TST-');
                    });
                });
            });
        });
    });

    it('reporter_user_id is immutable — stays as original creator after owner reassignment', () => {
        // This test verifies the invariant that drives CREATOR token immutability:
        // ReporterUserID is captured at run creation and never mutated by owner changes.
        cy.apiLogin(testCreator);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Creator Immutability Playbook ' + getRandomId(),
            memberIDs: [testOwner.id, testCreator.id, testNewOwner.id],
            makePublic: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Creator Immutability Run ' + getRandomId(),
                ownerUserId: testOwner.id,
            }).then((run) => {
                // * reporter_user_id must be testCreator immediately after creation
                cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                    expect(runData.reporter_user_id, 'creator set at creation').to.equal(testCreator.id);
                    expect(runData.owner_user_id, 'owner set at creation').to.equal(testOwner.id);
                });

                // # Change owner via the RHS profile selector in the channel view
                cy.apiLogin(testOwner);
                cy.apiAddUsersToRun(run.id, [testNewOwner.id]);

                cy.playbooksVisitRunChannel(testTeam.name, run);
                cy.playbooksChangeRunOwnerViaRHS(testNewOwner.username);

                // * owner_user_id updated; reporter_user_id (CREATOR) stays on testCreator
                cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                    expect(runData.owner_user_id, 'owner should be updated').to.equal(testNewOwner.id);
                    expect(runData.reporter_user_id, 'creator should be unchanged').to.equal(testCreator.id);
                    expect(runData.reporter_user_id, 'creator should NOT equal new owner').to.not.equal(testNewOwner.id);
                });
            });
        });
    });

    it('{OWNER} token reflects new owner after reassignment; {CREATOR} reflects original creator', () => {
        // Tests the semantic difference between OWNER and CREATOR in the run name template
        // when owner ≠ creator from the start.
        cy.apiLogin(testOwner);

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Owner Change Token Playbook ' + getRandomId(),
            memberIDs: [testOwner.id, testCreator.id, testNewOwner.id],
            makePublic: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiPatchPlaybook(playbook.id, {channel_name_template: 'Owner={OWNER} Creator={CREATOR}'}).then(() => {
                // # testCreator starts the run with testOwner as initial owner
                cy.apiLogin(testCreator);
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Owner Change Token Run ' + getRandomId(),
                    ownerUserId: testOwner.id,
                }).then((run) => {
                    // * Run name at creation: OWNER=testOwner, CREATOR=testCreator
                    const initialOwnerName = resolvedDisplayName(testOwner);
                    const creatorName = resolvedDisplayName(testCreator);

                    // * Visit run page and verify both names appear in the displayed run name
                    cy.playbooksVisitRun(run.id);
                    cy.get('h1').should('contain', initialOwnerName);
                    cy.get('h1').should('contain', creatorName);

                    cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                        expect(runData.name).to.include(initialOwnerName);
                        expect(runData.name).to.include(creatorName);
                    });

                    // # Change owner via RHS profile selector
                    cy.apiLogin(testOwner);
                    cy.apiAddUsersToRun(run.id, [testNewOwner.id]);

                    cy.playbooksVisitRunChannel(testTeam.name, run);
                    cy.playbooksChangeRunOwnerViaRHS(testNewOwner.username);

                    // * reporter_user_id (CREATOR) must stay on testCreator
                    cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                        expect(runData.owner_user_id, 'owner updated').to.equal(testNewOwner.id);
                        expect(runData.reporter_user_id, 'creator unchanged').to.equal(testCreator.id);
                    });
                });
            });
        });
    });
});
