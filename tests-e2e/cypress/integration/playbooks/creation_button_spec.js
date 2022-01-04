// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbooks > creation button', () => {
    let testTeam;
    let testUser;
    let testUser2;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser().then(({user: user2}) => {
                testUser2 = user2;
                cy.apiAddUserToTeam(testTeam.id, testUser2.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            // # Creating this playbook ensures the list view
            // # specifically is shown in the backstage content section.
            // # Without it there is a brief flicker from the list view
            // # to the no content view, which causes some flake
            // # on clicking the 'Create playbook' button
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
            });
        });
    });

    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin(testUser);

        // # Size the viewport to show playbooks without weird scrolling issues
        cy.viewport('macbook-13');
    });

    it('opens playbook creation page with New Playbook button', () => {
        const url = 'playbooks/new';
        const playbookName = 'Untitled playbook';

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'New Playbook' button
        cy.findByText('Create playbook').click();

        // * Verify a new playbook creation page opened
        verifyPlaybookCreationPageOpened(url, playbookName);
    });

    it('opens playbook creation page with "Blank" template option', () => {
        const url = 'playbooks/new';
        const playbookName = 'Untitled playbook';

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Blank'
        cy.findByText('Blank').click();

        // * Verify a new playbook creation page opened
        verifyPlaybookCreationPageOpened(url, playbookName);
    });

    it('opens Service Outage Incident page from its template option', () => {
        const url1 = 'playbooks/new?teamId=';
        const url2 = '&template_title=Service%20Reliability%20Incident';
        const playbookName = 'Service Reliability Incident';

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Service Reliability Incident'
        cy.findByText('Service Reliability Incident').click();

        // * Verify a new 'Service Outage Incident' creation page is opened
        verifyPlaybookCreationPageOpened(url1, playbookName);
        verifyPlaybookCreationPageOpened(url2, playbookName);
    });

    it('shows remove beside members when > 1 member', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Create playbook' button
        cy.findByText('Create playbook').click();

        // # Click 'Permissions' tab
        cy.findByText('Permissions').click();

        // # Click 'only selected users can access'
        cy.get('input[name="enabled"][value="enabled"]').click();

        // * Verify that there is no Remove link when there is one member
        cy.findAllByTestId('user-line').should('have.length', 1);
        cy.findAllByTestId('user-line').eq(0).within(() => {
            cy.get('a').should('not.exist');
        });

        // # Add a new user
        cy.get('.profile-autocomplete__input > input')
            .type(`${testUser2.username}`, {force: true, delay: 100}).wait(100)
            .type('{enter}');

        // * Verify that there is a Remove link when there is more than one member
        cy.findAllByTestId('user-line').should('have.length', 2);
        cy.findAllByTestId('user-line').eq(0).within(() => {
            cy.get('a').contains('Remove').should('exist');
        });
        cy.findAllByTestId('user-line').eq(1).within(() => {
            cy.get('a').contains('Remove').should('exist');
        });
    });

    describe('when the test user belongs to multiple teams', () => {
        let multiTeamUser;
        let mtUserTeam1;
        let mtUserTeam2;
        before(() => {
            cy.apiAdminLogin();
            cy.apiCreateUser().then(({user: newUser}) => {
                multiTeamUser = newUser;
                cy.apiCreateTeam().then(({team: team1}) => {
                    mtUserTeam1 = team1;
                    cy.apiCreateTeam().then(({team: team2}) => {
                        mtUserTeam2 = team2;
                        cy.apiAddUserToTeam(team1.id, newUser.id);
                        cy.apiAddUserToTeam(team2.id, newUser.id);

                        // # Creating this playbook ensures the list view
                        // # specifically is shown in the backstage content section.
                        // # Without it there is a brief flicker from the list view
                        // # to the no content view, which causes some flake
                        // # on clicking the 'Create playbook' button.
                        cy.apiCreatePlaybook({
                            teamId: team1.id,
                            title: 'Playbook',
                            memberIDs: [],
                        });
                    });
                });
            });
        });

        beforeEach(() => {
            cy.apiLogin(multiTeamUser);
        });

        it('"Create playbook" requires team selection before proceeding', () => {
            // # Open the product
            cy.visit('/playbooks/playbooks');

            // # Click 'New Playbook' button
            cy.findByText('Create playbook').click();

            // * Verify no redirect to creation has happened yet
            cy.url().should('not.include', 'new');

            cy.findByTestId('create-playbook-team-selector').next().within(() => {
                // * Verify the team picker opened with the user's teams
                cy.findByText(mtUserTeam1.display_name).should('exist');
                cy.findByText(mtUserTeam2.display_name).should('exist');

                // # Select a team to continue to creation
                cy.findByText(mtUserTeam2.display_name).click();
            });

            const url = `playbooks/new?teamId=${mtUserTeam2.id}`;
            const playbookName = 'Untitled playbook';

            // * Verify redirect to creation page for selected team
            verifyPlaybookCreationPageOpened(url, playbookName);
        });

        it('"Blank" template requires team selection before proceeding', () => {
            // # Open the product
            cy.visit('/playbooks/playbooks');

            // # Click "Blank" template button
            cy.findByText('Blank').click();

            // * Verify no redirect to creation has happened yet
            cy.url().should('not.include', 'new');

            cy.findAllByTestId('template-item-team-selector').eq(0).next().within(() => {
                // * Verify the team picker opened with the user's teams
                cy.findByText(mtUserTeam1.display_name).should('exist');
                cy.findByText(mtUserTeam2.display_name).should('exist');

                // # Select a team to continue to creation
                cy.findByText(mtUserTeam2.display_name).click();
            });

            const url = `playbooks/new?teamId=${mtUserTeam2.id}&template_title=Blank`;
            const playbookName = 'Untitled playbook';

            // * Verify redirect to creation page for selected team & template
            verifyPlaybookCreationPageOpened(url, playbookName);
        });
    });
});

function verifyPlaybookCreationPageOpened(url, playbookName) {
    // * Verify the page url contains 'playbooks/playbooks/new'
    cy.url().should('include', url);

    // * Verify the playbook name matches the one provided
    cy.findByTestId('backstage-nav-bar').within(() => {
        cy.findByText(playbookName).should('be.visible');
    });

    // * Verify there is 'Save' button
    cy.findByTestId('save_playbook').should('be.visible');
}
