// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

const editAndPublishRetro = () => {
    getRetro().within(() => {
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
    });

    // * Verify we're showing the publish retro confirmation modal
    cy.get('#confirm-modal-light').contains('Are you sure you want to publish?');

    // # Publish
    cy.findByRole('button', {name: 'Publish'}).click();

    // * Verify that retro got published
    getRetro().get('.icon-check-all').should('be.visible');
};

const getRetro = () => cy.findByTestId('run-retrospective-section');

describe('runs > run details page > retrospective', () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // Create another user in the same team
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
                retrospectiveTemplate: 'This is a retrospective template.',
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
            cy.visit(`/playbooks/run_details/${playbookRun.id}`);
        });
    });
    const commonTests = () => {
        it('is visible', () => {
            // * Verify the retrospective section is present
            getRetro().should('be.visible');
        });

        it('has title', () => {
            // * Verify the retrospective section has a title
            getRetro().find('h3').contains('Retrospective');
        });

        it('has template text', () => {
            // * Verify the retrospective section has a title
            getRetro().findByTestId('retro-report-text').contains('This is a retrospective template.');
        });
    };

    describe('as participant', () => {
        commonTests();

        it('publishing posts to run channel', () => {
            editAndPublishRetro();

            // # Switch to the run channel
            cy.findByTestId('runinfo-channel').click();

            // * Verify the modified retro text is posted
            cy.getStyledComponent('CustomPostContent').should('exist').contains('Edited retrospective.');
        });

        it('can be published once', () => {
            editAndPublishRetro();
            getRetro().findByText('Publish').should('not.be.enabled');
        });
    });

    describe('as viewer', () => {
        beforeEach(() => {
            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/run_details/${testRun.id}`);
            });
        });

        commonTests();
    });
});
