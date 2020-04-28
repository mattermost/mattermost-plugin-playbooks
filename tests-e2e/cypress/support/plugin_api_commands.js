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
* Delete an incident directly via API
 * @param {String} workflowId
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

