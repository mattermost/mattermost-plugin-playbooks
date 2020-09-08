// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import endpoints from './endpoints.json';

const incidentsEndpoint = endpoints.incidents;

/**
* Get all incidents directly via API
*/
Cypress.Commands.add('apiGetAllIncidents', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/com.mattermost.plugin-incident-response/api/v1/incidents',
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
        url: incidentsEndpoint + '/${incidentId}',
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
            playbook: {
                id: playbookId,
            },
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response.body);
    });
});

/**
 * Delete an incident directly via API
 * @param {String} incidentId
 * All parameters required
 */
Cypress.Commands.add('apiDeleteIncident', (incidentId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: incidentsEndpoint + '/' + incidentId + '/end',
        method: 'PUT',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

// Verify incident is created
Cypress.Commands.add('verifyIncidentCreated', (incidentName, incidentDescription) => {
    cy.apiGetAllIncidents().then((response) => {
        const allIncidents = JSON.parse(response.body);
        const incident = allIncidents.items.find((inc) => inc.name === incidentName);
        assert.isDefined(incident);
        assert.isTrue(incident.is_active);
        assert.equal(incident.name, incidentName);

        // Only check the description if provided. The server may supply a default depending
        // on how the incident was started.
        if (incidentDescription) {
            assert.equal(incident.description, incidentDescription);
        }
    });
});

// Verify incident is not created
Cypress.Commands.add('verifyIncidentEnded', (incidentName) => {
    cy.apiGetAllIncidents().then((response) => {
        const allIncidents = JSON.parse(response.body);
        const incident = allIncidents.items.find((inc) => inc.name === incidentName);
        assert.isDefined(incident);
        assert.isFalse(incident.is_active);
    });
});

// Create a playbook programmatically.
Cypress.Commands.add('apiCreatePlaybook', ({teamId, title, createPublicIncident, checklists, memberIDs}) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/com.mattermost.plugin-incident-response/api/v1/playbooks',
        method: 'POST',
        body: {
            title,
            team_id: teamId,
            create_public_incident: createPublicIncident,
            checklists,
            member_ids: memberIDs,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response.body);
    });
});

// Create a test playbook programmatically.
Cypress.Commands.add('apiCreateTestPlaybook', ({teamId, title, userId}) => (
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
    })
));
