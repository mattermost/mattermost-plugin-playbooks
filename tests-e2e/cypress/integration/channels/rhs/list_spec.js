// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('channels > rhs > runlist', () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testChannel;
    const numActiveRuns = 10;
    const numFinishedRuns = 4;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Create a test channel
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                    testChannel = channel;

                    // # Run the playbook a few times in the existing channel
                    for (let i = 0; i < numActiveRuns; i++) {
                        const runName = 'playbook-run-' + i;
                        cy.apiRunPlaybook({
                            teamId: testTeam.id,
                            playbookId: testPlaybook.id,
                            ownerUserId: testUser.id,
                            channelId: testChannel.id,
                            playbookRunName: runName,
                        });
                    }

                    // # Do it again but finished
                    for (let i = 0; i < numFinishedRuns; i++) {
                        const runName = 'playbook-run-' + i;
                        cy.apiRunPlaybook({
                            teamId: testTeam.id,
                            playbookId: testPlaybook.id,
                            ownerUserId: testUser.id,
                            channelId: testChannel.id,
                            playbookRunName: runName,
                        }).then((run) => {
                            cy.apiFinishRun(run.id);
                        });
                    }
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Wait because cypress
        cy.wait(1000);
    });

    it('can filter', () => {
        // # Click the filter menu
        cy.findByTestId('rhs-runs-filter-menu').click();

        // * Verify displayed options
        cy.get('[data-testid="dropdownmenu"] > :nth-child(1) > div').should('have.text', numActiveRuns);
        cy.get('[data-testid="dropdownmenu"] > :nth-child(2) > div').should('have.text', numFinishedRuns);

        // # Click the filter
        cy.get('[data-testid="dropdownmenu"] > :nth-child(2)').click();

        // * Verify displayed options
        cy.get('[data-testid="rhs-runs-list"]').children().should('have.length', numFinishedRuns);
    });

    it('can click though', () => {
        // # Click the first run
        cy.get('[data-testid="rhs-runs-list"] > :nth-child(1)').click();

        // * Verify we made it to the run details
        cy.get('#rhsContainer').contains('playbook-run-9');
        cy.get('#rhsContainer').contains('Tasks');
    });

    it('can see give feedback button', () => {
        // * Verify give feedback button exists and has the right URL
        cy.findByTestId('rhs-runs-list').findByText('Give feedback')
            .should('exist')
            .and('have.attr', 'href')
            .and('include', 'https://mattermost.com/pl/playbooks-feedback');
    });
});
