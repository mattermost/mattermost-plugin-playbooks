// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StatusCodeOK, StatusCodeBadRequest, StatusCodeForbidden, OneDay} from '../constants';

describe('api > playbooks > update', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    const apiUpdatePlaybook = (playbookID, payload) => {
        return cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: '/plugins/playbooks/api/v0/playbooks/' + playbookID,
            method: 'PUT',
            body: payload,
            failOnStatusCode: false,
        });
    };

    describe('REST', () => {
        describe('broadcasting', () => {
            let testPlaybook;
            let playbookConfiguration;
            let archivedChannel;
            let notAMemberPublicChannel;
            let notAMemberPrivateChannel;
            let validChannel1;
            let validChannel2;

            before(() => {
                playbookConfiguration = {
                    team_id: testTeam.id,
                    title: 'broadcasting',
                    broadcast_enabled: true,
                    broadcast_channel_ids: [],
                    reminder_timer_default_seconds: OneDay,
                    public: true,
                };

                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'broadcasting',
                }).then((playbook) => {
                    testPlaybook = playbook;
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
                apiUpdatePlaybook(testPlaybook.id, {...playbookConfiguration,
                    broadcast_channel_ids: [
                        'invalid',
                    ]}
                ).then((response) => {
                    expect(response.status).to.equal(StatusCodeForbidden);

                    cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                        expect(playbook.broadcast_channel_ids).to.deep.equal([]);
                    });
                });
            });

            it('to an archived channel', () => {
                apiUpdatePlaybook(testPlaybook.id, {...playbookConfiguration,
                    broadcast_channel_ids: [
                        archivedChannel.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeBadRequest);

                    cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                        expect(playbook.broadcast_channel_ids).to.deep.equal([]);
                    });
                });
            });

            it('to a public channel not accessible by this user', () => {
                apiUpdatePlaybook(testPlaybook.id, {...playbookConfiguration,
                    broadcast_channel_ids: [
                        notAMemberPublicChannel.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeForbidden);

                    cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                        expect(playbook.broadcast_channel_ids).to.deep.equal([]);
                    });
                });
            });

            it('to a private channel not accessible by this user', () => {
                apiUpdatePlaybook(testPlaybook.id, {...playbookConfiguration,
                    broadcast_channel_ids: [
                        notAMemberPrivateChannel.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeForbidden);

                    cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                        expect(playbook.broadcast_channel_ids).to.deep.equal([]);
                    });
                });
            });

            it('to multiple channels, rejecting some', () => {
                apiUpdatePlaybook(testPlaybook.id, {...playbookConfiguration,
                    broadcast_channel_ids: [
                        'invalid',
                        archivedChannel.id,
                        notAMemberPublicChannel.id,
                        notAMemberPrivateChannel.id,
                        validChannel1.id,
                        validChannel2.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeForbidden);

                    cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                        expect(playbook.broadcast_channel_ids).to.deep.equal([]);
                    });
                });
            });

            it('to a single channel', () => {
                apiUpdatePlaybook(testPlaybook.id, {...playbookConfiguration,
                    broadcast_channel_ids: [
                        validChannel1.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeOK);

                    cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                        expect(playbook.broadcast_channel_ids).to.deep.equal([
                            validChannel1.id,
                        ]);
                    });
                });
            });

            it('to multiple single channels', () => {
                apiUpdatePlaybook(testPlaybook.id, {...playbookConfiguration,
                    broadcast_channel_ids: [
                        validChannel1.id,
                        validChannel2.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeOK);

                    cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                        expect(playbook.broadcast_channel_ids).to.deep.equal([
                            validChannel1.id,
                            validChannel2.id,
                        ]);
                    });
                });
            });
        });
    });
});
