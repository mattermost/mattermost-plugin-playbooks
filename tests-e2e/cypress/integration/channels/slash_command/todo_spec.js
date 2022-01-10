// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('channels > slash command > todo', () => {
    let team1;
    let team2;
    let testUser;
    let runName1;
    let run1;
    let runName2;
    let run2;
    let runName3;
    let run3;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            team1 = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: team1.id,
                title: 'Playbook One',
                memberIDs: [],
                createPublicPlaybookRun: true,
                checklists: [
                    {
                        title: 'Playbook One - Stage 1',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                    {
                        title: 'Playbook One - Stage 2',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                ],
            }).then(({id}) => {
                // # Create two runs in team 1.
                const now = Date.now();
                runName1 = 'Playbook Run (' + now + ')';
                cy.apiRunPlaybook({
                    teamId: team1.id,
                    playbookId: id,
                    playbookRunName: runName1,
                    ownerUserId: testUser.id,
                }).then((run) => {
                    run1 = run;
                });

                const now2 = Date.now() + 100;
                runName2 = 'Playbook Run (' + now2 + ')';
                cy.apiRunPlaybook({
                    teamId: team1.id,
                    playbookId: id,
                    playbookRunName: runName2,
                    ownerUserId: testUser.id,
                }).then((run) => {
                    run2 = run;
                });
            });

            // # Create a second team to test cross-team notifications
            cy.apiCreateTeam('team2', 'Team 2').then(({team: secondTeam}) => {
                team2 = secondTeam;

                cy.apiAdminLogin();
                cy.apiAddUserToTeam(team2.id, testUser.id);
                cy.apiLogin(testUser);

                // # Create a public playbook
                cy.apiCreatePlaybook({
                    teamId: team2.id,
                    title: 'Playbook Two',
                    memberIDs: [],
                    createPublicPlaybookRun: true,
                    checklists: [
                        {
                            title: 'Playbook Two - Stage 1',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                        {
                            title: 'Playbook Two - Stage 2',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                    ],
                }).then(({id}) => {
                    // # Create one run in team 2.
                    const now = Date.now() + 200;
                    runName3 = 'Playbook Run (' + now + ')';
                    cy.apiRunPlaybook({
                        teamId: team2.id,
                        playbookId: id,
                        playbookRunName: runName3,
                        ownerUserId: testUser.id,
                    }).then((run) => {
                        run3 = run;
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('/playbook todo should show', () => {
        it('three runs', () => {
            // # Navigate to a non-playbook run channel.
            cy.visit(`/${team2.name}/channels/town-square`);

            // # Run a slash command to show the to-do list.
            cy.executeSlashCommand('/playbook todo');

            // # Switch to playbooks DM channel
            cy.visit(`/${team2.name}/messages/@playbooks`);

            cy.getLastPost().within((post) => {
                // * Should show titles
                cy.wrap(post).contains('You have 0 runs overdue.');
                cy.wrap(post).contains('You have 0 outstanding tasks.');
                cy.wrap(post).contains('You have 3 runs currently in progress:');

                // * Should show three active runs
                cy.get('li').then((liItems) => {
                    expect(liItems[0]).to.contain.text(runName1);
                    expect(liItems[1]).to.contain.text(runName2);
                    expect(liItems[2]).to.contain.text(runName3);
                });
            });
        });

        it('four assigned tasks', () => {
            // # assign self four tasks
            cy.apiChangeChecklistItemAssignee(run1.id, 0, 0, testUser.id);
            cy.apiChangeChecklistItemAssignee(run1.id, 1, 1, testUser.id);
            cy.apiChangeChecklistItemAssignee(run2.id, 0, 1, testUser.id);
            cy.apiChangeChecklistItemAssignee(run3.id, 1, 0, testUser.id);

            // # Switch to playbooks DM channel
            cy.visit(`/${team2.name}/messages/@playbooks`);

            // # Run a slash command to show the to-do list.
            cy.executeSlashCommand('/playbook todo');

            cy.getLastPost().within((post) => {
                // * Should show titles
                cy.wrap(post).contains('You have 0 runs overdue.');
                cy.wrap(post).contains('You have 4 total outstanding tasks:');

                // * Should show 3 runs
                cy.get('a').then((links) => {
                    expect(links[1]).to.contain.text(runName1);
                    expect(links[2]).to.contain.text(runName2);
                    expect(links[3]).to.contain.text(runName3);
                });

                cy.get('li').then((items) => {
                    // * first run
                    expect(items[0]).to.contain.text('Playbook One - Stage 1: Step 1');
                    expect(items[1]).to.contain.text('Playbook One - Stage 2: Step 2');

                    // * second run
                    expect(items[2]).to.contain.text('Playbook One - Stage 1: Step 2');

                    // * third run
                    expect(items[3]).to.contain.text('Playbook Two - Stage 2: Step 1');
                });
            });

            // # check two of the items via API
            cy.apiSetChecklistItemState(run1.id, 0, 0, 'closed');
            cy.apiSetChecklistItemState(run3.id, 1, 0, 'closed');

            // # Show the to-do list.
            cy.executeSlashCommand('/playbook todo');

            // * Should show 2 tasks
            cy.getLastPost().within((post) => {
                // * Should show titles
                cy.wrap(post).contains('You have 0 runs overdue.');
                cy.wrap(post).contains('You have 2 total outstanding tasks:');

                // * Should show 2 runs
                cy.get('a').then((links) => {
                    expect(links[1]).to.contain.text(runName1);
                    expect(links[2]).to.contain.text(runName2);
                });

                cy.get('li').then((items) => {
                    // * first run
                    expect(items[0]).to.contain.text('Playbook One - Stage 2: Step 2');

                    // * second run
                    expect(items[1]).to.contain.text('Playbook One - Stage 1: Step 2');
                });
            });
        });

        it('two overdue status updates', () => {
            // # set two updates with short timers
            cy.apiUpdateStatus({
                playbookRunId: run1.id,
                message: 'no message 1',
                reminder: 1,
            });
            cy.apiUpdateStatus({
                playbookRunId: run3.id,
                message: 'no message 3',
                reminder: 1,
            });

            cy.wait(1100);

            // # Switch to playbooks DM channel
            cy.visit(`/${team2.name}/messages/@playbooks`);

            // # Run a slash command to show the to-do list.
            cy.executeSlashCommand('/playbook todo');

            // # Should show two runs overdue -- ignoring the rest
            cy.getLastPost().within(() => {
                cy.get('li').then((liItems) => {
                    expect(liItems[0]).to.contain.text(runName1);
                    expect(liItems[1]).to.contain.text(runName3);
                });
            });
        });
    });
});
