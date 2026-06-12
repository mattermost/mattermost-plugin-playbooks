// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {formatSequentialID, getRandomId} from '../../../utils';

describe('runs > sequential id', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let createdPlaybookIds = [];
    let createdTeamIds = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        createdPlaybookIds = [];
        createdTeamIds = [];

        // # Size the viewport to show the runs list without covering elements
        cy.viewport('macbook-13');

        cy.apiLogin(testUser);
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        if (createdTeamIds.length > 0) {
            cy.apiAdminLogin();
            createdTeamIds.forEach((id) => cy.apiDeleteTeam(id));
        }
    });

    it('shows sequential IDs with configured prefix for runs in the list', () => {
        let testPlaybook;
        const firstRunName = 'First Run ' + getRandomId();
        const secondRunName = 'Second Run ' + getRandomId();

        // # Create a playbook with a run_number_prefix
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'INC Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            testPlaybook = playbook;
            createdPlaybookIds.push(playbook.id);
        });

        // # Use a fixed prefix to allow a hardcoded literal assertion below
        const incPrefix = 'INC';

        // # Set the run_number_prefix on the playbook (no trailing dash — FormatSequentialID adds it)
        cy.then(() => {
            return cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: incPrefix});
        });

        // # Start first run via API
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: firstRunName,
            ownerUserId: testUser.id,
        })).then((firstRun) => {
            // * Verify sequential_id is stored in backend (not just rendered in UI)
            cy.apiGetPlaybookRun(firstRun.id).then(({body: runData}) => {
                expect(runData.sequential_id).to.equal(formatSequentialID(incPrefix, 1));
            });
        });

        // # Start second run via API (after first completes)
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: secondRunName,
            ownerUserId: testUser.id,
        })).then((secondRun) => {
            // * Verify sequential_id is stored in backend (not just rendered in UI)
            cy.apiGetPlaybookRun(secondRun.id).then(({body: runData}) => {
                expect(runData.sequential_id).to.equal(formatSequentialID(incPrefix, 2));
            });
        });

        // # Visit the runs list
        cy.visit('/playbooks/runs');
        cy.findByTestId('playbookRunList').should('be.visible');

        // * Assert first run shows its sequential ID alongside its name
        cy.playbooksAssertSequentialIdInList(firstRunName, formatSequentialID(incPrefix, 1));

        // * Assert second run shows its sequential ID alongside its name
        cy.playbooksAssertSequentialIdInList(secondRunName, formatSequentialID(incPrefix, 2));
    });

    it('shows sequential ID badge as bare number when no prefix is configured', () => {
        const runName = 'No ID Run ' + getRandomId();
        let playbookId;
        let runId;

        // # Create a playbook WITHOUT a run_number_prefix
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'No Prefix Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            playbookId = playbook.id;
            createdPlaybookIds.push(playbook.id);
        });

        // # Start a run via API
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId,
            playbookRunName: runName,
            ownerUserId: testUser.id,
        })).then((testRun) => {
            runId = testRun.id;
        });

        // * Assert backend: sequential_id is a bare padded number when no prefix is configured
        cy.then(() => cy.apiGetPlaybookRun(runId)).then(({body: run}) => {
            expect(run.sequential_id).to.equal(formatSequentialID('', 1));
        });

        // # Visit the runs list
        cy.visit('/playbooks/runs');
        cy.findByTestId('playbookRunList').should('be.visible');

        // # Find the run row — assert exactly one row with this name before checking badge
        cy.findByTestId('playbookRunList').within(() => {
            cy.findAllByText(runName).should('have.length', 1);
        });

        // * Assert sequential ID badge is shown with the bare number
        cy.playbooksGetRunListRow(runName).within(() => {
            cy.findByTestId('run-sequential-id').should('exist');
            cy.findByTestId('run-sequential-id').should('contain', formatSequentialID('', 1));
        });
    });

    it('changing the prefix after runs exist keeps existing run IDs frozen', () => {
        // # Use a random prefix to avoid unique-constraint collisions on Cypress retries
        const prefix = 'TST' + getRandomId().slice(0, 4).toUpperCase();
        const newPrefix = 'NEW' + getRandomId().slice(0, 4).toUpperCase();
        let testPlaybook;
        let runId;
        const runName = 'TST Run ' + getRandomId();

        // # Create a playbook and set the prefix
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Mutable Prefix Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            testPlaybook = playbook;
            createdPlaybookIds.push(playbook.id);
        });

        cy.then(() => {
            return cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: prefix});
        });

        // # Start a run
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: runName,
            ownerUserId: testUser.id,
        })).then((run) => {
            runId = run.id;
            cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                expect(runData.sequential_id).to.equal(formatSequentialID(prefix, 1));
            });
        });

        // * Changing to a different prefix succeeds
        cy.then(() => {
            return cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: newPrefix});
        });

        // * Existing run keeps its original sequential_id (frozen at creation time)
        cy.then(() => cy.apiGetPlaybookRun(runId)).then(({body: runData}) => {
            expect(runData.sequential_id).to.equal(formatSequentialID(prefix, 1));
        });

        // * Counter continues — next run gets number firstRunNumber+1 with the new prefix.
        // Read the first run's number dynamically so Cypress retries don't fail when the
        // counter has already advanced from a prior attempt.
        cy.then(() => cy.apiGetPlaybookRun(runId)).then(({body: firstRunData}) => {
            const firstRunNumber = parseInt(firstRunData.sequential_id.split('-').pop(), 10);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'Second Run ' + getRandomId(),
                ownerUserId: testUser.id,
            }).then((run) => {
                cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                    const secondRunNumber = parseInt(runData.sequential_id.split('-').pop(), 10);
                    expect(secondRunNumber).to.equal(firstRunNumber + 1);
                });
            });
        });

        // * Playbook prefix is updated
        cy.then(() => cy.apiGetPlaybook(testPlaybook.id)).then((playbook) => {
            expect(playbook.run_number_prefix).to.equal(newPrefix);
        });
    });

    it('prefix can be changed before any runs exist and affects all subsequent runs', () => {
        const fooRunName = 'Run With FOO Prefix ' + getRandomId();
        let playbookId;
        let runId;

        // # Create a playbook
        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Prefix Change Before Runs Playbook ' + getRandomId(),
            userId: testUser.id,
        }).then((playbook) => {
            playbookId = playbook.id;
            createdPlaybookIds.push(playbook.id);
        });

        // # Set initial prefix, then change it before any runs are created
        cy.then(() => cy.apiPatchPlaybook(playbookId, {run_number_prefix: 'IH'}));

        // # Change prefix — allowed because no runs exist yet
        cy.then(() => cy.apiPatchPlaybook(playbookId, {run_number_prefix: 'FOO'}));

        // * Assert backend: playbook prefix is now 'FOO' before any runs are created
        cy.then(() => cy.apiGetPlaybook(playbookId)).then((pb) => {
            expect(pb.run_number_prefix).to.equal('FOO');
        });

        // # Start a run — it should use the final prefix FOO
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId,
            playbookRunName: fooRunName,
            ownerUserId: testUser.id,
        })).then(({id}) => {
            runId = id;
        });

        // * Run gets the FOO prefix (the prefix active at creation time)
        cy.then(() => cy.apiGetPlaybookRun(runId)).then(({body: run}) => {
            expect(run.sequential_id).to.match(/^FOO-\d+$/);
        });

        // * Prefix change after runs exist is also allowed (mutable)
        cy.then(() => cy.apiPatchPlaybook(playbookId, {run_number_prefix: 'BAR'}));

        // * Run list shows the original sequential ID (frozen at creation)
        cy.visit('/playbooks/runs');
        cy.findByTestId('playbookRunList').should('be.visible');

        cy.playbooksGetRunListRow(fooRunName).within(() => {
            cy.findByTestId('run-sequential-id').should('contain', 'FOO-');
        });
    });

    it('{SEQ} token in run name template resolves using the current prefix', () => {
        let seqPlaybook;
        let run1Id;

        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Template SEQ Token ' + getRandomId(),
            userId: testUser.id,
        }).then((playbook) => {
            seqPlaybook = playbook;
            createdPlaybookIds.push(playbook.id);
        });

        // # Set prefix and name template
        cy.then(() => cy.apiPatchPlaybook(seqPlaybook.id, {
            run_number_prefix: 'OLD',
            channel_name_template: '{SEQ}',
        }));

        // # Start run 1 — {SEQ} resolves with the 'OLD' prefix
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: seqPlaybook.id,
            playbookRunName: 'First Run',
            ownerUserId: testUser.id,
        })).then(({id}) => {
            run1Id = id;
        });

        cy.then(() => cy.assertRunNameResolved(run1Id, 'OLD-'));

        // * Changing the prefix after runs exist succeeds (mutable)
        cy.then(() => cy.apiPatchPlaybook(seqPlaybook.id, {run_number_prefix: 'NEW'}));

        // * Prefix is now 'NEW'
        cy.then(() => cy.apiGetPlaybook(seqPlaybook.id)).then((pb) => {
            expect(pb.run_number_prefix).to.equal('NEW');
        });

        // # Start run 2 — uses the new 'NEW' prefix
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: seqPlaybook.id,
            playbookRunName: 'Second Run',
            ownerUserId: testUser.id,
        })).then(({id: run2Id}) => {
            cy.assertRunNameResolved(run2Id, 'NEW-');
        });
    });

    it('shows sequential ID in run details info panel', () => {
        const hdrPrefix = 'H' + getRandomId().slice(0, 2).toUpperCase();
        let testPlaybook;

        // # Create a playbook with a unique run_number_prefix (different from test 1 to avoid uniqueness conflict)
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Header ID Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            testPlaybook = playbook;
            createdPlaybookIds.push(playbook.id);
        });

        cy.then(() => cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: hdrPrefix}));

        // # Start a run via API
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Header ID Run ' + getRandomId(),
            ownerUserId: testUser.id,
        })).then((playbookRun) => {
            // * Verify sequential_id is stored in backend (not just rendered in UI)
            cy.apiGetPlaybookRun(playbookRun.id).then(({body: runData}) => {
                expect(runData.sequential_id).to.equal(formatSequentialID(hdrPrefix, 1));
            });

            // # Visit the run details page directly
            cy.playbooksVisitRun(playbookRun.id);

            // * Assert sequential ID is shown in the RHS info overview
            cy.findByTestId('run-sequential-id').should('exist');
            cy.findByTestId('run-sequential-id').should('contain', formatSequentialID(hdrPrefix, 1));
        });
    });

    it('allows the same prefix on different teams', () => {
        const sharedPrefix = 'XTM' + getRandomId().slice(0, 3).toUpperCase();
        let playbookOnTestTeam;

        // # Create a second team (requires admin privileges)
        cy.apiAdminLogin();
        cy.apiCreateTeam('cross-team-' + getRandomId(), 'Cross Team ' + getRandomId()).then(({team: secondTeam}) => {
            createdTeamIds.push(secondTeam.id);
            cy.apiAddUserToTeam(secondTeam.id, testUser.id);
            cy.apiLogin(testUser);

            // # Create playbook A on testTeam with the prefix
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Cross Team A ' + getRandomId(),
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                playbookOnTestTeam = playbook;
                createdPlaybookIds.push(playbook.id);
            });

            cy.then(() => {
                return cy.apiPatchPlaybook(playbookOnTestTeam.id, {run_number_prefix: sharedPrefix});
            });

            // # Create playbook B on secondTeam and attempt the same prefix
            cy.then(() => {
                return cy.apiCreatePlaybook({
                    teamId: secondTeam.id,
                    title: 'Cross Team B ' + getRandomId(),
                    memberIDs: [testUser.id],
                    createPublicPlaybookRun: true,
                }).then((playbookOnSecondTeam) => {
                    // Push to createdPlaybookIds so afterEach cleans it up even if the
                    // assertion below fails (prevents a prefix leak on test retry).
                    createdPlaybookIds.push(playbookOnSecondTeam.id);

                    // * Same prefix on a different team should succeed (200)
                    cy.apiPatchPlaybook(playbookOnSecondTeam.id, {run_number_prefix: sharedPrefix}).then((updated) => {
                        expect(updated.run_number_prefix).to.equal(sharedPrefix);
                    });
                });
            });
        });
    });

    it('rejects a duplicate run_number_prefix on the same team', () => {
        const sharedPrefix = 'DUP' + getRandomId().slice(0, 3).toUpperCase();
        let playbookA;

        // # Create playbook A with a prefix
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Prefix Dup A ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            playbookA = playbook;
            createdPlaybookIds.push(playbook.id);
        });

        cy.then(() => {
            return cy.apiPatchPlaybook(playbookA.id, {run_number_prefix: sharedPrefix});
        });

        // # Create playbook B and attempt the same prefix
        cy.then(() => {
            return cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Prefix Dup B ' + getRandomId(),
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // * Attempt to set the same prefix — should fail with 409 or 400
                cy.apiPatchPlaybook(playbook.id, {run_number_prefix: sharedPrefix}, 409);
            });
        });
    });

    it('shows an error toast when a duplicate prefix is entered in the editor', () => {
        const sharedPrefix = 'TOS' + getRandomId().slice(0, 3).toUpperCase();
        let playbookA;
        let playbookB;

        // # Create playbook A and set the prefix via API
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Toast Test A ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            playbookA = playbook;
            createdPlaybookIds.push(playbook.id);
        });

        cy.then(() => cy.apiPatchPlaybook(playbookA.id, {run_number_prefix: sharedPrefix}));

        // # Create playbook B with no prefix
        cy.then(() => {
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Toast Test B ' + getRandomId(),
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                playbookB = playbook;
                createdPlaybookIds.push(playbook.id);
            });
        });

        // # Visit playbook B's editor and intercept the debounced PATCH before typing
        cy.then(() => cy.playbooksVisitEditor(playbookB.id, 'outline'));
        cy.playbooksInterceptPatchPlaybook();

        // # Type the duplicate prefix — triggers the debounced save after 500 ms
        cy.findByTestId('channel-access-run-number-prefix').type(sharedPrefix);

        // # Wait for the PATCH to complete (server returns 409)
        cy.wait('@PatchPlaybook').its('response.statusCode').should('equal', 409);

        // * Error toast is shown explaining the conflict
        cy.findByText('Another active playbook in this team already uses that prefix.').should('be.visible');

        // * Input reverts to empty (playbook B had no prior prefix)
        cy.findByTestId('channel-access-run-number-prefix').should('have.value', '');
    });

    it('shows sequential ID next to playbook name in channel RHS', () => {
        const rhsPrefix = 'R' + getRandomId().slice(0, 2).toUpperCase();

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'RHS ID Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiPatchPlaybook(playbook.id, {run_number_prefix: rhsPrefix}).then(() => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'RHS Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((run) => {
                    // # Navigate to the run channel
                    cy.playbooksVisitRunChannel(testTeam.name, run);

                    // * Assert the sequential ID chip is shown in the channel RHS
                    cy.findByTestId('run-sequential-id').should('exist');
                    cy.findByTestId('run-sequential-id').should('contain', formatSequentialID(rhsPrefix, 1));
                });
            });
        });
    });
});
