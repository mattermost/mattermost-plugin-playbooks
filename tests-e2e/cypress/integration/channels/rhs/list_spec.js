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
                title: 'The playbook name',
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

        // # Wait the RHS to load
        cy.findByText('Runs in progress').should('be.visible');
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

    it('can show more (pagination)', () => {
        // * Verify we have the first page
        cy.get('[data-testid="rhs-runs-list"] > div').should('have.length', 8);

        // # CLick in the show-more button
        cy.get('[data-testid="rhs-runs-list"] > button').click();

        // * Verify we have loaded the second page
        cy.get('[data-testid="rhs-runs-list"] > div').should('have.length', 10);
    });

    it('card has the basic info', () => {
        // # Click the first run
        cy.get('[data-testid="rhs-runs-list"] > :nth-child(1)').within(() => {
            cy.findByText('playbook-run-9').should('be.visible');
            cy.findByText('The playbook name').should('be.visible');
            cy.findByText(testUser.username).should('be.visible');
        });
    });

    it('card dotmenu can navigate to RDP', () => {
        // # Click the first run's dotmenu
        cy.get('[data-testid="rhs-runs-list"] > :nth-child(1)').findByRole('button').click();

        // # Click on go to run
        cy.findByText('Go to run overview').click();

        // * Assert we are in the run details page
        cy.url().should('include', '/playbooks/runs/');
        cy.url().should('include', '?from=channel_rhs_dotmenu');
    });

    it('card dotmenu can navigate to PBE', () => {
        // # Click the first run's dotmenu
        cy.get('[data-testid="rhs-runs-list"] > :nth-child(1)').findByRole('button').click();

        // # Click on go to polaybook
        cy.findByText('Go to playbook').click();

        // * Assert we are in the PBE page
        cy.url().should('include', `/playbooks/${testPlaybook.id}`);
    });

    it('can click though', () => {
        // # Click the first run
        cy.get('[data-testid="rhs-runs-list"] > :nth-child(1)').click();

        // * Verify we made it to the run details at Channels RHS
        cy.get('#rhsContainer').contains('playbook-run-9');
        cy.get('#rhsContainer').contains('Tasks');
    });

    it('can see give feedback button', () => {
        // * Verify give feedback button exists and has the right URL
        cy.get('#rhsContainer').findByText('Give feedback')
            .should('exist')
            .and('have.attr', 'href')
            .and('include', 'https://mattermost.com/pl/playbooks-feedback');
    });
});
