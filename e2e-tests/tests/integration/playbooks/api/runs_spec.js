// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('api > runs', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('creating a run', () => {
        describe('in an existing, public channel', () => {
            it('with no team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel

                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                    }, {expectedStatusCode: 201}).then((body) => {
                        expect(body).to.have.property('owner_user_id', testUser.id);
                        expect(body).to.have.property('reporter_user_id', testUser.id);
                        expect(body).to.have.property('team_id', testTeam.id);
                        expect(body).to.have.property('channel_id', channel.id);
                        expect(body).to.have.property('playbook_id', testPlaybook.id);
                    });
                });
            });

            it('with correct team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel
                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                        teamId: testTeam.id,
                    }, {expectedStatusCode: 201}).then((body) => {
                        expect(body).to.have.property('owner_user_id', testUser.id);
                        expect(body).to.have.property('reporter_user_id', testUser.id);
                        expect(body).to.have.property('team_id', testTeam.id);
                        expect(body).to.have.property('channel_id', channel.id);
                        expect(body).to.have.property('playbook_id', testPlaybook.id);
                    });
                });
            });

            it('with wrong team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel
                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                        teamId: 'other_team_id',
                    }, {expectedStatusCode: 400}).then((body) => {
                        expect(body).to.have.property('error', 'unable to create playbook run');
                    });
                });
            });
        });

        describe('in an existing, private channel', () => {
            it('with no team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel', 'P').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel
                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                    }, {expectedStatusCode: 201}).then((body) => {
                        expect(body).to.have.property('owner_user_id', testUser.id);
                        expect(body).to.have.property('reporter_user_id', testUser.id);
                        expect(body).to.have.property('team_id', testTeam.id);
                        expect(body).to.have.property('channel_id', channel.id);
                        expect(body).to.have.property('playbook_id', testPlaybook.id);
                    });
                });
            });

            it('with correct team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel', 'P').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel
                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                        teamId: testTeam.id,
                    }, {expectedStatusCode: 201}).then((body) => {
                        expect(body).to.have.property('owner_user_id', testUser.id);
                        expect(body).to.have.property('reporter_user_id', testUser.id);
                        expect(body).to.have.property('team_id', testTeam.id);
                        expect(body).to.have.property('channel_id', channel.id);
                        expect(body).to.have.property('playbook_id', testPlaybook.id);
                    });
                });
            });

            it('with wrong team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel', 'P').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel
                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                        teamId: 'other_team_id',
                    }, {expectedStatusCode: 400}).then((body) => {
                        expect(body).to.have.property('error', 'unable to create playbook run');
                    });
                });
            });
        });

        it('in an existing, private channel, of which the user is not a member', () => {
            // # Create a test channel without a playbook run
            cy.apiCreateChannel(testTeam.id, 'channel', 'Channel', 'P').then(({channel}) => {
                // # Leave the channel
                cy.apiRemoveUserFromChannel(channel.id, testUser.id);

                // # Run the testPlaybook in the previously created channel
                cy.apiRunPlaybook({
                    ownerUserId: testUser.id,
                    channelId: channel.id,
                    playbookId: testPlaybook.id,
                    teamId: testTeam.id,
                }, {expectedStatusCode: 403}).then((body) => {
                    expect(body).to.have.property('error', 'unable to create playbook run');
                });
            });
        });

        it('in a channel with an existing playbook run', () => {
            // # Run the playbook, creating a channel.
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'Playbook',
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # Run the testPlaybook in the previously created channel
                cy.apiRunPlaybook({
                    owner_user_id: testUser.id,
                    channel_id: playbookRun.channel_id,
                    playbook_id: testPlaybook.id,
                }, {expectedStatusCode: 400}).then((body) => {
                    expect(body).to.have.property('error', 'unable to create playbook run');
                });
            });
        });
    });

    describe('channel permission checks', () => {
        let otherUser;
        let privateChannel;
        let privateChannelRun;

        before(() => {
            // # Login as admin to create users
            cy.apiAdminLogin();

            // # Create another user in the team
            cy.apiCreateUser().then(({user: createdUser}) => {
                otherUser = createdUser;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id);

                // # Login as testUser and create a private channel with a run
                cy.apiLogin(testUser);
                cy.apiCreateChannel(testTeam.id, 'private-perm-test', 'Private Perm Test', 'P').then(({channel}) => {
                    privateChannel = channel;

                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: privateChannel.id,
                        playbookId: testPlaybook.id,
                    }, {expectedStatusCode: 201}).then((run) => {
                        privateChannelRun = run;
                    });
                });
            });
        });

        describe('GET /runs/channel/{channel_id}', () => {
            it('should return 403 for user without channel access', () => {
                // # Login as otherUser who is not a member of the private channel
                cy.apiLogin(otherUser);

                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/plugins/playbooks/api/v0/runs/channel/${privateChannel.id}`,
                    method: 'GET',
                    failOnStatusCode: false,
                }).then((response) => {
                    expect(response.status).to.equal(403);
                });
            });

            it('should succeed for user with channel access', () => {
                // # Login as testUser who is a member of the private channel
                cy.apiLogin(testUser);

                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/plugins/playbooks/api/v0/runs/channel/${privateChannel.id}`,
                    method: 'GET',
                }).then((response) => {
                    expect(response.status).to.equal(200);
                });
            });
        });

        describe('GET /runs/channel/{channel_id}/runs', () => {
            it('should return 403 for user without channel access', () => {
                // # Login as otherUser who is not a member of the private channel
                cy.apiLogin(otherUser);

                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/plugins/playbooks/api/v0/runs/channel/${privateChannel.id}/runs`,
                    method: 'GET',
                    failOnStatusCode: false,
                }).then((response) => {
                    expect(response.status).to.equal(403);
                });
            });

            it('should succeed for user with channel access', () => {
                // # Login as testUser who is a member of the private channel
                cy.apiLogin(testUser);

                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/plugins/playbooks/api/v0/runs/channel/${privateChannel.id}/runs`,
                    method: 'GET',
                }).then((response) => {
                    expect(response.status).to.equal(200);
                });
            });
        });

        describe('GET /runs with channel_id filter', () => {
            it('should return 403 for user without channel access', () => {
                // # Login as otherUser who is not a member of the private channel
                cy.apiLogin(otherUser);

                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/plugins/playbooks/api/v0/runs?channel_id=${privateChannel.id}`,
                    method: 'GET',
                    failOnStatusCode: false,
                }).then((response) => {
                    expect(response.status).to.equal(403);
                });
            });

            it('should succeed for user with channel access', () => {
                // # Login as testUser who is a member of the private channel
                cy.apiLogin(testUser);

                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/plugins/playbooks/api/v0/runs?channel_id=${privateChannel.id}`,
                    method: 'GET',
                }).then((response) => {
                    expect(response.status).to.equal(200);
                });
            });
        });

        describe('unfollow permission check', () => {
            let privatePlaybook;
            let privatePlaybookRun;

            before(() => {
                // # Create a private playbook (only testUser is a member)
                cy.apiLogin(testUser);
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Private Playbook (Unfollow Test)',
                    memberIDs: [testUser.id],
                    makePublic: false,
                    createPublicPlaybookRun: false,
                }).then((playbook) => {
                    privatePlaybook = playbook;

                    // # Create a run from the private playbook
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: privatePlaybook.id,
                        playbookRunName: 'Unfollow Test Run',
                        ownerUserId: testUser.id,
                    }).then((run) => {
                        privatePlaybookRun = run;
                    });
                });
            });

            it('should return 403 for user without RunView access', () => {
                // # Login as otherUser who is not a member of the private playbook
                cy.apiLogin(otherUser);

                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/plugins/playbooks/api/v0/runs/${privatePlaybookRun.id}/followers`,
                    method: 'DELETE',
                    failOnStatusCode: false,
                }).then((response) => {
                    expect(response.status).to.equal(403);
                });
            });

            it('should succeed for user with RunView access', () => {
                // # Login as testUser who is the owner
                cy.apiLogin(testUser);

                // # First follow the run so we can unfollow
                cy.apiFollowPlaybookRun(privatePlaybookRun.id);

                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/plugins/playbooks/api/v0/runs/${privatePlaybookRun.id}/followers`,
                    method: 'DELETE',
                }).then((response) => {
                    expect(response.status).to.equal(200);
                });
            });
        });
    });
});
