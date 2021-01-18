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
import './api/user';

require('cypress-terminal-report/src/installLogsCollector')();

before(() => {
    // Disable the tutorial, cloud onboarding, and whats new modal for specific users.
    const userNames = ['sysadmin', 'user-1', 'user-2'];

    cy.apiAdminLogin().then(() => {
        cy.apiGetUsersByUsernames(userNames).then(({users}) => users.forEach((user) => {
            cy.apiSaveTutorialStep(user.id, '999');
            cy.apiSaveCloudOnboardingPreference(user.id, 'hide', 'true');
            cy.apiHideSidebarWhatsNewModalPreference(user.id, 'true');
        }));
    });
});

// Add login cookies to whitelist to preserve it
beforeEach(() => {
    Cypress.Cookies.preserveOnce('MMAUTHTOKEN', 'MMUSERID', 'MMCSRF');
});

Cypress.Commands.add('requireIncidentManagementPlugin', (version) => {
    cy.apiGetWebappPlugins().then((response) => {
        const plugins = response.body;

        let isInstalled = false;
        for (const plugin of plugins) {
            if (plugin.id === 'com.mattermost.plugin-incident-management' && plugin.version === version) {
                isInstalled = true;
                break;
            }
        }

        expect(isInstalled, `Incident Management plugin should be installed with version ${version}`).to.equal(true);
    });
});

/**
 * End all active incidents directly from API with sysadmin. Need to login after this.
 */
Cypress.Commands.add('endAllActiveIncidents', (teamId) => {
    cy.apiLogin('sysadmin');

    cy.apiGetAllActiveIncidents(teamId).then((response) => {
        const incidents = JSON.parse(response.body).items;

        incidents.forEach((incident) => {
            cy.apiEndIncident(incident.id);
        });
    });

    cy.apiGetAllReportedIncidents(teamId).then((response) => {
        const incidents = JSON.parse(response.body).items;

        incidents.forEach((incident) => {
            cy.apiEndIncident(incident.id);
        });
    });

    cy.apiLogout();
});

/**
 * End all active incidents directly from API with current user.
 */
Cypress.Commands.add('endAllMyActiveIncidents', (teamId) => {
    cy.apiGetAllActiveIncidents(teamId).then((response) => {
        const incidents = JSON.parse(response.body).items;

        incidents.forEach((incident) => {
            cy.apiEndIncident(incident.id);
        });
    });
});
