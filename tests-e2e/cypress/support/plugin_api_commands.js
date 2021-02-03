// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import endpoints from './endpoints.json';

const incidentsEndpoint = endpoints.incidents;

/**
 * Get all incidents directly via API
 */
Cypress.Commands.add('apiGetAllIncidents', (teamId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/com.mattermost.plugin-incident-management/api/v0/incidents',
        qs: {team_id: teamId, per_page: 10000},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

/**
 * Get all active incidents directly via API
 */
Cypress.Commands.add('apiGetAllActiveIncidents', (teamId, userId = '') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/com.mattermost.plugin-incident-management/api/v0/incidents',
        qs: {team_id: teamId, status: 'Active', member_id: userId},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

/**
 * Get all reported incidents directly via API
 */
Cypress.Commands.add('apiGetAllReportedIncidents', (teamId, userId = '') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/com.mattermost.plugin-incident-management/api/v0/incidents',
        qs: {team_id: teamId, status: 'Reported', member_id: userId},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

/**
 * Get incident by name directly via API
 */
Cypress.Commands.add('apiGetIncidentByName', (teamId, name) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/com.mattermost.plugin-incident-management/api/v0/incidents',
        qs: {team_id: teamId, search_term: name},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

/**
 * Get an incident directly via API
 * @param {String} incidentId
 * All parameters required
 */
Cypress.Commands.add('apiGetIncident', (incidentId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `${incidentsEndpoint}/${incidentId}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

/**
 * Start an incident directly via API.
 */
Cypress.Commands.add('apiStartIncident', ({teamId, playbookId, incidentName, commanderUserId}) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: incidentsEndpoint,
        method: 'POST',
        body: {
            name: incidentName,
            commander_user_id: commanderUserId,
            team_id: teamId,
            playbook_id: playbookId,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        cy.wrap(response.body);
    });
});

// Update an incident's status programmatically.
Cypress.Commands.add('apiUpdateStatus', ({incidentId, userId, channelId, teamId, message, status}) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `${incidentsEndpoint}/${incidentId}/update-status-dialog`,
        method: 'POST',
        body: {
            type: 'dialog_submission',
            callback_id: '',
            state: '',
            user_id: userId,
            channel_id: channelId,
            team_id: teamId,
            submission: {message, reminder: '15', status},
            cancelled: false,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response.body);
    });
});

/**
 * Restart an incident directly via API
 * @param {String} incidentId
 * All parameters required
 */
Cypress.Commands.add('apiRestartIncident', (incidentId) => {
    return cy.apiUpdateStatus({
        incidentId,
        userId: '',
        channelId: '',
        teamId: '',
        reminder: '',
        message: 'reopen',
        status: 'Active',
    });
});

/**
 * Change the commander of an incident directly via API
 * @param {String} incidentId
 * @param {String} userId
 * All parameters required
 */
Cypress.Commands.add('apiChangeIncidentCommander', (incidentId, userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: incidentsEndpoint + '/' + incidentId + '/commander',
        method: 'POST',
        body: {
            commander_id: userId,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

// Verify incident is created
Cypress.Commands.add('verifyIncidentActive', (teamId, incidentName, incidentDescription) => {
    cy.apiGetIncidentByName(teamId, incidentName).then((response) => {
        const returnedIncidents = JSON.parse(response.body);
        const incident = returnedIncidents.items.find((inc) => inc.name === incidentName);
        assert.isDefined(incident);
        assert.equal(incident.end_at, 0);
        assert.equal(incident.name, incidentName);

        // Only check the description if provided. The server may supply a default depending
        // on how the incident was started.
        if (incidentDescription) {
            assert.equal(incident.description, incidentDescription);
        }
    });
});

// Verify incident exists but is not active
Cypress.Commands.add('verifyIncidentEnded', (teamId, incidentName) => {
    cy.apiGetIncidentByName(teamId, incidentName).then((response) => {
        const returnedIncidents = JSON.parse(response.body);
        const incident = returnedIncidents.items.find((inc) => inc.name === incidentName);
        assert.isDefined(incident);
        assert.notEqual(incident.end_at, 0);
    });
});

// Create a playbook programmatically.
Cypress.Commands.add('apiCreatePlaybook', ({teamId, title, createPublicIncident, checklists, memberIDs, broadcastChannelId, reminderMessageTemplate, reminderTimerDefaultSeconds, invitedUserIds, inviteUsersEnabled}) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/com.mattermost.plugin-incident-management/api/v0/playbooks',
        method: 'POST',
        body: {
            title,
            team_id: teamId,
            create_public_incident: createPublicIncident,
            checklists,
            member_ids: memberIDs,
            broadcast_channel_id: broadcastChannelId,
            reminder_message_template: reminderMessageTemplate,
            reminder_timer_default_seconds: reminderTimerDefaultSeconds,
            invited_user_ids: invitedUserIds,
            invite_users_enabled: inviteUsersEnabled,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        cy.wrap(response.body);
    });
});

// Create a test playbook programmatically.
Cypress.Commands.add('apiCreateTestPlaybook', ({teamId, title, userId, broadcastChannelId, reminderMessageTemplate, reminderTimerDefaultSeconds}) => (
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
        ],
        broadcastChannelId,
        reminderMessageTemplate,
        reminderTimerDefaultSeconds,
    })
));

// Verify that the playbook was created
Cypress.Commands.add('verifyPlaybookCreated', (teamId, playbookTitle) => (
    cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/com.mattermost.plugin-incident-management/api/v0/playbooks',
        qs: {team_id: teamId, sort: 'title', direction: 'asc'},
        method: 'GET'
    }).then((response) => {
        expect(response.status).to.equal(200);
        const playbookResults = JSON.parse(response.body);
        const playbook = playbookResults.items.find((p) => p.title === playbookTitle);
        assert.isDefined(playbook);
    })
));
