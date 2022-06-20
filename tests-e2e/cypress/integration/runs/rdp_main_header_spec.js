// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************
import {stubClipboard} from '../../utils';

describe('runs > run details page > header', () => {
    let testTeam;
    let testUser;
    let testPublicPlaybook;
    let playbookRun;

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

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName: 'the run name',
            ownerUserId: testUser.id,
        }).then((run) => {
            playbookRun = run;

            // # Visit the playbook run
            cy.visit(`/playbooks/run_details/${playbookRun.id}`);
        });
    });

    describe('title and icons', () => {
        it('shows the title', () => {
            // * assert title is shown in h1 inside header
            cy.findByTestId('run-header-section').find('h1').contains(playbookRun.name);
        });

        it('show link icon', () => {
            // # Mouseover on the icon
            cy.findByTestId('run-header-section').find('.icon-link-variant').trigger('mouseover');

            // * Assert tooltip is shown
            cy.get('#copy-run-link-tooltip').should('contain', 'Copy link to run');

            stubClipboard().as('clipboard');
            cy.findByTestId('run-header-section').within(() => {
                // # click on copy button
                cy.get('.icon-link-variant').click().then(() => {
                    // * Verify clipboard content
                    cy.get('@clipboard').its('contents').should('contain', `/playbooks/run_details/${playbookRun.id}`);
                });
            });

            // * Verify that tooltip text changed
            cy.get('#copy-run-link-tooltip').should('contain', 'Copied!');
        });

        // it('links back to original post in channel', () => {
        //     cy.findByTestId('updates').within(() => {
        //         // # Click status post permalink
        //         cy.get('[class^="UpdateTimeLink"]').click();
        //     });

        //     // * Verify post message
        //     cy.get('.post').contains(message);
        // });

        // it('should copy run link', () => {
        //     // # trigger the tooltip
        //     cy.get('.icon-link-variant').trigger('mouseover');

        //     // * Verify tooltip text
        //     cy.get('#copy-run-link-tooltip').should('contain', 'Copy link to run');

        //     stubClipboard().as('clipboard');

        //     // # click on copy button
        //     cy.get('.icon-link-variant').click().then(() => {
        //         // * Verify that tooltip text changed
        //         cy.get('#copy-run-link-tooltip').should('contain', 'Copied!');

        //         // * Verify clipboard content
        //         cy.get('@clipboard').its('contents').should('contain', `/playbooks/run_details/${playbookRunId}`);
        //     });
        // });
    });
});
