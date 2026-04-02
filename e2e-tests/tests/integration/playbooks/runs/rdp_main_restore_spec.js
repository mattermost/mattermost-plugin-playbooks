// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > run details page > restart run', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;

    // const taskIndex = 0;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create another user in the same team
            cy.apiCreateUser().then(({user: viewer}) => {
                testViewerUser = viewer;
                cy.apiAddUserToTeam(testTeam.id, testViewerUser.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
                checklists: [
                    {
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                    {
                        title: 'Stage 2',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                ],
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName: 'the run name',
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            testRun = playbookRun;

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${testRun.id}`);
        });
    });

    describe('restart run', () => {
        it('can be confirmed', () => {
            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${testRun.id}/finish`).as('routeFinish');
            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${testRun.id}/restore`).as('routeRestore');

            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // # Click finish run button
            cy.findByTestId('run-finish-section').findByRole('button', {name: /Finish/i}).click();
            cy.get('#confirmModal').get('#confirmModalButton').click();

            cy.wait('@routeFinish');
            cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

            cy.findByTestId('runDropdown').click();
            cy.get('.restartRun').find('span').contains('Restart');

            cy.get('.restartRun').click();
            cy.get('#confirmModal').get('#confirmModalButton').click();
            cy.wait('@routeRestore');
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');
            cy.findByTestId('lhs-navigation').findByText(testRun.name).should('exist');
        },
        );
    });

    describe('restart run with owner_group_only_actions enabled', () => {
        let restrictedRun;

        beforeEach(() => {
            // # Create a playbook with owner_group_only_actions enabled
            cy.apiLogin(testUser);
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Owner Only Restart Playbook',
                memberIDs: [],
                checklists: [
                    {
                        title: 'Stage 1',
                        items: [{title: 'Step 1'}],
                    },
                ],
            }).then((playbook) => {
                cy.apiPatchPlaybook(playbook.id, {owner_group_only_actions: true});

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Owner Only Restart Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    restrictedRun = playbookRun;

                    // # Add viewer as a participant
                    cy.apiAddUsersToRun(playbookRun.id, [testViewerUser.id]);

                    // # Finish the run so we can test restore
                    cy.apiFinishRun(playbookRun.id);
                });
            });
        });

        it('non-owner participant cannot use Restart option on RDP', () => {
            // # Login as non-owner participant
            cy.apiLogin(testViewerUser);

            // # Visit the finished run details page
            cy.visit(`/playbooks/runs/${restrictedRun.id}`);

            // # Open the run dropdown
            cy.findByTestId('runDropdown').click();

            // * Assert Restart option is present but disabled (rendered as a div, not a link)
            cy.get('.restartRun').should('exist');
            cy.get('.restartRun').should('not.have.attr', 'href');

            // * Verify via API that the run is still Finished (server-side guard is intact)
            cy.apiGetPlaybookRun(restrictedRun.id).then(({body: run}) => {
                expect(run.current_status).to.equal('Finished');
                expect(run.end_at).to.be.greaterThan(0);
            });
        });

        it('owner can see and use Restart option on RDP', () => {
            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${restrictedRun.id}/restore`).as('routeRestore');

            // # Visit the finished run details page as owner
            cy.visit(`/playbooks/runs/${restrictedRun.id}`);

            // * Verify run is finished
            cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

            // # Open the run dropdown and click Restart
            cy.findByTestId('runDropdown').click();
            cy.get('.restartRun').click();
            cy.get('#confirmModal').get('#confirmModalButton').click();
            cy.wait('@routeRestore');

            // * Assert run is back to In Progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // * Verify via API that the run was restored
            cy.apiGetPlaybookRun(restrictedRun.id).then(({body: run}) => {
                expect(run.current_status).to.equal('InProgress');
                expect(run.end_at).to.equal(0);
            });
        });
    });
});
