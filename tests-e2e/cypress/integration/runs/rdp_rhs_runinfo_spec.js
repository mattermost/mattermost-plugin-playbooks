// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('runs > run details page > run info', () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;

    const getRHSOverview = () => cy.findByRole('complementary').contains("section", "Overview");

    const getOverviewEntry = (entryName) => {
        return getRHSOverview().findByTestId(`runinfo-${entryName}`);
    }

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

        it('Playbook entry links to the playbook', () => {
            // # Click on the Playbook entry
            getOverviewEntry('playbook').click();

            // * Verify the we're in the right playbook page
            cy.url().should('include', '/playbooks/playbooks');
            cy.findByTestId('playbook-editor-title').contains(testPublicPlaybook.title);
        });

        it('Owner entry shows the owner', () => {
            // * Verify that the owner is shown
            getOverviewEntry('owner').contains(testUser.username);
        });

        it('Participants entry shows the participants', () => {
            // * Verify that the participants are rendered
            getOverviewEntry('participants').within(() => {
                cy.getStyledComponent('Participants').within(() => {
                    cy.getStyledComponent('UserPic').should('exist');
                })
            });
        });
    }

    describe('as participant', () => {
        commonTests();

        it('Following button can be toggled', () => {
            getOverviewEntry('following').within(() => {
                // * Verify that the user shows in the following list
                cy.getStyledComponent('UserRow').within(() => {
                    cy.getStyledComponent('UserPic').should('have.length', 1);
                });

                // # Click the Following button
                cy.findByRole('button', {name: /Following/}).click({force: true});

                // * Verify that it now says (exactly) Follow
                cy.findByRole('button', {name: /^Follow$/}).should('exist');

                // * Verify that the user no longer shows in the following list
                cy.getStyledComponent('UserRow').should('not.exist');

                // # Click the Follow button
                cy.findByRole('button', {name: /^Follow$/}).click({force: true});

                // * Verify that it now says Following
                cy.findByRole('button', {name: /Following/}).should('exist');
            })
        })

        it('click channel link navigates to run\'s channel', () => {
            // # Click on channel item
            getOverviewEntry('channel').click();

            // * Assert we navigated correctly
            cy.url().should('include', `${testTeam.name}/channels/the-run-name`);
        });
    });

    describe('as viewer', () => {
        beforeEach(() => {
            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/run_details/${testRun.id}`);
            });
        });

        commonTests();

        it('Following button can be toggled', () => {
            getOverviewEntry('following').within(() => {
                // * Verify that the user is not in the following list
                cy.getStyledComponent('UserRow').within(() => {
                    cy.getStyledComponent('UserPic').should('have.length', 1);
                });

                // # Click the Follow button
                cy.findByRole('button', {name: /^Follow$/}).click({force: true});

                // * Verify that it now says Following
                cy.findByRole('button', {name: /Following/}).should('exist');

                // * Verify that the user is now in the following list
                cy.getStyledComponent('UserRow').within(() => {
                    cy.getStyledComponent('UserPic').should('have.length', 2);
                });

                // # Click the Follow button
                cy.findByRole('button', {name: /Following/}).click({force: true});

                // * Verify that it now says (exactly) Follow
                cy.findByRole('button', {name: /^Follow$/}).should('exist');
            });
        });

        it('there is no channel link', () => {
            // * Assert that the link is not present
            getOverviewEntry('channel').should('not.exist');
        });
    });
});
