// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > run details page > finish', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPlaybookRun;
    let testPublicPlaybook;

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
            playbookRunName: 'the run name(' + getRandomId() + ')',
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            testPlaybookRun = playbookRun;

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
        });
    });

    it('is hidden as viewer', () => {
        cy.apiLogin(testViewerUser).then(() => {
            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${testPlaybookRun.id}`);
        });

        // * Assert that finish section does not exist
        cy.findByTestId('run-finish-section').should('not.exist');
    });

    it('is visible', () => {
        // * Verify the finish section is present
        cy.findByTestId('run-finish-section').should('be.visible');
    });

    it('has a placeholder visible', () => {
        // * Verify the placeholder is present
        cy.findByTestId('run-finish-section').contains('Time to wrap up?');
    });

    describe('finish run', () => {
        it('can be confirmed', () => {
            // # Click finish run button
            cy.findByTestId('run-finish-section').findByRole('button', {name: /Finish/i}).click();

            // * Check that status badge is in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // * Check that finish run modal is open and has the right title
            cy.get('#confirmModal').should('be.visible');

            // Note: Title can be either "Confirm finish run" or "Confirm finish" depending on context
            cy.get('#confirmModal').find('h1').should('contain', 'Confirm finish');

            // # Click on confirm
            cy.get('#confirmModal').get('#confirmModalButton').click();

            // * Assert finish section is not visible anymore
            cy.findByTestId('run-finish-section').should('not.exist');

            // * Assert status badge is finished
            cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

            // * Verify run has been removed from LHS
            cy.findByTestId('lhs-navigation').findByText(testPlaybookRun.name).should('not.exist');
        });

        it('can be canceled', () => {
            // # Click on finish run
            cy.findByTestId('run-finish-section').findByRole('button', {name: /Finish/i}).click();

            // * Check that status badge is in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // * Check that finish run modal is open
            cy.get('#confirmModal').should('be.visible');

            // Note: Title can be either "Confirm finish run" or "Confirm finish" depending on context
            cy.get('#confirmModal').find('h1').should('contain', 'Confirm finish');

            // # Click on cancel
            cy.get('#confirmModal').get('#cancelModalButton').click();

            // * Check that status badge is still in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // * Check that section is still visible
            cy.findByTestId('run-finish-section').should('be.visible');
        });
    });

    describe('finish run with owner_group_only_actions enabled', () => {
        let restrictedRun;

        beforeEach(() => {
            // # Create a playbook with owner_group_only_actions enabled
            cy.apiLogin(testUser);
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Owner Only Finish Playbook',
                memberIDs: [],
            }).then((playbook) => {
                cy.apiPatchPlaybook(playbook.id, {owner_group_only_actions: true});

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Owner Only Finish Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    restrictedRun = playbookRun;

                    // # Add viewer as a participant
                    cy.apiAddUsersToRun(playbookRun.id, [testViewerUser.id]);
                });
            });
        });

        it('hides finish section from non-owner participant on RDP', () => {
            // # Login as the non-owner participant
            cy.apiLogin(testViewerUser);

            // # Visit the run details page
            cy.visit(`/playbooks/runs/${restrictedRun.id}`);

            // * Assert that finish section does not exist for non-owner participant
            cy.findByTestId('run-finish-section').should('not.exist');
        });

        it('shows finish section to the owner on RDP', () => {
            // # Visit the run details page as the owner
            cy.visit(`/playbooks/runs/${restrictedRun.id}`);

            // * Assert that finish section exists for the owner
            cy.findByTestId('run-finish-section').should('be.visible');
        });

        it('owner can finish and API confirms state change', () => {
            // # Visit the run details page as the owner
            cy.visit(`/playbooks/runs/${restrictedRun.id}`);

            // # Click finish run button
            cy.findByTestId('run-finish-section').findByRole('button', {name: /Finish/i}).click();

            // # Confirm the finish modal
            cy.get('#confirmModal').should('be.visible');
            cy.get('#confirmModal').get('#confirmModalButton').click();

            // * Assert status badge is finished
            cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

            // * Verify via API that the run is actually finished
            cy.apiGetPlaybookRun(restrictedRun.id).then(({body: run}) => {
                expect(run.current_status).to.equal('Finished');
                expect(run.end_at).to.be.greaterThan(0);
            });
        });
    });
});
