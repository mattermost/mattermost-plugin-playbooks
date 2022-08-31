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
    let playbookRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

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
                cy.visit('/playbooks/playbooks}');

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
