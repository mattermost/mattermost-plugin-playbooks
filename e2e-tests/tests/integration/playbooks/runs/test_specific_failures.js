// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('Test specific failing tests', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;
    let playbookRun;

    const getHeader = () => {
        return cy.findByTestId('run-header-section');
    };

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
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });
        });
    });

    describe('Test 1: Request join button', () => {
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
                testRun = run;

                // Login as viewer and visit run
                cy.apiLogin(testViewerUser).then(() => {
                    cy.visit(`/playbooks/runs/${testRun.id}`);
                });
            });
        });

        it('Can click request-join button', () => {
            const getOverviewEntry = (entryName) => (
                cy.findByRole('complementary').contains('section', 'Overview').findByTestId(`runinfo-${entryName}`)
            );

            // * Assert that the section exists with label Private
            getOverviewEntry('channel').contains('Private');

            // * Assert that link does not exist
            getOverviewEntry('channel').within(() => {
                cy.get('a').should('not.exist');
            });

            // * Assert that request-join button does not exist
            getOverviewEntry('channel').within(() => {
                cy.get('button').should('not.exist');
            });

            cy.wait(500);

            // # Click Participate button
            getHeader().findByText('Participate').click();

            // * Assert that modal is shown
            cy.get('#become-participant-modal').should('exist');

            // # Confirm modal
            cy.findByTestId('modal-confirm-button').click();

            // # Click request-join button
            getOverviewEntry('channel').within(() => {
                cy.get('button').click();
            });

            // # Click send request button
            cy.findByText('Send request').click();

            // * Assert that the request was sent
            cy.findByText('Your request was sent to the run channel.');
        });
    });

    describe('Test 2: Add users updates timeline', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                // # Visit the playbook run
                cy.visit(`/playbooks/runs/${playbookRun.id}`);
            });
        });

        it('Can add users to run and see UI update', () => {
            // # Add viewer user to the channel
            cy.apiAddUsersToRun(playbookRun.id, [testViewerUser.id]);
            cy.findAllByTestId('timeline-item', {exact: false}).should('have.length', 3);

            // # Change the owner to testViewerUser
            cy.apiChangePlaybookRunOwner(playbookRun.id, testViewerUser.id);
            cy.findByTestId('assignee-profile-selector').should('contain', testViewerUser.username);
        });
    });
});
