// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StatusCodeCreated, StatusCodeBadRequest, StatusCodeForbidden, OneDay} from '../constants';

describe('api > playbooks > create', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    const apiCreatePlaybook = (payload) => {
        return cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: '/plugins/playbooks/api/v0/playbooks',
            method: 'POST',
            body: payload,
            failOnStatusCode: false,
        });
    };

    describe('REST', () => {
        describe('broadcasting', () => {
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
                };

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
                apiCreatePlaybook({...playbookConfiguration,
                    broadcast_channel_ids: [
                        'invalid',
                    ]}
                ).then((response) => {
                    expect(response.status).to.equal(StatusCodeForbidden);
                });
            });

            it('to an archived channel', () => {
                apiCreatePlaybook({...playbookConfiguration,
                    broadcast_channel_ids: [
                        archivedChannel.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeBadRequest);
                });
            });

            it('to a public channel not accessible by this user', () => {
                apiCreatePlaybook({...playbookConfiguration,
                    broadcast_channel_ids: [
                        notAMemberPublicChannel.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeForbidden);
                });
            });

            it('to a private channel not accessible by this user', () => {
                apiCreatePlaybook({...playbookConfiguration,
                    broadcast_channel_ids: [
                        notAMemberPrivateChannel.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeForbidden);
                });
            });

            it('to multiple channels, rejecting some', () => {
                apiCreatePlaybook({...playbookConfiguration,
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
                });
            });

            it('to a single channel', () => {
                apiCreatePlaybook({...playbookConfiguration,
                    broadcast_channel_ids: [
                        validChannel1.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeCreated);

                    cy.request({
                        url: response.headers.location,
                        method: 'GET',
                    }).then((responseGet) => {
                        expect(responseGet.body.broadcast_channel_ids).to.deep.equal([
                            validChannel1.id,
                        ]);
                    });
                });
            });

            it('to multiple single channels', () => {
                apiCreatePlaybook({...playbookConfiguration,
                    broadcast_channel_ids: [
                        validChannel1.id,
                        validChannel2.id,
                    ]}
                ).then((response) => {
                    expect(response.status, response.body?.error).to.equal(StatusCodeCreated);

                    cy.request({
                        url: response.headers.location,
                        method: 'GET',
                    }).then((responseGet) => {
                        expect(responseGet.body.broadcast_channel_ids).to.deep.equal([
                            validChannel1.id,
                            validChannel2.id,
                        ]);
                    });
                });
            });
        });
    });
});
