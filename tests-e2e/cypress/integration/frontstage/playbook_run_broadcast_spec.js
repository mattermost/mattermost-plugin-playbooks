// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import users from '../../fixtures/users.json';

describe('playbook run broadcast', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let sysadminId;

    let publicBroadcastChannelName1;
    let publicBroadcastChannelId1;
    let publicBroadcastChannelName2;
    let publicBroadcastChannelId2;

    let privateBroadcastChannelName1;
    let privateBroadcastChannelId1;
    let privateBroadcastChannelName2;
    let privateBroadcastChannelId2;

    let publicBroadcastPlaybookId;
    let privateBroadcastPlaybookId;
    let allBroadcastPlaybookId;
    let rootDeletePlaybookId;

    before(() => {
        // # Turn off growth onboarding screens
        cy.apiLogin(users.sysadmin);
        cy.legacyApiGetCurrentUser().then((user) => {
            sysadminId = user.id;
        });

        cy.apiUpdateConfig({
            ServiceSettings: {EnableOnboardingFlow: false},
        });

        // # Login as user-1
        cy.legacyApiLogin('user-1');

        // # Get the current team and user
        cy.legacyApiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
        }).then(() => {
            cy.legacyApiGetCurrentUser().then((user) => {
                userId = user.id;
            });
        }).then(() => {
            // # Create public channel #1
            cy.legacyApiCreateChannel(teamId, 'public-channel', 'Public Channel 1', 'O')
                .then(({channel: publicChannel1}) => {
                    // # Create public channel #2
                    cy.legacyApiCreateChannel(teamId, 'public-channel-2', 'Public Channel 2', 'O')
                        .then(({channel: publicChannel2}) => {
                            // # Create private channel #1
                            cy.legacyApiCreateChannel(teamId, 'private-channel', 'Private Channel 1', 'P')
                                .then(({channel: privateChannel1}) => {
                                    // # Create private channel #2
                                    cy.legacyApiCreateChannel(teamId, 'private-channel-2', 'Private Channel 2', 'P')
                                        .then(({channel: privateChannel2}) => {
                                            publicBroadcastChannelName1 = publicChannel1.name;
                                            publicBroadcastChannelId1 = publicChannel1.id;
                                            publicBroadcastChannelName2 = publicChannel2.name;
                                            publicBroadcastChannelId2 = publicChannel2.id;
                                            privateBroadcastChannelName1 = privateChannel1.name;
                                            privateBroadcastChannelId1 = privateChannel1.id;
                                            privateBroadcastChannelName2 = privateChannel2.name;
                                            privateBroadcastChannelId2 = privateChannel2.id;

                                            // # Create a playbook that will broadcast to public channel1
                                            cy.apiCreateTestPlaybook({
                                                teamId,
                                                title: playbookName + ' - public broadcast',
                                                userId,
                                                broadcastChannelIds: [publicBroadcastChannelId1],
                                                broadcastEnabled: true,
                                            }).then((playbook) => {
                                                publicBroadcastPlaybookId = playbook.id;
                                            });

                                            // # Create a playbook that will broadcast to private channel1
                                            cy.apiCreateTestPlaybook({
                                                teamId,
                                                title: playbookName + ' - private broadcast',
                                                userId,
                                                broadcastChannelIds: [privateBroadcastChannelId1],
                                                broadcastEnabled: true,
                                            }).then((playbook) => {
                                                privateBroadcastPlaybookId = playbook.id;
                                            });

                                            // # Create a playbook that will broadcast to all 4 channels
                                            cy.apiCreateTestPlaybook({
                                                teamId,
                                                title: playbookName + ' - public and private broadcast',
                                                userId,
                                                broadcastChannelIds: [publicBroadcastChannelId1, publicBroadcastChannelId2, privateBroadcastChannelId1, privateBroadcastChannelId2],
                                                broadcastEnabled: true,
                                            }).then((playbook) => {
                                                allBroadcastPlaybookId = playbook.id;
                                            });

                                            // # Create a playbook for testing deleting root posts
                                            cy.apiCreateTestPlaybook({
                                                teamId,
                                                title: playbookName + ' - test deleting root posts',
                                                userId,
                                                broadcastChannelIds: [publicBroadcastChannelId1, privateBroadcastChannelId1],
                                                broadcastEnabled: true,
                                                otherMembers: [sysadminId],
                                                invitedUserIds: [sysadminId],
                                            }).then((playbook) => {
                                                rootDeletePlaybookId = playbook.id;
                                            });

                                            // # invite sysadmin to the channel they will need to be in to delete the post
                                            cy.apiAddUserToChannel(publicBroadcastChannelId1, sysadminId);
                                            cy.apiAddUserToChannel(privateBroadcastChannelId1, sysadminId);
                                        });
                                });
                        });
                });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.legacyApiLogin('user-1');

        // # Go to Town Square
        cy.visit('/ad-1/channels/town-square');
    });

    it('to public channels', () => {
        // # Create a new playbook run
        const now = Date.now();
        const playbookRunName = `Playbook Run (${now})`;
        const playbookRunChannelName = `playbook-run-${now}`;
        cy.apiRunPlaybook({
            teamId,
            playbookId: publicBroadcastPlaybookId,
            playbookRunName,
            ownerUserId: userId,
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/ad-1/channels/${playbookRunChannelName}`);

        // # Update the playbook run's status
        const updateMessage = 'Update - ' + now;
        cy.updateStatus(updateMessage, 0);

        // * Verify the posts
        const initialMessage = `New run started: ${playbookRunName}`;
        verifyInitialAndStatusPostInBroadcast(publicBroadcastChannelName1, playbookRunName, initialMessage, updateMessage);
    });

    it('to private channels', () => {
        // # Create a new playbook run
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        const playbookRunChannelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId,
            playbookId: privateBroadcastPlaybookId,
            playbookRunName,
            ownerUserId: userId,
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit('/ad-1/channels/' + playbookRunChannelName);

        // # Update the playbook run's status
        const updateMessage = 'Update - ' + now;
        cy.updateStatus(updateMessage, 0);

        // * Verify the posts
        const initialMessage = `New run started: ${playbookRunName}`;
        verifyInitialAndStatusPostInBroadcast(privateBroadcastChannelName1, playbookRunName, initialMessage, updateMessage);
    });

    it('to 4 public and private channels', () => {
        // # Create a new playbook run
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        const playbookRunChannelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId,
            playbookId: allBroadcastPlaybookId,
            playbookRunName,
            ownerUserId: userId,
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit('/ad-1/channels/' + playbookRunChannelName);

        // # Update the playbook run's status
        const updateMessage = 'Update - ' + now;
        cy.updateStatus(updateMessage, 0);

        // * Verify the posts
        const initialMessage = `New run started: ${playbookRunName}`;
        verifyInitialAndStatusPostInBroadcast(publicBroadcastChannelName1, playbookRunName, initialMessage, updateMessage);
        verifyInitialAndStatusPostInBroadcast(privateBroadcastChannelName1, playbookRunName, initialMessage, updateMessage);
        verifyInitialAndStatusPostInBroadcast(publicBroadcastChannelName2, playbookRunName, initialMessage, updateMessage);
        verifyInitialAndStatusPostInBroadcast(privateBroadcastChannelName2, playbookRunName, initialMessage, updateMessage);
    });

    it('to 2 channels, delete the root post, update again', () => {
        // # need to be sysadmin to delete the bot's posts
        cy.apiLogin(users.sysadmin);

        // # Create a new playbook run
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        const playbookRunChannelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId,
            playbookId: rootDeletePlaybookId,
            playbookRunName,
            ownerUserId: userId,
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit('/ad-1/channels/' + playbookRunChannelName);

        // # Update the playbook run's status
        const updateMessage = 'Update - ' + now;
        cy.updateStatus(updateMessage, 0);

        // * Verify the posts
        const initialMessage = `New run started: ${playbookRunName}`;
        verifyInitialAndStatusPostInBroadcast(publicBroadcastChannelName1, playbookRunName, initialMessage, updateMessage, '@sysadmin');
        verifyInitialAndStatusPostInBroadcast(privateBroadcastChannelName1, playbookRunName, initialMessage, updateMessage, '@sysadmin');

        // # Delete both root posts
        deleteLatestPostRoot(publicBroadcastChannelName1);
        deleteLatestPostRoot(privateBroadcastChannelName1);

        // # Make two more updates
        // # Navigate directly to the application and the playbook run channel
        cy.visit('/ad-1/channels/' + playbookRunChannelName);

        // # Update the playbook run's status twice
        const updateMessage2 = updateMessage + ' - 2';
        cy.updateStatus(updateMessage2, 0);
        const updateMessage3 = updateMessage + ' - 3';
        cy.updateStatus(updateMessage3, 0);

        // * Verify the posts
        verifyInitialAndStatusPostInBroadcast(publicBroadcastChannelName1, playbookRunName, updateMessage2, updateMessage3, '@sysadmin');
        verifyInitialAndStatusPostInBroadcast(privateBroadcastChannelName1, playbookRunName, updateMessage2, updateMessage3, '@sysadmin');
    });
});

const verifyInitialAndStatusPostInBroadcast = (channelName, runName, initialMessage, updateMessage, byUser = '@user-1') => {
    // # Navigate to the broadcast channel
    cy.visit('/ad-1/channels/' + channelName);

    // * Verify that the last post contains the expected header and the update message verbatim
    cy.getLastPostId().then((lastPostId) => {
        // # Open RHS comment menu
        cy.clickPostCommentIcon(lastPostId);

        cy.get('#rhsContainer').should('exist').within(() => {
            // * Thread should have two posts
            cy.findAllByRole('listitem').should('have.length', 2);

            // * Root should be announcement
            cy.get('.thread__root').contains(initialMessage);

            // * Latest post should be update
            cy.get(`#rhsPostMessageText_${lastPostId}`).contains(`Status Update: ${runName}`);
            cy.get(`#rhsPostMessageText_${lastPostId}`)
                .contains(`By ${byUser} | Duration: < 1m | Status: In Progress`);
            cy.get(`#rhsPostMessageText_${lastPostId}`).contains(updateMessage);
        });
    });
};

const deleteLatestPostRoot = (channelName) => {
    // # Navigate to the channel
    cy.visit('/ad-1/channels/' + channelName);

    cy.getLastPostId().then((lastPostId) => {
        // # Open RHS comment menu
        cy.clickPostCommentIcon(lastPostId);

        cy.get('.thread__root').then((root) => {
            const rootId = root.attr('id').slice(8);

            // # Click root's post dot menu.
            cy.clickPostDotMenu(rootId, 'RHS_ROOT');

            // # Click delete button.
            const id = `#delete_post_${rootId}`;
            cy.get(id).click();

            // * Check that confirmation dialog is open.
            cy.get('#deletePostModal').should('be.visible');

            // * Check that confirmation dialog contains correct text
            cy.get('#deletePostModal')
                .should('contain', 'Are you sure you want to delete this Post?');

            // * Check that confirmation dialog shows that the post has one comment on it
            cy.get('#deletePostModal').should('contain', 'This post has 1 comment on it.');

            // # Confirm deletion.
            cy.get('#deletePostModalButton').click();
        });
    });
};
