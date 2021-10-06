// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const playbookRunsEndpoint = '/plugins/playbooks/api/v0/runs';

/**
 * Get all playbook runs directly via API
 */
Cypress.Commands.add('apiGetAllPlaybookRuns', (teamId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/runs',
        qs: {team_id: teamId, per_page: 10000},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

/**
 * Get all InProgress playbook runs directly via API
 */
Cypress.Commands.add('apiGetAllInProgressPlaybookRuns', (teamId, userId = '') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/runs',
        qs: {team_id: teamId, status: 'InProgress', participant_id: userId},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

/**
 * Get playbook run by name directly via API
 */
Cypress.Commands.add('apiGetPlaybookRunByName', (teamId, name) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/runs',
        qs: {team_id: teamId, search_term: name},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

/**
 * Get a playbook run directly via API
 * @param {String} playbookRunId
 * All parameters required
 */
Cypress.Commands.add('apiGetPlaybookRun', (playbookRunId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `${playbookRunsEndpoint}/${playbookRunId}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

/**
 * Start a playbook run directly via API.
 */
Cypress.Commands.add('apiRunPlaybook', (
    {
        teamId,
        playbookId,
        playbookRunName,
        ownerUserId,
        description = ''
    }) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: playbookRunsEndpoint,
        method: 'POST',
        body: {
            name: playbookRunName,
            owner_user_id: ownerUserId,
            team_id: teamId,
            playbook_id: playbookId,
            description,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        cy.wrap(response.body);
    });
});

// Finish a playbook's run programmaticially. Uses currently logged in user, so that user must
// have edit permissions on the run
Cypress.Commands.add('apiFinishRun', (playbookRunId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `${playbookRunsEndpoint}/${playbookRunId}/finish`,
        method: 'PUT',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response.body);
    });
});

// Update a playbook run's status programmatically.
Cypress.Commands.add('apiUpdateStatus', (
    {
        playbookRunId,
        userId,
        channelId,
        teamId,
        message,
        description,
        reminder = '300',
    }) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `${playbookRunsEndpoint}/${playbookRunId}/update-status-dialog`,
        method: 'POST',
        body: {
            type: 'dialog_submission',
            callback_id: '',
            state: '',
            user_id: userId,
            channel_id: channelId,
            team_id: teamId,
            submission: {message, description, reminder},
            cancelled: false,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response.body);
    });
});

/**
 * Change the owner of a playbook run directly via API
 * @param {String} playbookRunId
 * @param {String} userId
 * All parameters required
 */
Cypress.Commands.add('apiChangePlaybookRunOwner', (playbookRunId, userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: playbookRunsEndpoint + '/' + playbookRunId + '/owner',
        method: 'POST',
        body: {
            owner_id: userId,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

// Verify playbook run is created
Cypress.Commands.add('verifyPlaybookRunActive', (teamId, playbookRunName, playbookRunDescription) => {
    cy.apiGetPlaybookRunByName(teamId, playbookRunName).then((response) => {
        const returnedPlaybookRuns = response.body;
        const playbookRun = returnedPlaybookRuns.items.find((inc) => inc.name === playbookRunName);
        assert.isDefined(playbookRun);
        assert.equal(playbookRun.end_at, 0);
        assert.equal(playbookRun.name, playbookRunName);

        cy.log('test 1');

        // Only check the description if provided. The server may supply a default depending
        // on how the playbook run was started.
        if (playbookRunDescription) {
            assert.equal(playbookRun.description, playbookRunDescription);
        }
    });
});

// Verify playbook run exists but is not active
Cypress.Commands.add('verifyPlaybookRunEnded', (teamId, playbookRunName) => {
    cy.apiGetPlaybookRunByName(teamId, playbookRunName).then((response) => {
        const returnedPlaybookRuns = response.body;
        const playbookRun = returnedPlaybookRuns.items.find((inc) => inc.name === playbookRunName);
        assert.isDefined(playbookRun);
        assert.notEqual(playbookRun.end_at, 0);
    });
});

// Create a playbook programmatically.
Cypress.Commands.add('apiCreatePlaybook', (
    {
        teamId,
        title,
        createPublicPlaybookRun,
        checklists,
        memberIDs,
        broadcastEnabled,
        broadcastChannelIds,
        reminderMessageTemplate,
        reminderTimerDefaultSeconds,
        invitedUserIds,
        inviteUsersEnabled,
        defaultOwnerId,
        defaultOwnerEnabled,
        announcementChannelId,
        announcementChannelEnabled,
        webhookOnCreationURLs,
        webhookOnCreationEnabled,
        webhookOnStatusUpdateURLs,
        webhookOnStatusUpdateEnabled,
        messageOnJoin,
        messageOnJoinEnabled,
        signalAnyKeywords,
        signalAnyKeywordsEnabled,
    }) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/playbooks',
        method: 'POST',
        body: {
            title,
            team_id: teamId,
            create_public_playbook_run: createPublicPlaybookRun,
            checklists,
            member_ids: memberIDs,
            broadcast_enabled: broadcastEnabled,
            broadcast_channel_ids: broadcastChannelIds,
            reminder_message_template: reminderMessageTemplate,
            reminder_timer_default_seconds: reminderTimerDefaultSeconds,
            invited_user_ids: invitedUserIds,
            invite_users_enabled: inviteUsersEnabled,
            default_owner_id: defaultOwnerId,
            default_owner_enabled: defaultOwnerEnabled,
            announcement_channel_id: announcementChannelId,
            announcement_channel_enabled: announcementChannelEnabled,
            webhook_on_creation_urls: webhookOnCreationURLs,
            webhook_on_creation_enabled: webhookOnCreationEnabled,
            webhook_on_status_update_urls: webhookOnStatusUpdateURLs,
            webhook_on_status_update_enabled: webhookOnStatusUpdateEnabled,
            message_on_join: messageOnJoin,
            message_on_join_enabled: messageOnJoinEnabled,
            signal_any_keywords: signalAnyKeywords,
            signal_any_keywords_enabled: signalAnyKeywordsEnabled,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        cy.wrap(response.body);
    });
});

// Create a test playbook programmatically.
Cypress.Commands.add('apiCreateTestPlaybook', (
    {
        teamId,
        title,
        userId,
        broadcastEnabled,
        broadcastChannelIds,
        reminderMessageTemplate,
        reminderTimerDefaultSeconds,
        otherMembers = [],
        invitedUserIds = [],
    }) => (
    cy.apiCreatePlaybook({
        teamId,
        title,
        checklists: [{
            title: 'Stage 1',
            items: [
                {title: 'Step 1'},
                {title: 'Step 2'},
            ],
        }],
        memberIDs: [
            userId,
            ...otherMembers,
        ],
        broadcastEnabled,
        broadcastChannelIds,
        reminderMessageTemplate,
        reminderTimerDefaultSeconds,
        invitedUserIds,
    })
));

// Verify that the playbook was created
Cypress.Commands.add('verifyPlaybookCreated', (teamId, playbookTitle) => (
    cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/playbooks',
        qs: {team_id: teamId, sort: 'title', direction: 'asc'},
        method: 'GET'
    }).then((response) => {
        expect(response.status).to.equal(200);
        const playbookResults = response.body;
        const playbook = playbookResults.items.find((p) => p.title === playbookTitle);
        assert.isDefined(playbook);
    })
));
