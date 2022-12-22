// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('channels > post type components', () => {
    let testTeam;
    let testUser;
    let testChannel;
    let testPlaybookRun;

    beforeEach(() => {
        cy.apiAdminLogin();

        cy.apiInitSetup({loginAfter: true}).then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Test Run',
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    testPlaybookRun = playbookRun;
                });
            });

            cy.apiCreateChannel(
                testTeam.id,
                'other-channel',
                'Other Channel',
                'O'
            ).then(({channel}) => {
                testChannel = channel;
            });
        });
    });

    describe('update post (custom_run_update)', () => {
        it('displays in run channel', () => {
            // # Go to the playbook run channel
            cy.visit(`/${testTeam.name}/channels/test-run`);

            // # Intercept all calls to telemetry
            cy.intercept('/plugins/playbooks/api/v0/telemetry').as('telemetry');

            // # Post a status update
            cy.apiUpdateStatus({
                playbookRunId: testPlaybookRun.id,
                message: 'status update',
                reminder: 60,
            });

            // Grab the post id
            cy.getLastPostId().then((postId) => {
                // * assert telemetry pageview
                // * Some params will be empty since some data is not available in the permalink context
                cy.wait('@telemetry').then((interception) => {
                    expect(interception.request.body.name).to.eq('run_status_update');
                    expect(interception.request.body.type).to.eq('page');
                    expect(interception.request.body.properties.post_id).to.eq(postId);
                    expect(interception.request.body.properties.playbook_run_id).to.eq(testPlaybookRun.id);
                    expect(interception.request.body.properties.channel_type).to.eq('O');
                });
            });
        });

        it('displays when permalinked in a different channel', () => {
            // # Go to the playbook run channel
            cy.visit(`/${testTeam.name}/channels/test-run`);

            // # Post a status update
            cy.apiUpdateStatus({
                playbookRunId: testPlaybookRun.id,
                message: 'status update',
                reminder: 60,
            });

            // Grab the post id
            cy.getLastPostId().then((postId) => {
                // # Intercept all calls to telemetry
                cy.intercept('/plugins/playbooks/api/v0/telemetry').as('telemetry');

                // # Go to the other channel
                cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

                // # Post a permalink to the status update
                cy.uiPostMessageQuickly(`${Cypress.config('baseUrl')}/${testTeam.name}/pl/${postId}`);

                // * assert telemetry pageview
                // * Some params will be empty since some data is not available in the permalink context
                cy.wait('@telemetry').then((interception) => {
                    expect(interception.request.body.name).to.eq('run_status_update');
                    expect(interception.request.body.type).to.eq('page');
                    expect(interception.request.body.properties.post_id).to.eq(postId);
                    expect(interception.request.body.properties.playbook_run_id).to.eq(testPlaybookRun.id);
                    expect(interception.request.body.properties.channel_type).to.eq('O');
                });

                cy.getLastPost().then((element) => {
                    // # Verify the expected message text
                    cy.get(element).contains(`${testUser.username} posted an update for ${testPlaybookRun.name}`);
                    cy.get(element).contains('status update');
                });
            });
        });

        it('displays when permalinked in a different channel, even if not a member of the original channel', () => {
            // # Go to the playbook run channel
            cy.visit(`/${testTeam.name}/channels/test-run`);

            // # Post a status update
            cy.apiUpdateStatus({
                playbookRunId: testPlaybookRun.id,
                message: 'status update',
                reminder: 60,
            });

            cy.getLastPostId().then((postId) => {
                // # intercepts telemetry
                cy.interceptTelemetry();

                // # Leave the playbook run channel
                cy.uiLeaveChannel();

                // # Go to the other channel
                cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

                // # Post a permalink to the status update
                cy.uiPostMessageQuickly(`${Cypress.config('baseUrl')}/${testTeam.name}/pl/${postId}`);

                // * Assert telemetry data
                cy.wait('@telemetry').wait('@telemetry');
                cy.expectTelemetryToBe([
                    {name: 'channels_rhs_rundetails', type: 'page'},
                    {
                        name: 'run_status_update',
                        type: 'page',
                        properties: {
                            post_id: postId,
                            playbook_run_id: testPlaybookRun.id,
                        },
                    },
                ]);

                cy.getLastPost().then((element) => {
                    // # Verify the expected message text
                    cy.get(element).contains(`${testUser.username} posted an update for ${testPlaybookRun.name}`);
                    cy.get(element).contains('status update');
                });
            });
        });
    });
});
