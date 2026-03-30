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

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the runs list without covering elements
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        createdPlaybookIds = [];
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

        // # Set the run_number_prefix on the playbook (no trailing dash — FormatSequentialID adds it)
        cy.then(() => cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: 'INC'}));

        // # Start first run via API
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: firstRunName,
            ownerUserId: testUser.id,
        })).then((firstRun) => {
            // Verify sequential_id is stored in backend (not just rendered in UI)
            cy.apiGetPlaybookRun(firstRun.id).then(({body: runData}) => {
                expect(runData.sequential_id).to.equal(formatSequentialID('INC', 1));
            });
        });

        // # Start second run via API (after first completes)
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: secondRunName,
            ownerUserId: testUser.id,
        })).then((secondRun) => {
            // Verify sequential_id is stored in backend (not just rendered in UI)
            cy.apiGetPlaybookRun(secondRun.id).then(({body: runData}) => {
                expect(runData.sequential_id).to.equal(formatSequentialID('INC', 2));
            });
        });

        // # Visit the runs list
        cy.visit('/playbooks/runs');
        cy.findByTestId('playbookRunList').should('be.visible');

        // * Assert first run shows INC-00001 alongside its name
        cy.then(() => cy.playbooksAssertSequentialIdInList(firstRunName, formatSequentialID('INC', 1)));

        // * Assert second run shows INC-00002 alongside its name
        cy.then(() => cy.playbooksAssertSequentialIdInList(secondRunName, formatSequentialID('INC', 2)));
    });

    it('does not show sequential ID badge when no prefix is configured', () => {
        // # Create a playbook WITHOUT a run_number_prefix
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'No Prefix Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            const runName = 'No ID Run ' + getRandomId();

            // # Start a run via API
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: runName,
                ownerUserId: testUser.id,
            });

            // # Visit the runs list
            cy.visit('/playbooks/runs');
            cy.findByTestId('playbookRunList').should('be.visible');

            // # Find the run row — assert exactly one row with this name before checking badge
            cy.get('#playbookRunList').within(() => {
                cy.findAllByText(runName).should('have.length', 1);
            });

            // * Assert no sequential ID badge is shown (no element matching INC- or seq-id pattern)
            cy.get('#playbookRunList').within(() => {
                cy.findByTestId('run-sequential-id').should('not.exist');
            });
        });
    });

    it('changing the prefix after runs exist keeps existing run IDs frozen', () => {
        // Use a random prefix to avoid unique-constraint collisions on Cypress retries
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

        cy.then(() => cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: prefix}));

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
        cy.then(() => cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: newPrefix}));

        // * Existing run keeps its original sequential_id (frozen at creation time)
        cy.then(() => cy.apiGetPlaybookRun(runId)).then(({body: runData}) => {
            expect(runData.sequential_id).to.equal(formatSequentialID(prefix, 1));
        });

        // * Counter continues — next run gets number 2 with the new prefix
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Second Run ' + getRandomId(),
            ownerUserId: testUser.id,
        })).then((run) => {
            cy.apiGetPlaybookRun(run.id).then(({body: runData}) => {
                expect(runData.sequential_id).to.equal(formatSequentialID(newPrefix, 2));
            });
        });

        // * Playbook prefix is updated
        cy.then(() => cy.apiGetPlaybook(testPlaybook.id)).then((playbook) => {
            expect(playbook.run_number_prefix).to.equal(newPrefix);
        });
    });

    it('prefix can be changed before any runs exist and affects all subsequent runs', () => {
        // Create a playbook with prefix IH
        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Prefix Change Before Runs Playbook ' + getRandomId(),
            userId: testUser.id,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Set initial prefix, then change it before any runs are created
            cy.apiPatchPlaybook(playbook.id, {run_number_prefix: 'IH'}).then(() => {
                // # Change prefix — allowed because no runs exist yet
                cy.apiPatchPlaybook(playbook.id, {run_number_prefix: 'FOO'}).then(() => {
                    // # Start a run — it should use the final prefix FOO
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: 'Run With FOO Prefix',
                        ownerUserId: testUser.id,
                    }).then(({id: runId}) => {
                        // * Run gets the FOO prefix (the prefix active at creation time)
                        cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                            expect(run.sequential_id).to.match(/^FOO-\d+$/);
                        });

                        // * Prefix change after runs exist is also allowed (mutable)
                        cy.apiPatchPlaybook(playbook.id, {run_number_prefix: 'BAR'});

                        // * Run list shows the original sequential ID (frozen at creation)
                        cy.visit('/playbooks/runs');
                        cy.findByTestId('playbookRunList').should('be.visible');

                        cy.playbooksGetRunListRow('Run With FOO Prefix').within(() => {
                            cy.findByTestId('run-sequential-id').should('contain', 'FOO-');
                        });
                    });
                });
            });
        });
    });

    it('{SEQ} token in run name template resolves using the current prefix', () => {
        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Template SEQ Token ' + getRandomId(),
            userId: testUser.id,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Set prefix and name template
            cy.apiPatchPlaybook(playbook.id, {
                run_number_prefix: 'OLD',
                channel_name_template: '{SEQ}',
            }).then(() => {
                // # Start run 1 — {SEQ} resolves with the 'OLD' prefix
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'First Run',
                    ownerUserId: testUser.id,
                }).then(({id: run1Id}) => {
                    cy.assertRunNameResolved(run1Id, 'OLD-');

                    // * Changing the prefix after runs exist succeeds (mutable)
                    cy.apiPatchPlaybook(playbook.id, {run_number_prefix: 'NEW'});

                    // * Prefix is now 'NEW'
                    cy.apiGetPlaybook(playbook.id).then((pb) => {
                        expect(pb.run_number_prefix).to.equal('NEW');
                    });

                    // # Start run 2 — uses the new 'NEW' prefix
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: 'Second Run',
                        ownerUserId: testUser.id,
                    }).then(({id: run2Id}) => {
                        cy.assertRunNameResolved(run2Id, 'NEW-');
                    });
                });
            });
        });
    });

    it('shows sequential ID in run details page header', () => {
        // # Create a playbook with a unique run_number_prefix (different from test 1 to avoid uniqueness conflict)
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Header ID Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiPatchPlaybook(playbook.id, {run_number_prefix: 'HDR'}).then(() => {
                // # Start a run via API
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Header ID Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    // Verify sequential_id is stored in backend (not just rendered in UI)
                    cy.apiGetPlaybookRun(playbookRun.id).then(({body: runData}) => {
                        expect(runData.sequential_id).to.equal(formatSequentialID('HDR', 1));
                    });

                    // # Visit the run details page directly
                    cy.playbooksVisitRun(playbookRun.id);

                    // * Assert sequential ID is shown in the run header
                    cy.findByTestId('run-header-section').within(() => {
                        cy.findByTestId('run-sequential-id').should('exist');
                        cy.findByTestId('run-sequential-id').should('contain', 'HDR-');
                    });
                });
            });
        });
    });
});
