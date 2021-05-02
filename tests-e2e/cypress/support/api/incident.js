// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../utils';
import endpoints from '../endpoints.json';

const incidentsEndpoint = endpoints.incidents;

function startIncidentPatch({
    incidentPrefix = 'Incident',
    userId = '',
    teamId = '',
    playbookId = '',
    incidentDescription = ''}) {
        const randomSuffix = getRandomId();
        const request_payload = {
            name: `${incidentPrefix}-${randomSuffix}`,
            commander_user_id: userId,
            team_id: teamId,
            playbook_id: playbookId,
            description: incidentDescription,
        }
        return request_payload;
    }

/**
 * Start an incident directly via API.
 */
 Cypress.Commands.add('apiStartIncident', (...args) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: incidentsEndpoint,
        method: 'POST',
        body: startIncidentPatch(...args),
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({incident: response.body});
    });
});

/**
 * Start a test incident via API.
 */
Cypress.Commands.add('apiStartTestIncident', (
    teamId,
    userId,
    playbookId,
    incidentDesc,
) => (
    cy.apiStartIncident({
        teamId,
        userId,
        playbookId,
        incidentDesc,
    })
));
    