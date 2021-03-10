// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../utils';
import endpoints from '../endpoints.json';

const incidentsEndpoint = endpoints.incidents;

function startIncidentPatch({
    incidentPrefix = 'Incident',
    userId = '',
    teamId = '',
    playbookId = ''}) {
        const randomSuffix = getRandomId();
        const request_payload = {
            incidentName: `${incidentPrefix}-${randomSuffix}`,
            commander_user_id: userId,
            team_id: teamId,
            playbook_id: playbookId
        }
        return request_payload;
    }

/**
 * Start an incident directly via API.
 */
Cypress.Commands.add('apiStartIncident', (
    incidentPrefix = 'Incident',
    userId = '',
    teamId = '',
    playbookId = ''
) => {
    const randomSuffix = getRandomId();
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: incidentsEndpoint,
        method: 'POST',
        body: {
            name: `${incidentPrefix}-${randomSuffix}`,
            commander_user_id: userId,
            team_id: teamId,
            playbook_id: playbookId
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({incident: response.body});
    });
});
