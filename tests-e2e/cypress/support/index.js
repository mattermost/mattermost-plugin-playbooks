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
import './test_commands';

import fixtureUsers from '../fixtures/users';

require('cypress-terminal-report/src/installLogsCollector')();

before(() => {
    // Disable the tutorial, cloud onboarding, and whats new modal for specific users.
    const userNames = Object.values(fixtureUsers).map((user) => user.username);

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

Cypress.Commands.add('requireIncidentCollaborationPlugin', (version) => {
    cy.apiGetWebappPlugins().then((response) => {
        const plugins = response.body;

        let isInstalled = false;
        for (const plugin of plugins) {
            if (plugin.id === 'com.mattermost.plugin-incident-management' && plugin.version === version) {
                isInstalled = true;
                break;
            }
        }

        expect(isInstalled, `Incident Collaboration plugin should be installed with version ${version}`).to.equal(true);
    });
});

/**
 * End all active playbook runs directly from API with sysadmin. Need to login after this.
 */
Cypress.Commands.add('endAllActivePlaybookRuns', (teamId) => {
    cy.apiLogin('sysadmin');
    cy.apiGetCurrentUser().then((user) => {
        cy.apiGetAllActivePlaybookRuns(teamId).then((response) => {
            const playbookRuns = response.body.items;

            playbookRuns.forEach((playbookRun) => {
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId: user.id,
                    teamId,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });
        });

        cy.apiGetAllReportedPlaybookRuns(teamId).then((response) => {
            const playbookRuns = response.body.items;

            playbookRuns.forEach((playbookRun) => {
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId: user.id,
                    teamId,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });
        });

        cy.apiGetAllActivePlaybookRuns(teamId).then((response) => {
            const playbookRuns = response.body.items;
            expect(playbookRuns.length).to.equal(0);
        });

        cy.apiGetAllReportedPlaybookRuns(teamId).then((response) => {
            const playbookRuns = response.body.items;
            expect(playbookRuns.length).to.equal(0);
        });

        cy.apiLogout();
    });
});

/**
 * End all active playbook runs directly from API with current user.
 */
Cypress.Commands.add('endAllMyActivePlaybookRuns', (teamId) => {
    cy.apiGetCurrentUser().then((user) => {
        cy.apiGetAllActivePlaybookRuns(teamId, user.id).then((response) => {
            const playbookRuns = response.body.items;

            playbookRuns.forEach((playbookRun) => {
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId: user.id,
                    teamId,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });
        });

        cy.apiGetAllReportedPlaybookRuns(teamId, user.id).then((response) => {
            const playbookRuns = response.body.items;

            playbookRuns.forEach((playbookRun) => {
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId: user.id,
                    teamId,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });
        });
    });
});
