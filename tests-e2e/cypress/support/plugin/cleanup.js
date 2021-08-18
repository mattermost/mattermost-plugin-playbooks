// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
