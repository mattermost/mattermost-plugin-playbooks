// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StatusCodeOK} from '../constants';

const updateRunGraphQL = `
    mutation UpdateRun($id: String!, $updates: RunUpdates!) {
      updateRun(id: $id, updates: $updates)
    }
`;

describe('api > runs > update', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    const apiUpdatePlaybookRun = (playbookRunID, updates) => {
        return cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: '/plugins/playbooks/api/v0/query',
            method: 'POST',
            body: {
                operationName: 'UpdateRun',
                query: updateRunGraphQL,
                variables: {
                    id: playbookRunID,
                    updates,
                },
            },
            failOnStatusCode: false,
        });
    };

    describe('GraphQL', () => {
        describe('broadcasting', () => {
            let testPlaybookRun;

            let archivedChannel;
            let notAMemberPublicChannel;
            let notAMemberPrivateChannel;
            let validChannel1;
            let validChannel2;

            before(() => {
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'broadcasting',
                }).then((playbook) => {
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: 'broadcasting',
                        ownerUserId: testUser.id,
                    }).then((playbookRun) => {
                        testPlaybookRun = playbookRun;
                    });
                });

                cy.apiCreateChannel(testTeam.id, 'archived', 'Archived').then(({channel}) => {
                    cy.apiAddUserToChannel(channel.id, testUser.id);
                    cy.apiDeleteChannel(channel.id);
                    archivedChannel = channel;
                });

                cy.apiCreateChannel(testTeam.id, 'not-a-member', 'Not a member').then(({channel}) => {
                    notAMemberPublicChannel = channel;
                });

                cy.apiCreateChannel(testTeam.id, 'not-a-member', 'Not a member', 'P').then(({channel}) => {
                    notAMemberPrivateChannel = channel;
                });

                cy.apiCreateChannel(testTeam.id, 'valid-channel1', 'Valid channel').then(({channel}) => {
                    cy.apiAddUserToChannel(channel.id, testUser.id);
                    validChannel1 = channel;
                });

                cy.apiCreateChannel(testTeam.id, 'valid-channel2', 'Valid channel').then(({channel}) => {
                    cy.apiAddUserToChannel(channel.id, testUser.id);
                    validChannel2 = channel;
                });
            });

            beforeEach(() => {
                // # Login as testUser
                cy.apiLogin(testUser);
            });

            it('to an invalid channel id', () => {
                apiUpdatePlaybookRun(testPlaybookRun.id, {
                    broadcastChannelIDs: [
                        'invalid',
                    ]}
                ).then((response) => {
                    expect(response.status).to.equal(StatusCodeOK);
                    expect(response.body?.errors.length).to.not.equal(0);

                    cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                        expect(playbookRun.broadcast_channel_ids).to.deep.equal([]);
                    });
                });
            });

            it('to an archived channel', () => {
                apiUpdatePlaybookRun(testPlaybookRun.id, {
                    broadcastChannelIDs: [
                        archivedChannel.id,
                    ]}
                ).then((response) => {
                    expect(response.status).to.equal(StatusCodeOK);
                    expect(response.body?.errors.length).to.not.equal(0);

                    cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                        expect(playbookRun.broadcast_channel_ids).to.deep.equal([]);
                    });
                });
            });

            it('to a public channel not accessible by this user', () => {
                apiUpdatePlaybookRun(testPlaybookRun.id, {
                    broadcastChannelIDs: [
                        notAMemberPublicChannel.id,
                    ]}
                ).then((response) => {
                    expect(response.status).to.equal(StatusCodeOK);
                    expect(response.body?.errors.length).to.not.equal(0);

                    cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                        expect(playbookRun.broadcast_channel_ids).to.deep.equal([]);
                    });
                });
            });

            it('to a private channel not accessible by this user', () => {
                apiUpdatePlaybookRun(testPlaybookRun.id, {
                    broadcastChannelIDs: [
                        notAMemberPrivateChannel.id,
                    ]}
                ).then((response) => {
                    expect(response.status).to.equal(StatusCodeOK);
                    expect(response.body?.errors.length).to.not.equal(0);

                    cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                        expect(playbookRun.broadcast_channel_ids).to.deep.equal([]);
                    });
                });
            });

            it('to multiple channels, rejecting some', () => {
                apiUpdatePlaybookRun(testPlaybookRun.id, {
                    broadcastChannelIDs: [
                        'invalid',
                        archivedChannel.id,
                        notAMemberPublicChannel.id,
                        notAMemberPrivateChannel.id,
                        validChannel1.id,
                        validChannel2.id,
                    ]}
                ).then((response) => {
                    expect(response.status).to.equal(StatusCodeOK);
                    expect(response.body?.errors.length).to.not.equal(0);

                    cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                        expect(playbookRun.broadcast_channel_ids).to.deep.equal([]);
                    });
                });
            });

            it('to a single channel', () => {
                apiUpdatePlaybookRun(testPlaybookRun.id, {
                    broadcastChannelIDs: [
                        validChannel1.id,
                    ]}
                ).then((response) => {
                    expect(response.status).to.equal(StatusCodeOK);
                    expect(response.body?.errors).to.be.undefined;

                    cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                        expect(playbookRun.broadcast_channel_ids).to.deep.equal([
                            validChannel1.id,
                        ]);
                    });
                });
            });

            it('to multiple single channels', () => {
                apiUpdatePlaybookRun(testPlaybookRun.id, {
                    broadcastChannelIDs: [
                        validChannel1.id,
                        validChannel2.id,
                    ]}
                ).then((response) => {
                    expect(response.status).to.equal(StatusCodeOK);
                    expect(response.body?.errors).to.be.undefined;

                    cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                        expect(playbookRun.broadcast_channel_ids).to.deep.equal([
                            validChannel1.id,
                            validChannel2.id,
                        ]);
                    });
                });
            });
        });
    });
});
