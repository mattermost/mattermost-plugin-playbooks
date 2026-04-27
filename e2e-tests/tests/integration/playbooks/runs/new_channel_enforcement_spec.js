// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

const CHANNEL_NAME_PREFIX = 'enforce-test-';

const createNewChannelOnlyPlaybook = (title, memberIDs, teamId) => {
    return cy.apiCreatePlaybook({
        teamId,
        title,
        memberIDs,
        makePublic: true,
        createPublicPlaybookRun: true,
    }).then((playbook) => {
        return cy.apiPatchPlaybook(playbook.id, {new_channel_only: true}).then(() => playbook);
    });
};

describe('runs > new channel enforcement', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let createdPlaybookIds = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        createdPlaybookIds = [];
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport
        cy.viewport('macbook-13');
    });

    it('UI run start succeeds when NewChannelOnly=true (modal always creates new channel)', () => {
        // # Create a playbook with new_channel_only=true
        createNewChannelOnlyPlaybook('NewChannelOnly Playbook ' + getRandomId(), [testUser.id], testTeam.id).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Start a run via UI from the playbook outline page (always creates new channel)
            const runName = 'NewChannelOnly Run ' + getRandomId();
            cy.playbooksStartRunViaModal(playbook.id, runName);

            // * Verify the run was created and we landed on the run details page
            cy.findByTestId('run-header-section').should('contain', runName);

            // * Verify a new channel was created for this run
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.channel_id).to.not.be.empty;
                });
            });

            // * Assert backend: playbook still has new_channel_only=true
            cy.apiGetPlaybook(playbook.id).then((pb) => {
                expect(pb.new_channel_only).to.equal(true);
            });
        });
    });

    // API contract test: verifies the backend rejects runs that supply a channel_id
    // when new_channel_only=true. The UI RunPlaybookModal never passes channel_id in
    // this mode, so this scenario is only testable at the API level.
    it('API contract: backend rejects run with existing channel when NewChannelOnly=true', () => {
        // # Create a channel as the logged-in user to ensure proper permissions
        cy.apiCreateChannel(testTeam.id, CHANNEL_NAME_PREFIX + getRandomId(), 'Enforce Test Channel').then(({channel}) => {
            // # Create a playbook with new_channel_only=true
            createNewChannelOnlyPlaybook('NewChannelOnly Reject Playbook ' + getRandomId(), [testUser.id], testTeam.id).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Attempt to create a run with channel_id set (should be rejected)
                // cy.apiRunPlaybook internally asserts the 400 status when expectedStatusCode is set
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Existing Channel Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                    channelId: channel.id,
                }, {expectedStatusCode: 400}).then(() => {
                    // * Verify no run was created with the existing channel
                    cy.apiGetAllPlaybookRuns(testTeam.id).then(({body: {items}}) => {
                        const matchingRun = items.find((r) => r.channel_id === channel.id);
                        expect(matchingRun, 'no run should be created with existing channel').to.not.exist;
                    });
                });
            });
        });
    });

    // API contract test: verifies the backend allows existing-channel runs when the
    // flag is false. The UI modal surfaces this as the "link existing channel" mode.
    it('API contract: flag=false allows run creation with existing channel', () => {
        // # Create a channel as the logged-in user to ensure proper permissions
        cy.apiCreateChannel(testTeam.id, 'allow-test-' + getRandomId(), 'Allow Test Channel').then(({channel}) => {
            // # Create a playbook with new_channel_only=false (default)
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'AllowExistingChannel Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                channelMode: 'link_existing_channel',
                channelId: channel.id,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Create a run with channel_id set - should succeed when new_channel_only=false
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Allow Existing Channel Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                    channelId: channel.id,
                }).then((run) => {
                    // * Assert run was created with the existing channel
                    expect(run.id).to.be.a('string').and.not.be.empty;
                    expect(run.channel_id).to.equal(channel.id);
                });
            });
        });
    });

    it('UI run start also works without specifying a channel (new channel mode) when flag=false', () => {
        // # Create a playbook with new_channel_only=false (default)
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'AllowBothModes Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            makePublic: true,
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Start a run via UI — should succeed and land on run details page
            const runName = 'New Channel Mode Run ' + getRandomId();
            cy.playbooksStartRunViaModal(playbook.id, runName);

            // * Verify the run was created successfully
            cy.findByTestId('run-header-section').should('contain', runName);

            // * Verify via API that the run was created with a new channel
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.channel_id, 'run should have a new channel_id').to.be.a('string').and.not.be.empty;

                    // * Assert backend: playbook has new_channel_only=false
                    cy.apiGetPlaybook(playbook.id).then((pb) => {
                        expect(pb.new_channel_only).to.equal(false);
                    });

                    // * Assert the created channel is a real channel (create_at > 0)
                    cy.apiGetChannel(run.channel_id).then(({channel}) => {
                        expect(channel.create_at).to.be.greaterThan(0);
                    });
                });
            });
        });
    });

    describe('slash command dialog enforcement', () => {
        let slashPlaybook;

        beforeEach(() => {
            cy.apiLogin(testUser);
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'SlashCmd NewChannelOnly ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                cy.apiPatchPlaybook(playbook.id, {new_channel_only: true}).then(() => {
                    slashPlaybook = playbook;
                });
            });
        });

        // API contract: the slash command path still enforces new_channel_only.
        // The worktree uses the old server-side interactive dialog for /playbook run,
        // so these tests verify enforcement at the API level rather than the dialog UI.
        it('API: new_channel_only is set on the slash command playbook', () => {
            cy.apiGetPlaybook(slashPlaybook.id).then((pb) => {
                expect(pb.new_channel_only).to.equal(true);
            });
        });

        it('API rejects run with existing channel_id when new_channel_only=true (slash command playbook)', () => {
            // * Verify via API that new_channel_only is true on the playbook
            cy.apiGetPlaybook(slashPlaybook.id).then((pb) => {
                expect(pb.new_channel_only).to.equal(true);
            });

            // # Create a second channel to use as an existing channel
            cy.apiCreateChannel(testTeam.id, `existing-ch-slash-${getRandomId()}`, 'Existing Ch Slash').then(({channel}) => {
                // * Assert the API rejects run creation with existing channel_id
                cy.request({
                    method: 'POST',
                    url: '/plugins/playbooks/api/v0/runs',
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    body: {
                        name: 'Slash API Reject Test ' + getRandomId(),
                        owner_user_id: testUser.id,
                        team_id: testTeam.id,
                        playbook_id: slashPlaybook.id,
                        channel_id: channel.id,
                    },
                    failOnStatusCode: false,
                }).then((resp) => {
                    expect(resp.status).to.equal(400);
                });
            });
        });

        it('API: run creation without channel_id succeeds for new_channel_only playbook', () => {
            // # Create a run via API without channel_id (same as slash command dialog submits)
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: slashPlaybook.id,
                playbookRunName: 'SlashCmd NCO Run ' + getRandomId(),
                ownerUserId: testUser.id,
            }).then((run) => {
                // * Assert the run was created with a new channel
                expect(run.id).to.be.a('string').and.not.be.empty;
                expect(run.channel_id, 'run should have a new channel').to.be.a('string').and.not.be.empty;
            });
        });
    });
});
