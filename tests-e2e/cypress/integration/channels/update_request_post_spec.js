// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('channels > run dialog', () => {
    let testTeam;
    let testUser;
    let testPlaybookRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Enable threads view
            cy.apiSaveCRTPreference(testUser.id, 'on');

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Test Run',
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    testPlaybookRun = playbookRun;
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('displays interactive post', () => {
        it('in the run channel', () => {
            // # Navigate to the application
            cy.visit(`${testTeam.name}/channels/test-run`);

            // # Post a status update, with a reminder in 1 second.
            cy.apiUpdateStatus({
                playbookRunId: testPlaybookRun.id,
                message: 'status update',
                reminder: 1,
            });

            // Ensure the status update reminder gets posted
            cy.wait(TIMEOUTS.TWO_SEC);

            cy.getLastPost().then((element) => {
                // # Verify the expected message text
                cy.get(element).contains(`@${testUser.username}, please provide a status update for ${testPlaybookRun.name}.`);

                // # Verify interactive message button to post an update
                cy.get(element).find('button').contains('Post update');
            });
        });

        it('in threads view', {retries: {runMode: 3}}, () => {
            // # Navigate to the application
            cy.visit(`${testTeam.name}/channels/test-run`);

            // # Post a status update, with a reminder in 1 second.
            cy.apiUpdateStatus({
                playbookRunId: testPlaybookRun.id,
                message: 'status update',
                reminder: 1,
            });

            // Ensure the status update reminder gets posted
            cy.wait(TIMEOUTS.TWO_SEC);

            // # Find the update request post and post a reply to make it show up in threads view
            cy.getLastPostId().then((lastPostId) => {
                // Open RHS
                cy.clickPostCommentIcon(lastPostId);

                // Post a reply message
                cy.postMessageReplyInRHS('test reply');

                // # Navigate to the threads view
                cy.get('#sidebarItem_threads').click();

                // # Verify the expected text in the list view
                cy.get('.ThreadItem').first().contains(`@${testUser.username}, please provide a status update for ${testPlaybookRun.name}.`);

                // # Click to open details
                cy.get('.ThreadItem').first().click();

                // # Verify post still rendered
                cy.get(`#rhsPost_${lastPostId}`).contains(`@${testUser.username}, please provide a status update for ${testPlaybookRun.name}.`);

                // # Verify interactive message button to post an update
                cy.get(`#rhsPost_${lastPostId}`).find('button').contains('Post update');
            });
        });
    });
});
