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

    it('can be edited and published to run channel', () => {
        // # Navigate directly to the retro tab
        cy.visit(`/playbooks/runs/${runId}/retrospective`);

        // # Start editing
        cy.findByText('Edit').click();

        // * Verify the provided template text is pre-filled
        cy.focused().should('include.text', 'This is a retrospective template.');

        // # Change the retro text, save it, and publish
        cy.focused().clear().type('Edited retrospective.');
        cy.findByText('Save').click();
        cy.findByText('Publish').click({force: true});

        // # Switch to the run channel
        cy.findByText('Go to channel').click();

        // * Verify the modified retro text is posted
        cy.verifyPostedMessage('Edited retrospective.');
    });
});
