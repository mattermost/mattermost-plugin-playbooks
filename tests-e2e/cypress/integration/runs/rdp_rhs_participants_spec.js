// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('runs > run details page > rhs > participants', () => {
    let testTeam;
    let testUser;
    let testUser2;
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

            // Create another user in the same team
            cy.apiCreateUser().then(({user: viewer}) => {
                testUser2 = viewer;
                cy.apiAddUserToTeam(testTeam.id, testUser2.id);
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

            // # Add viewer user to the channel
            cy.apiAddUserToChannel(testRun.channel_id, testUser2.id);

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
        });
    });

    describe('as participant', () => {
        it('switching between manage modes', () => {
            navigateToParticipantsList();

            // # Switch to manage mode
            cy.findByRole('button', {name: 'Manage'}).click();

            // * Verify that we are in manage mode
            cy.findByRole('button', {name: 'Manage'}).should('not.exist');

            // # Switch to normal mode
            cy.findByRole('button', {name: 'Done'}).click();

            // * Verify that we are in normal mode
            cy.findByRole('button', {name: 'Manage'}).should('exist');
        });

        it('change owner', () => {
            navigateToParticipantsList();

            // * Verify run owner
            cy.findByTestId('run-owner').contains(testUser.username);

            // # Switch to manage mode
            cy.findByRole('button', {name: 'Manage'}).click();

            // # Change owner
            cy.findByTestId(testUser2.id).findByTestId('menuButton').click();
            cy.findByTestId('dropdownmenu').findByText('Make run owner').click();

            // # Wait for changes to apply
            cy.wait(2000);

            // * Verify the owner has changed
            cy.findByTestId('run-owner').contains(testUser2.username);
        });

        it('remove participant', () => {
            navigateToParticipantsList();

            // * Verify run owner
            cy.findByTestId('run-owner').contains(testUser.username);

            // # Switch to manage mode
            cy.findByRole('button', {name: 'Manage'}).click();

            // # remove participant
            cy.findByTestId(testUser2.id).findByTestId('menuButton').click();
            cy.findByTestId('dropdownmenu').findByText('Remove from run').click();

            // * Verify the user has been removed
            cy.findByTestId(testUser2.id).should('not.exist');
        });

        it('add participant', () => {
            navigateToParticipantsList();

            // * Verify run owner
            cy.findByTestId('run-owner').contains(testUser.username);

            // # show add participant modal
            cy.findByRole('button', {name: 'Add'}).click();

            // # Select two new participants
            cy.get('#profile-autocomplete').click().type(testUser2.username + '{enter}', {delay: 300});
            cy.get('#profile-autocomplete').click().type(testViewerUser.username + '{enter}', {delay: 300});

            // # Add selected participant
            cy.findByTestId('modal-confirm-button').click();

            // * Verify the users have been added
            cy.findByTestId(testUser2.id).should('exist');
            cy.findByTestId(testViewerUser.id).should('exist');
        });
    });

    describe('as viewer', () => {
        beforeEach(() => {
            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });
        });

        it('no manage button', () => {
            navigateToParticipantsList();

            // * Verify that there is no manage button
            cy.findByRole('button', {name: 'Manage'}).should('not.exist');
        });
    });
});

const navigateToParticipantsList = () => {
    // # Click on participants row
    cy.findByTestId('runinfo-participants').click();
};