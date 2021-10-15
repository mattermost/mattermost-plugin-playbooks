// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import users from '../../fixtures/users.json';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbook run automation', () => {
    let teamId;
    let userId;

    before(() => {
        // # Login as user-1
        cy.legacyApiLogin('user-1');

        // # Get the current team and user
        cy.legacyApiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
        }).then(() => {
            cy.legacyApiGetCurrentUser().then((user) => {
                userId = user.id;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Turn off growth onboarding screens
        cy.apiLogin(users.sysadmin);
        cy.apiUpdateConfig({
            ServiceSettings: {EnableOnboardingFlow: false},
        });

        // # Login as user-1
        cy.legacyApiLogin('user-1');

        // # Go to Town Square
        cy.visit('/ad-1/channels/town-square');
    });

    describe(('when a playbook run starts'), () => {
        describe('invite members setting', () => {
            it('with no invited users and setting disabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the invite users disabled and no invited users
                cy.apiCreatePlaybook({
                    teamId,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [userId],
                    invitedUserIds: [],
                    inviteUsersEnabled: false,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new playbook run with that playbook
                const now = Date.now();
                const playbookRunName = `Run (${now})`;
                const playbookRunChannelName = `run-${now}`;
                cy.apiRunPlaybook({
                    teamId,
                    playbookId,
                    playbookRunName,
                    ownerUserId: userId,
                });

                // # Navigate to the playbook run channel
                cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                // * Verify that no users were invited
                cy.getFirstPostId().then((id) => {
                    cy.get(`#postMessageText_${id}`)
                        .contains('You were added to the channel by @playbooks.')
                        .should('not.contain', 'joined the channel');
                });
            });

            it('with invited users and setting enabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a couple of invited users and the setting enabled, and a playbook run with it
                cy.legacyApiGetUsers(['aaron.medina', 'anne.stone']).then((res) => {
                    const userIds = res.body.map((user) => user.id);

                    return cy.apiCreatePlaybook({
                        teamId,
                        title: playbookName,
                        createPublicPlaybookRun: true,
                        memberIDs: [userId],
                        invitedUserIds: userIds,
                        inviteUsersEnabled: true,
                    });
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: userId,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                    // * Verify that the users were invited
                    cy.getFirstPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`).within(() => {
                            cy.findByText('2 others').click();
                        });

                        cy.get(`#postMessageText_${id}`).contains('@aaron.medina');
                        cy.get(`#postMessageText_${id}`).contains('@anne.stone');
                        cy.get(`#postMessageText_${id}`).contains('added to the channel by @playbooks.');
                    });
                });
            });

            it('with invited users and setting disabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a couple of invited users and the setting enabled, and a playbook run with it
                cy.legacyApiGetUsers(['aaron.medina', 'anne.stone']).then((res) => {
                    const userIds = res.body.map((user) => user.id);

                    return cy.apiCreatePlaybook({
                        teamId,
                        title: playbookName,
                        createPublicPlaybookRun: true,
                        memberIDs: [userId],
                        invitedUserIds: userIds,
                        inviteUsersEnabled: false,
                    });
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: userId,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                    // * Verify that no users were invited
                    cy.getFirstPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`)
                            .contains('You were added to the channel by @playbooks.')
                            .should('not.contain', 'joined the channel');
                    });
                });
            });

            it('with non-existent users', () => {
                let userToRemove;
                let playbook;

                // # Create a playbook with a user that is later removed from the team
                cy.legacyApiLogin('sysadmin').then(() => {
                    cy.apiCreateUser().then((result) => {
                        userToRemove = result.user;
                        cy.legacyApiAddUserToTeam(teamId, userToRemove.id);

                        const playbookName = 'Playbook (' + Date.now() + ')';

                        // # Create a playbook with the user that will be removed from the team.
                        cy.apiCreatePlaybook({
                            teamId,
                            title: playbookName,
                            createPublicPlaybookRun: true,
                            memberIDs: [userId],
                            invitedUserIds: [userToRemove.id],
                            inviteUsersEnabled: true,
                        }).then((res) => {
                            playbook = res;
                        });

                        // # Remove user from the team
                        cy.legacyApiRemoveUserFromTeam(teamId, userToRemove.id);
                    });
                }).then(() => {
                    cy.legacyApiLogin('user-1');

                    // # Create a new playbook run with the playbook.
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: userId,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                    // * Verify that there is an error message from the bot
                    cy.getNthPostId(1).then((id) => {
                        cy.get(`#postMessageText_${id}`)
                            .contains(`Failed to invite the following users: @${userToRemove.username}`);
                    });
                });
            });
        });

        describe('default owner setting', () => {
            it('defaults to the creator when no owner is specified', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the default owner setting set to false
                // and no owner specified
                cy.apiCreatePlaybook({
                    teamId,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [userId],
                    defaultOwnerId: '',
                    defaultOwnerEnabled: false,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new playbook run with that playbook
                const now = Date.now();
                const playbookRunName = `Run (${now})`;
                const playbookRunChannelName = `run-${now}`;
                cy.apiRunPlaybook({
                    teamId,
                    playbookId,
                    playbookRunName,
                    ownerUserId: userId,
                });

                // # Navigate to the playbook run channel
                cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                // * Verify that the RHS shows the owner being the creator
                cy.get('#rhsContainer').within(() => {
                    cy.findByText('Owner').parent().within(() => {
                        cy.findByText('@user-1');
                    });
                });
            });

            it('defaults to the creator when no owner is specified, even if the setting is enabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the default owner setting set to false
                // and no owner specified
                cy.apiCreatePlaybook({
                    teamId,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [userId],
                    defaultOwnerId: '',
                    defaultOwnerEnabled: true,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new playbook run with that playbook
                const now = Date.now();
                const playbookRunName = `Run (${now})`;
                const playbookRunChannelName = `run-${now}`;
                cy.apiRunPlaybook({
                    teamId,
                    playbookId,
                    playbookRunName,
                    ownerUserId: userId,
                });

                // # Navigate to the playbook run channel
                cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                // * Verify that the RHS shows the owner being the creator
                cy.get('#rhsContainer').within(() => {
                    cy.findByText('Owner').parent().within(() => {
                        cy.findByText('@user-1');
                    });
                });
            });

            it('assigns the owner when they are part of the invited members list', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with the owner being part of the invited users
                cy.legacyApiGetUsers(['anne.stone']).then((res) => {
                    const userIds = res.body.map((user) => user.id);

                    return cy.apiCreatePlaybook({
                        teamId,
                        title: playbookName,
                        createPublicPlaybookRun: true,
                        memberIDs: [userId],
                        invitedUserIds: userIds,
                        inviteUsersEnabled: true,
                        defaultOwnerId: userIds[0],
                        defaultOwnerEnabled: true,
                    });
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: userId,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                    // * Verify that the RHS shows the owner being the invited user
                    cy.get('#rhsContainer').within(() => {
                        cy.findByText('Owner').parent().within(() => {
                            cy.findByText('@anne.stone');
                        });
                    });
                });
            });

            it('assigns the owner even if they are not invited', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with the owner being part of the invited users
                cy.legacyApiGetUsers(['anne.stone']).then((res) => {
                    const userIds = res.body.map((user) => user.id);

                    return cy.apiCreatePlaybook({
                        teamId,
                        title: playbookName,
                        createPublicPlaybookRun: true,
                        memberIDs: [userId],
                        invitedUserIds: [],
                        inviteUsersEnabled: false,
                        defaultOwnerId: userIds[0],
                        defaultOwnerEnabled: true,
                    });
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: userId,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                    // * Verify that the RHS shows the owner being the invited user
                    cy.get('#rhsContainer').within(() => {
                        cy.findByText('Owner').parent().within(() => {
                            cy.findByText('@anne.stone');
                        });
                    });
                });
            });

            it('assigns the owner when they and the creator are the same', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the default owner setting set to false
                // and no owner specified
                cy.apiCreatePlaybook({
                    teamId,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [userId],
                    defaultOwnerId: userId,
                    defaultOwnerEnabled: true,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new playbook run with that playbook
                const now = Date.now();
                const playbookRunName = `Run (${now})`;
                const playbookRunChannelName = `run-${now}`;
                cy.apiRunPlaybook({
                    teamId,
                    playbookId,
                    playbookRunName,
                    ownerUserId: userId,
                });

                // # Navigate to the playbook run channel
                cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                // * Verify that the RHS shows the owner being the creator
                cy.get('#rhsContainer').within(() => {
                    cy.findByText('Owner').parent().within(() => {
                        cy.findByText('@user-1');
                    });
                });
            });
        });

        describe('broadcast channel setting', () => {
            it('with channel configured and setting enabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a couple of invited users and the setting enabled, and a playbook run with it
                cy.legacyApiGetChannelByName('ad-1', 'town-square').then(({channel}) => {
                    return cy.apiCreatePlaybook({
                        teamId,
                        title: playbookName,
                        createPublicPlaybookRun: true,
                        memberIDs: [userId],
                        broadcastChannelIds: [channel.id],
                        broadcastEnabled: true,
                    });
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: userId,
                    });

                    // # Navigate to the playbook run channel.
                    cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                    // * Verify that the channel is created and that the first post exists.
                    cy.getFirstPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`)
                            .contains('You were added to the channel by @playbooks.')
                            .should('not.contain', 'joined the channel');
                    });

                    // # Navigate to the broadcast channel
                    cy.visit('/ad-1/channels/town-square');

                    cy.getLastPostId().then((lastPostId) => {
                        cy.get(`#postMessageText_${lastPostId}`).contains(`@user-1 just ran the ${playbookName} playbook. Visit the link above for more information or join ~${playbookRunName} to participate.`);
                    });
                });
            });

            it('with channel configured and setting disabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a couple of invited users and the setting enabled, and a playbook run with it
                cy.legacyApiGetChannelByName('ad-1', 'town-square').then(({channel}) => {
                    return cy.apiCreatePlaybook({
                        teamId,
                        title: playbookName,
                        createPublicPlaybookRun: true,
                        memberIDs: [userId],
                        broadcastChannelIds: [channel.id],
                        broadcastEnabled: false,
                    });
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: userId,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                    // * Verify that the channel is created and that the first post exists.
                    cy.getFirstPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`)
                            .contains('You were added to the channel by @playbooks.')
                            .should('not.contain', 'joined the channel');
                    });

                    // # Navigate to the broadcast channel
                    cy.visit('/ad-1/channels/town-square');

                    cy.getLastPostId().then((lastPostId) => {
                        cy.get(`#postMessageText_${lastPostId}`).should('not.contain', `New Run: ~${playbookRunName}`);
                    });
                });
            });

            it('with non-existent channel', () => {
                let playbookId;

                // # Create a playbook with a channel that is later deleted
                cy.legacyApiLogin('sysadmin').then(() => {
                    const channelDisplayName = String('Channel to delete ' + Date.now());
                    const channelName = channelDisplayName.replace(/ /g, '-').toLowerCase();
                    cy.legacyApiCreateChannel(teamId, channelName, channelDisplayName).then(({channel}) => {
                        // # Create a playbook with the channel to be deleted as the announcement channel
                        cy.apiCreatePlaybook({
                            teamId,
                            title: 'Playbook (' + Date.now() + ')',
                            createPublicPlaybookRun: true,
                            memberIDs: [userId],
                            broadcastChannelIds: [channel.id],
                            broadcastEnabled: true,
                        }).then((playbook) => {
                            playbookId = playbook.id;
                        });

                        // # Delete channel
                        cy.legacyApiDeleteChannel(channel.id);
                    });
                }).then(() => {
                    cy.legacyApiLogin('user-1');

                    // # Create a new playbook run with the playbook.
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId,
                        playbookId,
                        playbookRunName,
                        ownerUserId: userId,
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                    // * Verify that there is an error message from the bot
                    cy.getLastPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`)
                            .contains('Failed to announce the creation of this playbook run in the configured channel.');
                    });
                });
            });
        });

        describe('creation webhook setting', () => {
            it('with webhook correctly configured and setting enabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a correct webhook and the setting enabled
                cy.apiCreatePlaybook({
                    teamId,
                    title: playbookName,
                    createPublicPlaybookRun: true,
                    memberIDs: [userId],
                    webhookOnCreationURLs: ['https://httpbin.org/post'],
                    webhookOnCreationEnabled: true,
                }).then((playbook) => {
                    // # Create a new playbook run with that playbook
                    const now = Date.now();
                    const playbookRunName = `Run (${now})`;
                    const playbookRunChannelName = `run-${now}`;

                    cy.apiRunPlaybook({
                        teamId,
                        playbookId: playbook.id,
                        playbookRunName,
                        ownerUserId: userId,
                        description: 'Playbook run description.',
                    });

                    // # Navigate to the playbook run channel
                    cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

                    // * Verify that the bot has not posted a message informing of the failure to send the webhook
                    cy.getLastPostId().then((lastPostId) => {
                        cy.get(`#postMessageText_${lastPostId}`)
                            .should('not.contain', 'Playbook run creation announcement through the outgoing webhook failed. Contact your System Admin for more information.');
                    });
                });
            });
        });
    });
});
