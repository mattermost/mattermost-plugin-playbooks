// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbooks > feedback', () => {
    let testTeam;
    let testUser;

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as admin to create team and user below.
        cy.apiAdminLogin();

        // # Setup a team, user and playbook for each test.
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Test Playbook',
                memberIDs: [],
            });

            // # Login as the newly created testUser
            cy.apiLogin(testUser);
        });
    });

    it('runs prompts to give feedback', () => {
        // # Visit the runs list
        cy.visit('/playbooks/runs');

        // # Click on "Give Feedback"
        cy.findByTestId('giveFeedbackButton').click();

        // # Verify that we arrive on the feedbackbot with a prompt for feedback.
        cy.findByText('Have feedback about Playbooks?').should('exist');
    });

    it('playbooks prompts to give feedback', () => {
        // # Visit the playbooks list
        cy.visit('/playbooks/playbooks');

        // # Click on "Give Feedback"
        cy.findByTestId('giveFeedbackButton').click();

        // # Verify that we arrive on the feedbackbot with a prompt for feedback.
        cy.findByText('Have feedback about Playbooks?').should('exist');
    });
});
