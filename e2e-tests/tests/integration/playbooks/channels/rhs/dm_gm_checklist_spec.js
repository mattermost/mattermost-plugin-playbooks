// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../../fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > dm/gm checklists', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testOtherUser;
    let testThirdUser;
    let testPlaybook;
    let dmChannel;
    let gmChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create a playbook for the "Run a playbook" tests
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Test Playbook',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });

            // # Create a second user and add to team
            cy.apiCreateUser().then(({user: otherUser}) => {
                testOtherUser = otherUser;
                cy.apiAddUserToTeam(testTeam.id, testOtherUser.id);

                // # Create a third user and add to team (needed for GM)
                cy.apiCreateUser().then(({user: thirdUser}) => {
                    testThirdUser = thirdUser;
                    cy.apiAddUserToTeam(testTeam.id, testThirdUser.id);

                    // # Create a DM channel between testUser and otherUser
                    cy.apiCreateDirectChannel([testUser.id, testOtherUser.id]).then(({channel}) => {
                        dmChannel = channel;
                    });

                    // # Create a GM channel between all three users
                    cy.apiCreateGroupChannel([testUser.id, testOtherUser.id, testThirdUser.id]).then(({channel}) => {
                        gmChannel = channel;
                    });
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

    describe('checklist creation', () => {
        it('can create a checklist in a DM channel', () => {
            // # Navigate to the DM channel
            cy.visit(`/${testTeam.name}/messages/@${testOtherUser.username}`);

            // # Wait for the channel to load
            cy.get('#post-create').should('exist');
            cy.wait(TIMEOUTS.TWO_SEC);

            // # Open playbooks RHS
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // # Wait for RHS to open
            cy.get('#rhsContainer', {timeout: 10000}).should('be.visible');

            // # Click the "New checklist" button to create a blank checklist
            cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();

            // # Wait for checklist creation and RHS to update
            cy.wait(TIMEOUTS.TWO_SEC);

            // * Verify the checklist was created and appears in the RHS
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Untitled checklist').should('be.visible');
                cy.findByText('Tasks').should('be.visible');
            });
        });

        it('can create a checklist in a GM channel', () => {
            // # Navigate to the GM channel by ID
            cy.visit(`/${testTeam.name}/messages/${gmChannel.id}`);

            // # Wait for the channel to load
            cy.get('#post-create').should('exist');
            cy.wait(TIMEOUTS.TWO_SEC);

            // # Open playbooks RHS
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // # Wait for RHS to open
            cy.get('#rhsContainer', {timeout: 10000}).should('be.visible');

            // # Click the "New checklist" button to create a blank checklist
            cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();

            // # Wait for checklist creation and RHS to update
            cy.wait(TIMEOUTS.TWO_SEC);

            // * Verify the checklist was created and appears in the RHS
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Untitled checklist').should('be.visible');
                cy.findByText('Tasks').should('be.visible');
            });
        });
    });

    describe('"Run a playbook" visibility', () => {
        it('is hidden in a DM channel dropdown', () => {
            // # Navigate to the DM channel
            cy.visit(`/${testTeam.name}/messages/@${testOtherUser.username}`);

            // # Wait for the channel to load
            cy.get('#post-create').should('exist');
            cy.wait(TIMEOUTS.TWO_SEC);

            // # Open playbooks RHS
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // # Wait for RHS to open
            cy.get('#rhsContainer', {timeout: 10000}).should('be.visible');

            // # Create a blank checklist first so the header with dropdown appears
            cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
            cy.wait(TIMEOUTS.TWO_SEC);

            // # Click the dropdown chevron next to "New checklist" button
            cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

            // * Verify "Run a playbook" does NOT exist in the dropdown
            cy.findByTestId('create-from-playbook').should('not.exist');
        });

        it('is visible in a regular channel dropdown', () => {
            // # Navigate to a regular channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Wait for the channel to load
            cy.get('#post-create').should('exist');
            cy.wait(TIMEOUTS.TWO_SEC);

            // # Open playbooks RHS
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // # Wait for RHS to open
            cy.get('#rhsContainer', {timeout: 10000}).should('be.visible');

            // # Create a blank checklist first so the header with dropdown appears
            cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
            cy.wait(TIMEOUTS.TWO_SEC);

            // # Click the dropdown chevron next to "New checklist" button
            cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

            // * Verify "Run a playbook" DOES exist in the dropdown
            cy.findByTestId('create-from-playbook').should('exist');
        });
    });

    describe('API gate', () => {
        it('rejects playbook run creation in a DM channel', () => {
            // # Attempt to run a playbook targeting the DM channel via API
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'Run in DM ' + Date.now(),
                ownerUserId: testUser.id,
                channelId: dmChannel.id,
            }, {expectedStatusCode: 400});
        });
    });
});
