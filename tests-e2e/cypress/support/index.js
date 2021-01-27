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
 * DEBUGGING
 */
function incidentCurrentStatusPost(incident) {
    const sortedPosts = [...incident.status_posts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);

    return sortedPosts[0];
}

function incidentCurrentStatus(incident) {
    let status = 'Reported';

    const currentPost = incidentCurrentStatusPost(incident);

    if (currentPost) {
        if (currentPost.status === '') {
            // Backwards compatibility with existing incidents.
            status = 'Active';
        } else {
            status = currentPost.status;
        }
    }

    return status;
}

Cypress.Commands.add('debugAllIncidents', (teamId, userId = '') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/plugins/com.mattermost.plugin-incident-management/api/v0/incidents?team_id=${teamId}`,
        //qs: {team_id: teamId, member_id: userId},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        const incidents = JSON.parse(response.body).items;
        cy.log('debugAllIncidents');
        cy.log('# of incidents: ', incidents.length);
        cy.log('incidents statuses: ', incidents.map((i) => incidentCurrentStatus(i)).toString());
        incidents.forEach((i) => {
            delete i.checklists;
            cy.log(JSON.stringify(i));
        });
    });
});

Cypress.Commands.add('debugReportedIncidents', (teamId, userId = '') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/plugins/com.mattermost.plugin-incident-management/api/v0/incidents?team_id=${teamId}&status=Reported`,
        //qs: {team_id: teamId, status: 'Reported', member_id: userId},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        const incidents = JSON.parse(response.body).items;
        cy.log('debugReportedIncidents');
        cy.log('# of incidents: ', incidents.length);
        cy.log('incidents statuses: ', incidents.map((i) => incidentCurrentStatus(i)).toString());
        incidents.forEach((i) => {
            delete i.checklists;
            cy.log('id: ' + i.id + ' status_posts: ' + JSON.stringify(i.status_posts));
        });
    });
});

Cypress.Commands.add('debugActiveIncidents', (teamId, userId = '') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/plugins/com.mattermost.plugin-incident-management/api/v0/incidents?team_id=${teamId}&status=Active`,
        //qs: {team_id: teamId, status: 'Active', member_id: userId},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        const incidents = JSON.parse(response.body).items;
        cy.log('debugActiveIncidents');
        cy.log('# of incidents: ', incidents.length);
        cy.log('incidents statuses: ', incidents.map((i) => incidentCurrentStatus(i)).toString());
        incidents.forEach((i) => {
            delete i.checklists;
            cy.log('id: ' + i.id + ' status_posts: ' + JSON.stringify(i.status_posts));
        });
    });
});

Cypress.Commands.add('debugResolvedIncidents', (teamId, userId = '') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/plugins/com.mattermost.plugin-incident-management/api/v0/incidents?team_id=${teamId}&status=Resolved`,
        //qs: {team_id: teamId, status: 'Resolved', member_id: userId},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        const incidents = JSON.parse(response.body).items;
        cy.log('debugResolvedIncidents');
        cy.log('# of incidents: ', incidents.length);
        cy.log('incidents statuses: ', incidents.map((i) => incidentCurrentStatus(i)).toString());
        incidents.forEach((i) => {
            delete i.checklists;
            cy.log('id: ' + i.id + ' status_posts: ' + JSON.stringify(i.status_posts));
        });
    });
});

Cypress.Commands.add('debugArchivedIncidents', (teamId, userId = '') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/plugins/com.mattermost.plugin-incident-management/api/v0/incidents?team_id=${teamId}&status=Archived`,
        //qs: {team_id: teamId, status: 'Archived', member_id: userId},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        const incidents = JSON.parse(response.body).items;
        cy.log('debugArchivedIncidents');
        cy.log('# of incidents: ', incidents.length);
        cy.log('incidents statuses: ', incidents.map((i) => incidentCurrentStatus(i)).toString());
        incidents.forEach((i) => {
            delete i.checklists;
            cy.log('id: ' + i.id + ' status_posts: ' + JSON.stringify(i.status_posts));
        });
    });
});

/**
 * End all active incidents directly from API with sysadmin. Need to login after this.
 */
Cypress.Commands.add('endAllActiveIncidents', (teamId) => {
    cy.apiLogin('sysadmin');
    cy.apiGetCurrentUser().then((user) => {
        cy.log('sysadmin getting all Active incidents to set to Resolved');
        cy.apiGetAllActiveIncidents(teamId).then((response) => {
            const incidents = JSON.parse(response.body).items;

            incidents.forEach((incident) => {
                cy.apiUpdateStatus({
                    incidentId: incident.id,
                    userId: user.id,
                    teamId,
                    status: 'Resolved',
                });
            });
        });

        cy.log('sysadmin getting all Reported incidents to set to Resolved');
        cy.apiGetAllReportedIncidents(teamId).then((response) => {
            const incidents = JSON.parse(response.body).items;

            incidents.forEach((incident) => {
                cy.apiUpdateStatus({
                    incidentId: incident.id,
                    userId: user.id,
                    teamId,
                    status: 'Resolved',
                });
            });
        });

        cy.apiGetAllActiveIncidents(teamId).then((response) => {
            const incidents = JSON.parse(response.body).items;
            expect(incidents.length).to.equal(0);
        });

        cy.apiGetAllReportedIncidents(teamId).then((response) => {
            const incidents = JSON.parse(response.body).items;
            expect(incidents.length).to.equal(0);
        });

        cy.apiLogout();
    });
});



/**
 * End all active incidents directly from API with current user.
 */
Cypress.Commands.add('endAllMyActiveIncidents', (teamId) => {
    cy.apiGetCurrentUser().then((user) => {
        cy.apiGetAllActiveIncidents(teamId, user.id).then((response) => {
            const incidents = JSON.parse(response.body).items;

            incidents.forEach((incident) => {
                cy.apiUpdateStatus({
                    incidentId: incident.id,
                    userId: user.id,
                    teamId,
                    status: 'Resolved',
                });
            });
        });

        cy.apiGetAllReportedIncidents(teamId, user.id).then((response) => {
            const incidents = JSON.parse(response.body).items;

            incidents.forEach((incident) => {
                cy.apiUpdateStatus({
                    incidentId: incident.id,
                    userId: user.id,
                    teamId,
                    status: 'Resolved',
                });
            });
        });
    });
});
