// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('admin console > site statistics', () => {
    let testUser;
    let testTeam;
    let testPlaybook;
    let testSysadmin;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
            cy.apiCreateCustomAdmin().then(({sysadmin}) => {
                testSysadmin = sysadmin;
            });
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    describe('site statistics', () => {
        it('playbooks and runs counters are visible', () => {
            cy.apiLogin(testSysadmin);

            // # Go to admin console > site statistics
            cy.visit('/admin_console/reporting/system_analytics');
            cy.findByTestId('playbooks.playbook_count').should('exist');
            cy.findByTestId('playbooks.playbook_run_count').should('exist');
        });

        it('playbook counter increases after creating a playbook', () => {
            cy.apiLogin(testSysadmin);
            let counter;

            // # Go to admin console > site statistics
            cy.visit('/admin_console/reporting/system_analytics');

            // # Capture current value of playbook counter
            cy.findByTestId('playbooks.playbook_count').invoke('prop', 'innerText').then((pbCount) => {
                counter = parseInt(pbCount, 10);
                cy.apiLogin(testUser);

                // # Create a playbook
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Playbook',
                    memberIDs: [],
                }).then(() => {
                    cy.apiLogin(testSysadmin);

                    // # Go to admin console > site statistics
                    cy.visit('/admin_console/reporting/system_analytics');

                    // * Verify that the Playbook Counter has been increased by 1
                    cy.findByTestId('playbooks.playbook_count').contains(String(counter + 1));
                });
            });
        });

        it('run counter increases after creating a run', () => {
            cy.apiLogin(testSysadmin);
            let counter;

            // # Go to admin console > site statistics
            cy.visit('/admin_console/reporting/system_analytics');

            // # Capture current value of run counter
            cy.findByTestId('playbooks.playbook_run_count').invoke('prop', 'innerText').then((runCount) => {
                counter = parseInt(runCount, 10);
                cy.apiLogin(testUser);

                // # create a run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'My run for test',
                    ownerUserId: testUser.id,
                }).then(() => {
                    cy.apiLogin(testSysadmin);

                    // # Go to admin console > site statistics
                    cy.visit('/admin_console/reporting/system_analytics');

                    // * Verify that the Run Counter has been increased by 1
                    cy.findByTestId('playbooks.playbook_run_count').contains(String(counter + 1));
                });
            });
        });
    });
});