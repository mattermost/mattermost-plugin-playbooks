// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbook run broadcast', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;

    let publicBroadcastChannelName;
    let publicBroadcastChannelId;
    let publicBroadcastPlaybookId;

    let privateBroadcastChannelName;
    let privateBroadcastChannelId;
    let privateBroadcastPlaybookId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Get the current team and user
        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
        }).then(() => {
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;
            });
        }).then(() => {
            // # Create a public channel
            cy.apiCreateChannel(teamId, 'public-channel', 'Public Channel', 'O').then(({channel}) => {
                publicBroadcastChannelName = channel.name;
                publicBroadcastChannelId = channel.id;

                // # Create a playbook that will broadcast to a public channel
                cy.apiCreateTestPlaybook({
                    teamId,
                    title: playbookName + ' - public broadcast',
                    userId,
                    broadcastChannelId: publicBroadcastChannelId,
                }).then((playbook) => {
                    publicBroadcastPlaybookId = playbook.id;
                });
            });

            // # Create a private channel
            cy.apiCreateChannel(teamId, 'private-channel', 'Private Channel', 'P').then(({channel}) => {
                privateBroadcastChannelName = channel.name;
                privateBroadcastChannelId = channel.id;

                // # Create a playbook that will broadcast to a public channel
                cy.apiCreateTestPlaybook({
                    teamId,
                    title: playbookName + ' - private broadcast',
                    userId,
                    broadcastChannelId: privateBroadcastChannelId,
                }).then((playbook) => {
                    privateBroadcastPlaybookId = playbook.id;
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');

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
        cy.updateStatus(updateMessage, 0, 'Active');

        // * Verify that the RHS shows the status update
        cy.get('div[class^=UpdateSection-]').within(() => {
            cy.findByText(updateMessage).should('exist');
        });

        // # Navigate to the broadcast channel
        cy.visit(`/ad-1/channels/${publicBroadcastChannelName}`);

        // * Verify that the last post contains the expected header and the update message verbatim
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#postMessageText_${lastPostId}`).contains(`Status Update: ${playbookRunName}`);
            cy.get(`#postMessageText_${lastPostId}`).contains('By @user-1 | Duration: < 1m | Status: Active');
            cy.get(`#postMessageText_${lastPostId}`).contains(updateMessage);
        });
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
        cy.updateStatus(updateMessage, 0, 'Active');

        // * Verify that the RHS shows the status update
        cy.get('div[class^=UpdateSection-]').within(() => {
            cy.findByText(updateMessage).should('exist');
        });

        // # Navigate to the broadcast channel
        cy.visit('/ad-1/channels/' + privateBroadcastChannelName);

        // * Verify that the last post contains the expected header and the update message verbatim
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#postMessageText_${lastPostId}`).contains(`Status Update: ${playbookRunName}`);
            cy.get(`#postMessageText_${lastPostId}`).contains('By @user-1 | Duration: < 1m | Status: Active');
            cy.get(`#postMessageText_${lastPostId}`).contains(updateMessage);
        });
    });
});
