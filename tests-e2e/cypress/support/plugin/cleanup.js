// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * End all InProgress playbook runs directly from API with sysadmin. Need to login after this.
 */
Cypress.Commands.add('endAllInProgressPlaybookRuns', (teamId) => {
    cy.apiLogin('sysadmin');
    cy.apiGetCurrentUser().then(() => {
        cy.apiGetAllInProgressPlaybookRuns(teamId).then((response) => {
            const playbookRuns = response.body.items;

            playbookRuns.forEach((playbookRun) => {
                cy.apiFinishRun(playbookRun.id);
            });
        });

        cy.apiGetAllInProgressPlaybookRuns(teamId).then((response) => {
            const playbookRuns = response.body.items;
            expect(playbookRuns.length).to.equal(0);
        });

        cy.apiLogout();
    });
});

/**
 * End all InProgress playbook runs directly from API with current user.
 */
Cypress.Commands.add('endAllMyInProgressPlaybookRuns', (teamId) => {
    cy.apiGetCurrentUser().then((user) => {
        cy.apiGetAllInProgressPlaybookRuns(teamId, user.id).then((response) => {
            const playbookRuns = response.body.items;

            playbookRuns.forEach((playbookRun) => {
                cy.apiFinishRun(playbookRun.id);
            });
        });
    });
});
