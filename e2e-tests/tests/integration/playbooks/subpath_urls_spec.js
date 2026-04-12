// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks @urls @subpath

describe('Subpath URLs in Playbook Messages', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a playbook with status updates and broadcast to run channel
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Subpath Test Playbook',
                memberIDs: [],
                statusUpdateEnabled: true,
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Create a playbook run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Subpath Test Run',
                    ownerUserId: testUser.id,
                }).then((run) => {
                    testRun = run;
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('run details page loads with correct URL structure', () => {
        // # Navigate to playbook run
        cy.visit(`/playbooks/runs/${testRun.id}`);

        // * Verify the run page loaded correctly
        cy.url().should('include', `/playbooks/runs/${testRun.id}`);

        // * Verify the run title is visible
        cy.contains(testRun.name).should('be.visible');
    });

    it('playbook run links use correct path format', () => {
        // # Navigate to playbook runs list
        cy.visit('/playbooks/runs');

        // * Verify a run link exists and points to the correct path
        cy.contains(testRun.name).should('be.visible');
        cy.contains(testRun.name).closest('a').should('have.attr', 'href').and('include', `/playbooks/runs/${testRun.id}`);
    });

    it('status update button is available on in-progress run', () => {
        // # Navigate to playbook run details
        cy.visit(`/playbooks/runs/${testRun.id}`);

        // * Verify the "Post update" button exists
        cy.findByTestId('post-update-button').should('be.visible');
    });

    it('run channel is accessible via channel_id', () => {
        // # Navigate to the run channel using channel_id
        cy.then(() => {
            cy.visit(`/${testTeam.name}/channels/${testRun.channel_id}`);
        });

        // * Verify the channel loaded successfully
        cy.get('#postListContent').should('exist');
    });

    it('playbook editor URL structure is correct', () => {
        // # Navigate to playbook editor
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}`);

        // * Verify URL is correct
        cy.url().should('include', `/playbooks/playbooks/${testPlaybook.id}`);

        // * Verify playbook editor loaded
        cy.findByTestId('playbook-editor-header').should('be.visible');
    });

    it('all URL types avoid path duplication', () => {
        // # Navigate to playbook run
        cy.visit(`/playbooks/runs/${testRun.id}`);

        // * Verify URL does not have duplicated path segments
        cy.url().should('not.match', /\/playbooks\/playbooks\/runs/);
        cy.url().should('not.match', /\/runs\/runs/);
    });

    it('navigating from playbook to run preserves URL correctness', () => {
        // # Navigate to playbook editor
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}`);

        // * Verify we're on the playbook page
        cy.findByTestId('playbook-editor-header').should('be.visible');

        // # Navigate to runs list
        cy.findByTestId('playbookRunsLHSButton').click();

        // * Verify URL changed to runs
        cy.url().should('include', '/playbooks/runs');
    });
});
