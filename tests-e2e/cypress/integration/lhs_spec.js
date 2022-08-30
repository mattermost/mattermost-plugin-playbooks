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

    const getRunDropdownItemByText = (runName, itemName) => {
        cy.findByTestId('Runs').findByTestId(runName).findByTestId('menuButton').click();
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
                cy.wait(3000);
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

            getRunDropdownItemByText(playbookRun.name, 'Copy link').click().then(() => {
                // * Verify clipboard content
                cy.get('@clipboard').its('contents').should('contain', `/playbooks/runs/${playbookRun.id}`);
            });
        });

        it('can make favorite', () => {
            getRunDropdownItemByText(playbookRun.name, 'Favorite').click().then(() => {
                // * Verify the run is added to favorites
                cy.findByTestId('Favorite').findByTestId(playbookRun.name).should('exist');
            });
        });
    });
});
