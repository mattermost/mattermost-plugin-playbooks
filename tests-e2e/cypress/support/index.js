// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import '@testing-library/cypress/add-commands';
import 'cypress-file-upload';
import 'cypress-wait-until';

import './plugin_api_commands';
import './server_api_commands';
import './ui_commands';
import './plugin_ui_commands';
import './api/preference';

require('cypress-terminal-report/src/installLogsCollector')();

// Add login cookies to whitelist to preserve it
beforeEach(() => {
    Cypress.Cookies.preserveOnce('MMAUTHTOKEN', 'MMUSERID', 'MMCSRF');
});

Cypress.Commands.add('requireIncidentResponsePlugin', (version) => {
    cy.apiGetWebappPlugins().then((response) => {
        const plugins = response.body;

        let isInstalled = false;
        for (const plugin of plugins) {
            if (plugin.id === 'com.mattermost.plugin-incident-response' && plugin.version === version) {
                isInstalled = true;
                break;
            }
        }

        expect(isInstalled, `Incident Response plugin should be installed with version ${version}`).to.equal(true);
    });
});

/**
 * Delete all incidents directly from API
 */
Cypress.Commands.add('deleteAllIncidents', (teamId) => {
    cy.apiGetAllIncidents(teamId).then((response) => {
        const incidents = JSON.parse(response.body);

        incidents.forEach((incident) => {
            cy.apiDeleteIncident(incident.id);
        });
    });
});
