// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

function verifyCreateChecklistShown() {
    // * Verify cancel button exists
    cy.findByText('Cancel').should('be.visible');

    // * Verify save button exists
    cy.findByText('Save').should('be.visible');

    // * Verify first task input is focused
    cy.focused().should('have.attr', 'placeholder', 'Add a task title');
}

describe('channels > rhs > runlist', () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testChannel;
    let testChannelWithoutRuns;

    const numActiveRuns = 10;
    const numFinishedRuns = 0;

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
                });

                // # Create another test channel without runs
                cy.apiCreateChannel(testTeam.id, 'runless-channel', 'Runless Channel').then(({channel}) => {
                    testChannelWithoutRuns = channel;
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');
    });

    describe('no runs (blank)', () => {
        beforeEach(() => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${testChannelWithoutRuns.name}`);

            // # Click the icon
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // # Wait the RHS to load
            cy.findByText('Get started with a checklist for this channel').should('be.visible');
        });

        it.skip('can create checklist', () => {
            // # Click the button
            cy.findByText('Create a checklist').click();

            // * Verify create checklist is shown
            verifyCreateChecklistShown();
        });

        it('has link to playbooks', () => {
            // # Click the button
            cy.findByText('Explore Playbooks').click();

            // * Assert page has changed
            cy.findByText('Get started with Playbooks').should('be.visible');
        });
    });

    describe('no filtered runs', () => {
        beforeEach(() => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Wait the RHS to load
            cy.findByText('In progress').should('be.visible');

            // # Click the filter menu
            cy.findByTestId('rhs-runs-filter-menu').click();

            // # Click the finished filter
            cy.get('[data-testid="dropdownmenu"] > :nth-child(2)').click();
        });

        it.skip('can create checklist', () => {
            cy.findByTestId('no-active-runs').should('be.visible').within(() => {
                // # Click create button
                cy.findByTestId('menuButton').click();
            });

            // * Verify displayed options
            cy.get('[data-testid="dropdownmenu"] > :nth-child(1) > span').should('have.text', 'Checklist');
            cy.get('[data-testid="dropdownmenu"] > :nth-child(2) > span').should('have.text', 'Run from Playbook');

            // # Click the checklist option
            cy.get('[data-testid="dropdownmenu"] > :nth-child(1)').click();

            // * Verify create checklist is shown
            verifyCreateChecklistShown();
        });

        it('can start run', () => {
            cy.findByTestId('no-active-runs').should('be.visible').within(() => {
                // # Click create button
                cy.findByTestId('menuButton').click();
            });

            // * Verify displayed options
            cy.get('[data-testid="dropdownmenu"] > :nth-child(1) > span').should('have.text', 'Checklist');
            cy.get('[data-testid="dropdownmenu"] > :nth-child(2) > span').should('have.text', 'Run from Playbook');

            // # Click the run option
            cy.get('[data-testid="dropdownmenu"] > :nth-child(2)').click();

            cy.get('#root-portal.modal-open').within(() => {
                // * Verify modal to select playbook is shown
                cy.findByText('Select a playbook').should('be.visible');
            });
        });

        it('shows button to change to other filter if there are runs', () => {
            cy.findByTestId('no-active-runs').should('be.visible').within(() => {
                // # Click button to change filter
                cy.findByText('View in progress').click();
            });

            // # Verify filter was changed
            cy.findByTestId('rhs-runs-filter-menu').should('have.text', 'In progress');
        });
    });

    describe('with filtered runs', () => {
        beforeEach(() => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Wait the RHS to load
            cy.findByText('In progress').should('be.visible');
        });

        it('track page view', () => {
            // # intercepts telemetry
            cy.interceptTelemetry();

            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // * Assert telemetry data
            cy.expectTelemetryToContain([{name: 'channels_rhs_runlist', type: 'page'}]);
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
            cy.findByTestId('no-active-runs').should('be.visible');
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

        describe('dotmenu', () => {
            it('can navigate to RDP', () => {
                // # Click the first run's dotmenu
                cy.get('[data-testid="rhs-runs-list"] > :nth-child(1)').findByRole('button').click();

                // # Click on go to run
                cy.findByText('Go to run overview').click();

                // * Assert we are in the run details page
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=channel_rhs_dotmenu');
            });

            it('can navigate to PBE', () => {
                // # Click the first run's dotmenu
                cy.get('[data-testid="rhs-runs-list"] > :nth-child(1)').findByRole('button').click();

                // # Click on go to polaybook
                cy.findByText('Go to playbook').click();

                // * Assert we are in the PBE page
                cy.url().should('include', `/playbooks/${testPlaybook.id}`);
            });

            it('can change run name', () => {
                // # Click on the kebab menu
                cy.get('[data-testid="rhs-runs-list"] > :nth-child(1) .icon-dots-vertical').click();

                // # Click on the rename run option
                cy.findByText('Rename run').click();

                // # type new name
                cy.findByTestId('run-name-input').clear().type('My cool new run name');

                // # click save
                cy.findByTestId('modal-confirm-button').click();

                // * Verify the name has changed
                cy.get('[data-testid="rhs-runs-list"] > :nth-child(1)').contains('My cool new run name');
            });

            it('can change linked channel', () => {
                // # Click on the kebab menu
                cy.get('[data-testid="rhs-runs-list"] > :nth-child(1) .icon-dots-vertical').click();

                // # Click on the rename run option
                cy.findByText('Link run to a different channel').click();

                // # type new name
                cy.get('.modal-body').within(() => {
                    // # select town square
                    cy.findByText(testChannel.display_name).click().type('Town Square{enter}');
                });

                // # click save
                cy.findByTestId('modal-confirm-button').click();

                // Let the listing refresh
                cy.wait(1000);

                // * Verify we have the first page
                cy.get('[data-testid="rhs-runs-list"] > div').should('have.length', 8);

                // # CLick in the show-more button
                cy.get('[data-testid="rhs-runs-list"] > button').click();

                // * Verify the channel has changed, now one run less
                cy.get('[data-testid="rhs-runs-list"] > div').should('have.length', 9);
            });

            describe('navigation', () => {
                let testChannelWith2Runs;
                before(() => {
                    cy.apiLogin(testUser);

                    // # Create a test channel
                    cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                        testChannelWith2Runs = channel;

                        // # Run the playbook a few times in the existing channel
                        for (let i = 0; i < 2; i++) {
                            const runName = 'playbook-run-' + i;
                            cy.apiRunPlaybook({
                                teamId: testTeam.id,
                                playbookId: testPlaybook.id,
                                ownerUserId: testUser.id,
                                channelId: testChannelWith2Runs.id,
                                playbookRunName: runName,
                            });
                        }
                    });
                });

                it('stays at list even if one only linked run after moving run', () => {
                    // # Visit channel with 2 runs
                    cy.visit(`/${testTeam.name}/channels/${testChannelWith2Runs.name}`);

                    // # Click on the kebab menu
                    cy.get('[data-testid="rhs-runs-list"] > :nth-child(1) .icon-dots-vertical').click();

                    // # Click on the rename run option
                    cy.findByText('Link run to a different channel').click();

                    // # type new name
                    cy.get('.modal-body').within(() => {
                        // # select town square
                        cy.findByText(testChannelWith2Runs.display_name).click().type('Town Square{enter}');
                    });

                    // # click save
                    cy.findByTestId('modal-confirm-button').click();

                    // * Verify the run is not there, but we are still in the list (not rhs details)
                    cy.get('[data-testid="rhs-runs-list"] > div').should('have.length', 1);
                });
            });
        });
    });
});
