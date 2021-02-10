// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

describe('timeline', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let teamName;
    let userId;
    let playbookId;
    let incidentName;
    let channelName;
    let channelId;

    before(() => {
        // # Login as the sysadmin
        cy.apiLogin('sysadmin');

        // # Create a new team for the welcome page test
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            teamName = team.name;
            teamId = team.id;

            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });

            // # Add aaron.peterson to team
            cy.apiGetUserByEmail('user-7@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });

            // # Login as user-1
            cy.apiLogin('user-1');

            // # Create a playbook
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');

        // # Create a new incident
        const now = Date.now();
        incidentName = 'Incident (' + now + ')';
        channelName = 'incident-' + now;
        cy.apiStartIncident({
            teamId,
            playbookId,
            incidentName,
            commanderUserId: userId,
        });

        cy.apiGetChannelByName(teamName, channelName).then(({channel}) => {
            channelId = channel.id;
        });

        // # Navigate directly to the application and the incident channel
        cy.visit(`/${teamName}/channels/${channelName}`);

        // # Add a second user
        cy.executeSlashCommand('/invite @aaron.peterson');

        // * Verify the incident RHS is open.
        cy.get('#rhsContainer').should('exist').within(() => {
            cy.findByText(incidentName).should('exist');

            // # Select the timeline tab
            cy.findByTestId('timeline').click();
        });
    });

    describe('timeline updates', () => {
        it('show the incident created, status updated, and commander changed events', () => {
            // * Verify incident created message is visible in the timeline
            verifyTimelineEvent('incident_created', 1, 0, 'Incident Reported by user-1');

            // # Post an update that doesn't change the incident status
            cy.updateStatus('this is a status update');

            // * Verify we can see the update in the timeline
            verifyTimelineEvent('status_updated', 1, 0, 'user-1 posted a status update');

            // # Change commander
            cy.executeSlashCommand('/incident commander @aaron.peterson');

            // * Verify we can see the change commander in the timeline
            verifyTimelineEvent('commander_changed', 1, 0, 'Commander changed from @user-1 to @aaron.peterson');

            // # Post an update that changes the incident status
            cy.updateStatus('this is a status update', 0, 'Active');

            // * Verify we can see the update in the timeline
            verifyTimelineEvent('status_updated', 2, 1, 'Reported to Active');

            // # Change commander
            cy.executeSlashCommand('/incident commander @user-1');

            // * Verify we can see the change commander in the timeline
            verifyTimelineEvent('commander_changed', 2, 1, 'changed from @aaron.peterson to @user-1');
        });
    });

    describe('events from posts in the incident channel ', () => {
        it('show up at the end and in the middle of the timeline', () => {
            // # Post the first message we'll click on
            cy.apiCreatePost(channelId, 'this is the first post').then(({post}) => {
                // # Change commander, to create a timeline event
                cy.executeSlashCommand('/incident commander @aaron.peterson');

                // * Verify we can see the change commander in the timeline
                verifyTimelineEvent('commander_changed', 1, 0, 'Commander changed from @user-1 to @aaron.peterson');

                // # Post the second message we'll click on
                cy.createPost('this is the second post we\'ll click on');

                // # Add a timeline event from a post at the end of the incident
                const summary1 = 'This is the incident summary 1';
                cy.addPostToTimelineUsingPostMenu(incidentName, summary1);

                // * Verify we can see the new timeline event
                verifyTimelineEvent('event_from_post', 1, 0, summary1);

                // # Add a timeline event from a post near the start of the incident
                const summary2 = 'This is the incident summary 2';
                cy.addPostToTimelineUsingPostMenu(incidentName, summary2, post.id);

                // * Verify we can see the new timeline event
                verifyTimelineEvent('event_from_post', 2, 0, summary2);
            });
        });
    });

    describe('events from posts in another channel ', () => {
        it('show up at the end and in the middle of the timeline', () => {
            const summary1 = 'This is the incident summary 1';
            const summary2 = 'This is the incident summary 2';

            cy.apiCreateChannel(teamId, 'test-channel', 'Test Channel', 'O').then(({channel}) => {
                // # Navigate to our new channel
                cy.visit(`/${teamName}/channels/${channel.name}`);

                cy.apiCreatePost(channel.id, 'this is the first post').then(({post}) => {
                    // # Post the second message we'll click on
                    cy.createPost('this is the second post we\'ll click on');

                    // # Add a timeline event from a post at the end of the incident
                    cy.addPostToTimelineUsingPostMenu(incidentName, summary1);

                    // # Add a timeline event from a post near the start of the incident
                    cy.addPostToTimelineUsingPostMenu(incidentName, summary2, post.id);
                });
            });

            // # Navigate back to the incident channel
            cy.visit(`/${teamName}/channels/${channelName}`);

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');

                // # Select the timeline tab
                cy.findByTestId('timeline').click();
            });

            // * Verify we can see the new timeline event
            verifyTimelineEvent('event_from_post', 2, 1, summary1);

            // * Verify we can see the new timeline event
            verifyTimelineEvent('event_from_post', 2, 0, summary2);
        });
    });
});

const verifyTimelineEvent = (expectedEventType, expectedNumberOfEvents, expectedEventIndex, expectedEventSummary) => {
    cy.findByTestId('timeline-view').within(() => {
        cy.findAllByTestId(expectedEventType).should('have.length', expectedNumberOfEvents);
        cy.findAllByTestId(expectedEventType)
            .eq(expectedEventIndex)
            .contains(expectedEventSummary)
            .should('be.visible');
    });
};
