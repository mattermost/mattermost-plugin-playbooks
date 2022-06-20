// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************
import {stubClipboard} from '../../utils';

describe('runs > run details page', () => {
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

    // UnSkip after giorgi's merge
    it.skip('redirects to not found error if the playbook run is unknown', () => {
        // # Visit the URL of a non-existing playbook run
        cy.visit('/playbooks/run_details/an_unknown_id');

        // * Verify that the user has been redirected to the playbook runs not found error page
        cy.url().should('include', '/playbooks/error?type=playbook_runs');
    });

    describe('summary', () => {
        // let playbookRunId;
        beforeEach(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'the run name',
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # Visit the playbook run
                cy.visit(`/playbooks/run_details/${playbookRun.id}`);
            });
        });

        it('is visible', () => {
            // * Verify the summary section is present
            cy.findByTestId('run-summary-section').should('be.visible');
        });

        it('has title', () => {
            // * Verify the summary section is present
            cy.findByTestId('run-summary-section').find('h3').contains('Summay');
        });

        it('has a placeholder', () => {
            // * Assert the placeholder content
            cy.findByTestId('run-summary-section').within(() => {
                cy.findByTestId('rendered-text').contains('Add a run summary');
            });
        });

        it('can be edited', () => {
            // * Mouseover the summary
            cy.findByTestId('run-summary-section').trigger('mouseover');

            cy.findByTestId('run-summary-section').within(() => {
                // * Click the edit icon
                cy.findByTestId('hover-menu-edit-button').click();

                // * Write a summary
                cy.findByTestId('editabletext-markdown-textbox1').clear().type('This is my new summary');

                // * Save changes
                cy.findByTestId('checklist-item-save-button').click();

                // * Assert that data has changed
                cy.findByTestId('rendered-text').contains('This is my new summary');
            });

            // * Assert last edition date is visible
            cy.findByTestId('run-summary-section').contains('Last edited');
        });

        it('can be canceled', () => {
            // * Mouseover the summary
            cy.findByTestId('run-summary-section').trigger('mouseover');

            cy.findByTestId('run-summary-section').within(() => {
                // * Click the edit icon
                cy.findByTestId('hover-menu-edit-button').click();

                // * Write a summary
                cy.findByTestId('editabletext-markdown-textbox1').clear().type('This is my new summary');

                // * Cancel changes
                cy.findByText('Cancel').click();

                // * Assert that data has changed
                cy.findByTestId('rendered-text').contains('Add a run summary');
            });

            // * Assert last edition date is visible
            cy.findByTestId('run-summary-section').should('not.contain', 'Last edited');
        });
    });

    describe.only('checklist', () => {
        // let playbookRunId;
        beforeEach(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'the run name',
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # Visit the playbook run
                cy.visit(`/playbooks/run_details/${playbookRun.id}`);
            });
        });

        it('is visible', () => {
            // * Verify the summary section is present
            cy.findByTestId('run-checklist-section').should('be.visible');
        });

        it('has title', () => {
            // * Verify the summary section is present
            cy.findByTestId('run-checklist-section').find('h3').contains('Tasks');
        });
    });

    describe('status update', () => {
        const message = 'This is a status update';
        let playbookRunId;
        beforeEach(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'the run name',
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    message,
                });
                playbookRunId = playbookRun.id;

                // # Visit the playbook run
                cy.visit(`/playbooks/run_details/${playbookRun.id}`);
            });
        });

        // it('should shows user icons', () => {
        //     // * Verify the status update is present
        //     cy.findByTestId('updates').contains(message);

        //     // * Verify the playbook user and icon is visible
        //     cy.findByTestId('updates').find('img').should('be.visible').and(($img) => {
        //         // https://stackoverflow.com/questions/51246606/test-loading-of-image-in-cypress
        //         expect($img[0].naturalWidth).to.be.greaterThan(0);
        //     });
        // });

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

    describe.skip('status updates disabled', () => {
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
                playbookRun = run;
            });
        });

        it('should show that status updates were disabled', () => {
            // # Visit the playbook run preview
            cy.visit(`/playbooks/runs/${playbookRun.id}/overview`);

            // * Verify the status update msg is correct
            cy.get('#status-update-msg').contains('Status updates were disabled for this playbook run.');
        });
    });

    describe.skip('retrospective disabled', () => {
        let playbookRun;

        before(() => {
            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                retrospectiveEnabled: false,
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
                playbookRun = run;
            });
        });

        it('should show the retrospectives were disabled message', () => {
            // # Visit the playbook run preview
            cy.visit(`/playbooks/runs/${playbookRun.id}/overview`);

            // # Switch to Retrospective tab
            cy.get('#root').findByText('Retrospective').click();

            // * Verify the status message is correct
            cy.get('#retrospective-disabled-msg').should('exist');
        });
    });
});
