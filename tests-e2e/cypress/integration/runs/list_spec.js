// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

const LIST_PER_PAGE = 15;

describe('runs > list', () => {
    let testTeam;
    let testUser;
    let testAnotherUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create another user
            cy.apiCreateUser().then(({user: anotherUser}) => {
                testAnotherUser = anotherUser;

                cy.apiAddUserToTeam(testTeam.id, anotherUser.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show all
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('has "Runs" and team name in heading', () => {
        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        });

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbook runs
        cy.findByTestId('playbookRunsLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titlePlaybookRun').should('exist').contains('Runs');
    });

    it('loads playbook run details page when clicking on a playbook run', () => {
        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        });

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to runs
        cy.findByTestId('playbookRunsLHSButton').click();

        // # Find the playbook run and click to open details view
        cy.get('#playbookRunList').within(() => {
            cy.findByText(playbookRunName).click();
        });

        // * Verify that the header contains the playbook run name
        cy.findByTestId('playbook-run-title').contains(playbookRunName);
    });

    describe('filters my runs only', () => {
        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Run a playbook with testUser as a participant
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'testUsers Run',
                ownerUserId: testUser.id,
            });

            // # Login as testAnotherUser
            cy.apiLogin(testAnotherUser);

            // # Run a playbook with testAnotherUser as a participant
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'testAnotherUsers Run',

                // ownerUserId: testUser.id,
                ownerUserId: testAnotherUser.id,
            });
        });

        it('for testUser', () => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Open the product
            cy.visit('/playbooks');

            // # Make sure both runs are visible by default
            cy.findByText('testUsers Run').should('be.visible');
            cy.findByText('testAnotherUsers Run').should('be.visible');

            // # Filter to only my runs
            cy.findByTestId('my-runs-only').click();

            // # Verify runs by testAnotherUser are not visible
            cy.findByText('testAnotherUsers Run').should('not.exist');

            // # Verify runs by testUser remain visible
            cy.findByText('testUsers Run').should('be.visible');
        });

        it('for testAnotherUser', () => {
            // # Login as testAnotherUser
            cy.apiLogin(testAnotherUser);

            // # Open the product
            cy.visit('/playbooks');

            // Make sure both runs are visible by default
            cy.findByText('testUsers Run').should('be.visible');
            cy.findByText('testAnotherUsers Run').should('be.visible');

            // # Filter to only my runs
            cy.findByTestId('my-runs-only').click();

            // # Verify runs by testUser are not visible
            cy.findByText('testUsers Run').should('not.exist');

            // # Verify runs by testAnotherUser remain visible
            cy.findByText('testAnotherUsers Run').should('be.visible');
        });
    });

    describe('filters Finished runs correctly', () => {
        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Run a playbook with testUser as a participant
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'testUsers Run to be finished',
                ownerUserId: testUser.id,
            }).then((playbook) => {
                cy.apiFinishRun(playbook.id);
            });
        });

        it('shows finished runs', () => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Open the product
            cy.visit('/playbooks');

            // # Make sure runs are visible by default, and finished is not
            cy.findByText('testUsers Run').should('be.visible');
            cy.findByText('testAnotherUsers Run').should('be.visible');
            cy.findByText('testUsers Run to be finished').should('not.exist');

            // # Filter to finished runs as well
            cy.findByTestId('finished-runs').click();

            // # Verify runs remain visible
            cy.findByText('testUsers Run').should('be.visible');
            cy.findByText('testAnotherUsers Run').should('be.visible');

            // # Verify finished run is visible
            cy.findByText('testUsers Run to be finished').should('be.visible');
        });
    });

    describe('resets pagination when filtering', () => {
        const playbookRunTimestamps = [];

        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Start sufficient playbook runs to ensure pagination is possible.
            for (let i = 0; i < LIST_PER_PAGE + 1; i++) {
                const now = Date.now();
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Playbook Run (' + now + ')',
                    ownerUserId: testUser.id,
                });
                playbookRunTimestamps.push(now);
            }
        });

        beforeEach(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Open the product
            cy.visit('/playbooks');

            // # Switch to runs
            cy.findByTestId('playbookRunsLHSButton').click();

            // # Switch to page 2
            cy.findByText('Next').click();

            // * Verify "Previous" now shown
            cy.findByText('Previous').should('exist');
        });

        it('by playbook run name', () => {
            // # Search for a playbook run by name
            cy.findByTestId('search-filter').type(playbookRunTimestamps[0]);

            // * Verify "Previous" no longer shown
            cy.findByText('Previous').should('not.exist');
        });

        it('by owner', () => {
            // # Expose the owner list
            cy.findByTestId('owner-filter').click();

            // # Find the list and chose the first owner in the list
            cy.get('.playbook-run-user-select__container')
                .find('.PlaybookRunProfile').first().parent().click({force: true});

            // * Verify "Previous" no longer shown
            cy.findByText('Previous').should('not.exist');
        });
    });
});
