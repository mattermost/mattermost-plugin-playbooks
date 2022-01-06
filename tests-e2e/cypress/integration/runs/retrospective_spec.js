// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('runs > retrospective', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let testTeam;
    let testUser;
    let testPublicPlaybook;
    let runId;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: playbookName,
                memberIDs: [],
                retrospectiveTemplate: 'This is a retrospective template.',
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Create a new playbook run
        const now = Date.now();
        const runName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName: runName,
            ownerUserId: testUser.id,
        }).then((run) => {
            runId = run.id;
        });
    });

    it('publishing posts to run channel', () => {
        editAndPublishRetro(runId);

        // # Switch to the run channel
        cy.findByText('Go to channel').click();

        // * Verify the modified retro text is posted
        cy.verifyPostedMessage('Edited retrospective.');
    });

    it('prevents repeated publishing', () => {
        editAndPublishRetro(runId);

        // * Verify that can't publish
        cy.findByText('Publish').should('not.be.enabled');

        // # Navigate to the overview tab
        cy.findByText('Overview').click();

        // # Navigate directly to the retro tab
        cy.findByText('Retrospective').click();

        // * Verify that can't publish
        cy.findByText('Publish').should('not.be.enabled');
    });
});

const editAndPublishRetro = (runId) => {
    // # Navigate directly to the retro tab
    cy.visit(`/playbooks/runs/${runId}/retrospective`);

    // # Start editing
    cy.findByTestId('retro-report-text').click();

    // * Verify the provided template text is pre-filled
    cy.focused().should('include.text', 'This is a retrospective template.');

    // # Change the retro text
    cy.focused().clear().type('Edited retrospective.');

    // # Save it by clicking outside the text area
    cy.findByText('Report').click();

    // # Publish
    cy.findByRole('button', {name: 'Publish'}).click();

    // * Verify we're showing the publish retro confirmation modal
    cy.get('#confirm-modal-light').contains('Are you sure you want to publish');

    // # Publish
    cy.findByRole('button', {name: 'Publish'}).click();

    // * Verify that retro got published
    cy.get('.icon-check-all').should('be.visible');
};
