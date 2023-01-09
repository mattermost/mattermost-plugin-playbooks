// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbooks > list', () => {
    const playbookTitle = 'The Playbook Name';
    let testTeam;
    let testUser;
    let testUser2;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // Create another user in the same team
            cy.apiCreateUser().then(({user: user2}) => {
                testUser2 = user2;
                cy.apiAddUserToTeam(testTeam.id, testUser2.id);
            });

            // # Login as user-1
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: playbookTitle,
                memberIDs: [],
            });

            // # Create an archived public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook archived',
                memberIDs: [],
            }).then(({id}) => cy.apiArchivePlaybook(id));
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('has "Playbooks" in heading', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titlePlaybook').should('exist').contains('Playbooks');
    });

    it('join/leave playbook', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on the dot menu
        cy.findByTestId('menuButtonActions').click();

        // # Click on leave
        cy.findByText('Leave').click();

        // * Verify it has disappeared from the LHS
        cy.findByTestId('lhs-navigation').findByText(playbookTitle).should('not.exist');

        // # Join a playbook
        cy.findByTestId('join-playbook').click();

        // * Verify it has appeared in LHS
        cy.findByTestId('lhs-navigation').findByText(playbookTitle).should('exist');
    });

    it('can duplicate playbook', () => {
        // # Login as testUser2
        cy.apiLogin(testUser2);

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on the dot menu
        cy.findByTestId('menuButtonActions').click();

        // # Click on duplicate
        cy.findByText('Duplicate').click();

        // * Verify that playbook got duplicated
        cy.findByText('Copy of ' + playbookTitle).should('exist');

        // * Verify that the current user is a member and can run the playbook.
        cy.findByText('Copy of ' + playbookTitle).closest('[data-testid="playbook-item"]').within(() => {
            cy.findByTestId('run-playbook').should('exist');
            cy.findByTestId('join-playbook').should('not.exist');
        });
    });

    describe('can import playbook', () => {
        it('triggered by using button/input', () => {
            // # Load fixture of playbook export
            cy.fixture('playbook-export.json').as('playbookExport');

            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            cy.findByTestId('titlePlaybook').within(() => {
                // # Select loaded fixture for upload
                cy.findByTestId('playbook-import-input').selectFile('@playbookExport', {force: true});
            });

            // * Verify that a new playbook was created.
            cy.findByTestId('playbook-editor-title').should('contain', 'Example Playbook');
        });

        it('triggered by drag and drop', () => {
            // # Load fixture of playbook export
            cy.fixture('playbook-export.json').as('playbookExport');

            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            cy.findByTestId('titlePlaybook').within(() => {
                // # Drop loaded fixture onto import button
                cy.findByText('Import').selectFile('@playbookExport', {
                    action: 'drag-drop'
                });
            });

            // * Verify that a new playbook was created.
            cy.findByTestId('playbook-editor-title').should('contain', 'Example Playbook');
        });

        it('fails to import invalid file type', () => {
            // # Load fixture of playbook export
            cy.fixture('mp3-audio-file.mp3').as('playbookExport');

            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            cy.findByTestId('titlePlaybook').within(() => {
                // # Select loaded fixture for upload
                cy.findByTestId('playbook-import-input').selectFile('@playbookExport', {force: true});
            });

            // * Verify that an error message is displayed.
            cy.findByText('The playbook import has failed. Please check that JSON is valid and try again.').should('be.visible');
        });
    });

    context('archived playbooks', () => {
        it('does not show them by default', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // * Assert the archived playbook is not there.
            cy.findAllByTestId('playbook-title').should((titles) => {
                expect(titles).to.have.length(2);
            });
        });
        it('shows them upon click on the filter', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // # Click the With Archived button
            cy.findByTestId('with-archived').click();

            // * Assert the archived playbook is there.
            cy.findAllByTestId('playbook-title').should((titles) => {
                expect(titles).to.have.length(3);
            });
        });
    });
});
