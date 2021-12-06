// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************
import {stubClipboard} from '../../utils';

describe('runs > details', () => {
    let testTeam;
    let testUser;
    let testPublicPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

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
    });

    it('redirects to not found error if the playbook run is unknown', () => {
        // # Visit the URL of a non-existing playbook run
        cy.visit('/playbooks/runs/an_unknown_id');

        // * Verify that the user has been redirected to the playbook runs not found error page
        cy.url().should('include', '/playbooks/error?type=playbook_runs');
    });

    describe('updates', () => {
        const message = 'This is a status update';
        let playbookRunId;
        beforeEach(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'visible user icons',
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    message,
                });
                playbookRunId = playbookRun.id;

                // # Visit the playbook run
                cy.visit(`/playbooks/runs/${playbookRun.id}`);
            });
        });

        it('should shows user icons', () => {
            // * Verify the status update is present
            cy.findByTestId('updates').contains(message);

            // * Verify the playbook user and icon is visible
            cy.findByTestId('updates').find('img').should('be.visible').and(($img) => {
                // https://stackoverflow.com/questions/51246606/test-loading-of-image-in-cypress
                expect($img[0].naturalWidth).to.be.greaterThan(0);
            });
        });

        it('links back to original post in channel', () => {
            cy.findByTestId('updates').within(() => {
                // # Click status post permalink
                cy.get('[class^="UpdateTimeLink"]').click();
            });

            // * Verify post message
            cy.get('.post').contains(message);
        });

        it('should copy run link', () => {
            // # trigger the tooltip
            cy.get('.icon-link-variant').trigger('mouseover');

            // * Verify tooltip text
            cy.get('#copy-run-link-tooltip').should('contain', 'Copy link to run');

            stubClipboard().as('clipboard');

            // # click on copy button
            cy.get('.icon-link-variant').click().then(() => {
                // * Verify that tooltip text changed
                cy.get('#copy-run-link-tooltip').should('contain', 'Copied!');

                // * Verify clipboard content
                cy.get('@clipboard').its('contents').should('contain', `/playbooks/runs/${playbookRunId}`);
            });
        });
    });

    describe('status updates disabled', () => {
        let playbookRun;

        before(() => {
            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                statusUpdateEnabled: false,
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            }).then((playbook) => {
                // # Create a new playbook run
                const now = Date.now();
                const name = 'Playbook Run (' + now + ')';
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: name,
                    ownerUserId: testUser.id,
                });
            }).then((run) => {
                playbookRun = run
            })
        });


        it('should show that status updates were disabled', () => {
            // # Visit the playbook run preview
            cy.visit(`/playbooks/runs/${playbookRun.id}/overview`);

            // * Verify the status update msg is correct
            cy.get('#status-update-msg').contains('Status updates were disabled for this playbook run.');
        });
    });
});
