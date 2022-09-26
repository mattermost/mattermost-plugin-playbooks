// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {stubClipboard} from '../utils';

describe('lhs', () => {
    let testTeam;
    let testUser;
    let testPublicPlaybook;
    let testPrivatePlaybook;
    let playbookRun;
    let testViewerUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create another user in the same team
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

            // # Create a private playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Private Playbook',
                memberIDs: [],
                public: false,
            }).then((playbook) => {
                testPrivatePlaybook = playbook;
            });
        });
    });

    const getRunDropdownItemByText = (groupName, runName, itemName) => {
        cy.findByTestId(groupName).findByTestId(runName).findByTestId('menuButton').click();
        return cy.findByTestId('dropdownmenu').findByText(itemName);
    };

    describe('run dot menu', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'the run name(' + Date.now() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                // # Visit the playbook run
                cy.visit(`/playbooks/runs/${playbookRun.id}`);

                // # LHS render takes a few seconds, wait for it
                cy.wait(5000);
            });
        });

        it('shows on click', () => {
            // # Click dot menu
            cy.findByTestId('Runs').findByTestId(playbookRun.name).findByTestId('menuButton').click();

            // * Assert context menu is opened
            cy.findByTestId('dropdownmenu').should('be.visible');
        });

        it('can copy link', () => {
            stubClipboard().as('clipboard');

            // # Click on Copy link menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Copy link').click().then(() => {
                // * Verify clipboard content
                cy.get('@clipboard').its('contents').should('contain', `/playbooks/runs/${playbookRun.id}`);
            });
        });

        it('can favorite / unfavorite', () => {
            // # Click on favorite menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Favorite').click().then(() => {
                // * Verify the run is added to favorites
                cy.findByTestId('Favorite').findByTestId(playbookRun.name).should('exist');

                // # Click on unfavorite menu item
                getRunDropdownItemByText('Favorite', playbookRun.name, 'Unfavorite').click().then(() => {
                    // * Verify the run is removed from favorites
                    cy.findByTestId('Runs').findByTestId(playbookRun.name).should('exist');
                });
            });
        });

        it('lhs refresh on follow/unfollow', () => {
            cy.apiLogin(testViewerUser).then(() => {
                // # Visit the playbook run
                cy.visit(`/playbooks/runs/${playbookRun.id}`);

                // # Follow the run
                cy.findByTestId('rdp-rhs-follow-button').click();
                cy.wait(3000);

                // * Verify that the run was added to the lhs
                cy.findByTestId('Runs').findByTestId(playbookRun.name).should('exist');

                // # Click on unfollow menu item
                getRunDropdownItemByText('Runs', playbookRun.name, 'Unfollow').click().then(() => {
                    // * Verify that the run is removed lhs
                    cy.findByTestId('Runs').findByTestId(playbookRun.name).should('not.exist');
                });
            });
        });

        it('leave run', () => {
            // # Add viewer user to the channel
            cy.apiAddUserToChannel(playbookRun.channel_id, testViewerUser.id);

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
            cy.wait(3000);

            // # Click on leave menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Leave and unfollow run').click();
            cy.wait(200);

            // * Verify that owner can't leave.
            cy.get('#confirmModal').should('not.exist');

            // # Change the owner to testViewerUser
            cy.findByTestId('runinfo-owner').findByTestId('assignee-profile-selector').click();
            cy.get('.playbook-run-user-select').findByText('@' + testViewerUser.username).click();
            cy.wait(500);

            // # Click on leave menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Leave and unfollow run').click();

            // * Verify that confirm leave modal is visible.
            cy.get('#confirmModal').should('exist');
        });
    });

    describe('leave run - no permanent access', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPrivatePlaybook.id,
                playbookRunName: 'the run name(' + Date.now() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                // # Add viewer user to the channel
                cy.apiAddUserToChannel(playbookRun.channel_id, testViewerUser.id);

                cy.apiLogin(testViewerUser).then(() => {
                    // # Visit the playbook run
                    cy.visit(`/playbooks/runs/${playbookRun.id}`);

                    // # LHS render takes a few seconds, wait for it
                    cy.wait(5000);
                });
            });
        });

        it('leave run, when on rdp of the same run', () => {
            // # Click on leave menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Leave and unfollow run').click();
            cy.wait(200);

            // # confirm modal
            cy.get('#confirmModal').get('#confirmModalButton').click();

            // * Verify that user was redirected to the run list page
            cy.url().should('include', 'playbooks/runs?sort=');
        });

        it('leave run, when not on rdp of the same run', () => {
            // # Visit playbooks list page
            cy.visit('/playbooks/playbooks');

            // # Click on leave menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Leave and unfollow run').click();
            cy.wait(200);

            // # confirm modal
            cy.get('#confirmModal').get('#confirmModalButton').click();
            cy.wait(500);

            // * Verify that user was not redirected to the run list page
            cy.url().should('not.include', 'playbooks/runs?sort=');
        });
    });

    describe('playbook dot menu', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'the run name(' + Date.now() + ')',
                memberIDs: [],
            }).then((playbook) => {
                testPublicPlaybook = playbook;

                // # Visit the playbooks page
                cy.visit('/playbooks/playbooks');

                // # LHS render takes a few seconds, wait for it
                cy.wait(5000);
            });
        });

        it('shows on click', () => {
            // # Click dot menu
            cy.findByTestId('Playbooks').findByTestId(testPublicPlaybook.title).findByTestId('menuButton').click();

            // * Assert context menu is opened
            cy.findByTestId('dropdownmenu').should('be.visible');
        });

        it('can copy link', () => {
            stubClipboard().as('clipboard');

            // # Click on Copy link menu item
            getRunDropdownItemByText('Playbooks', testPublicPlaybook.title, 'Copy link').click().then(() => {
                // * Verify clipboard content
                cy.get('@clipboard').its('contents').should('contain', `/playbooks/playbooks/${testPublicPlaybook.id}`);
            });
        });

        it('can favorite / unfavorite', () => {
            // # Click on favorite menu item
            getRunDropdownItemByText('Playbooks', testPublicPlaybook.title, 'Favorite').click().then(() => {
                // * Verify the playbook is added to favorites
                cy.findByTestId('Favorite').findByTestId(testPublicPlaybook.title).should('exist');

                // # Click on unfavorite menu item
                getRunDropdownItemByText('Favorite', testPublicPlaybook.title, 'Unfavorite').click().then(() => {
                    // * Verify the playbook is removed from favorites
                    cy.findByTestId('Playbooks').findByTestId(testPublicPlaybook.title).should('exist');
                });
            });
        });

        it('can leave', () => {
            stubClipboard().as('clipboard');

            // # Click on Leave menu item
            getRunDropdownItemByText('Playbooks', testPublicPlaybook.title, 'Leave').click().then(() => {
                // * Verify the playbook is removed from the list
                cy.findByTestId('Playbooks').findByTestId(testPublicPlaybook.title).should('not.exist');
            });
        });
    });
});
