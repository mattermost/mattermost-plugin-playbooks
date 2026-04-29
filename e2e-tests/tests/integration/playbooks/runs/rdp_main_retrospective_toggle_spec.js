// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > run details page > retrospective toggle (context menu)', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiRequireLicense();
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    const openContextMenu = () => {
        cy.findByTestId('run-header-section').findByTestId('menuButton').click();
        cy.findByTestId('dropdownmenu').should('be.visible');
    };

    const confirmModal = () => {
        cy.get('#confirmModalButton').click();
        cy.get('#confirmModal').should('not.exist');
    };

    it('context menu shows "Disable retrospective" when retrospective is enabled', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Toggle Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            retrospectiveEnabled: true,
        }).then((playbook) => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: playbook.id,
            playbookRunName: 'Retro Enabled Run ' + getRandomId(),
            ownerUserId: testUser.id,
        })).then((run) => {
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            openContextMenu();

            // * "Disable retrospective" item is present; "Enable retrospective" item is not
            cy.findByTestId('disable-retrospective-menu-item').should('be.visible');
            cy.findByTestId('enable-retrospective-menu-item').should('not.exist');
        });
    });

    it('context menu shows "Enable retrospective" when retrospective is disabled', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Toggle Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            retrospectiveEnabled: false,
        }).then((playbook) => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: playbook.id,
            playbookRunName: 'Retro Disabled Run ' + getRandomId(),
            ownerUserId: testUser.id,
        })).then((run) => {
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            openContextMenu();

            // * "Enable retrospective" item is present; "Disable retrospective" item is not
            cy.findByTestId('enable-retrospective-menu-item').should('be.visible');
            cy.findByTestId('disable-retrospective-menu-item').should('not.exist');
        });
    });

    it('disabling retrospective via context menu updates the label to "Enable retrospective" immediately', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Toggle Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            retrospectiveEnabled: true,
        }).then((playbook) => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: playbook.id,
            playbookRunName: 'Disable Retro Run ' + getRandomId(),
            ownerUserId: testUser.id,
        })).then((run) => {
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            // # Intercept the toggle request so we can wait for it to complete
            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${run.id}/retrospective-enabled`).as('ToggleRetrospective');

            // # Open the context menu and click "Disable retrospective"
            openContextMenu();
            cy.findByTestId('disable-retrospective-menu-item').click();

            // # Confirm in the modal
            confirmModal();

            // # Wait for the request to complete
            cy.wait('@ToggleRetrospective');

            // # Reopen the context menu
            openContextMenu();

            // * The label has switched to "Enable retrospective" without a page reload
            cy.findByTestId('enable-retrospective-menu-item').should('be.visible');
            cy.findByTestId('disable-retrospective-menu-item').should('not.exist');

            // * Verify the backend persisted the change
            cy.apiGetPlaybookRun(run.id).then(({body: updatedRun}) => {
                expect(updatedRun.retrospective_enabled).to.equal(false);
            });
        });
    });

    it('enabling retrospective via context menu updates the label to "Disable retrospective" immediately', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Toggle Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            retrospectiveEnabled: false,
        }).then((playbook) => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: playbook.id,
            playbookRunName: 'Enable Retro Run ' + getRandomId(),
            ownerUserId: testUser.id,
        })).then((run) => {
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            // # Intercept the toggle request so we can wait for it to complete
            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${run.id}/retrospective-enabled`).as('ToggleRetrospective');

            // # Open the context menu and click "Enable retrospective"
            openContextMenu();
            cy.findByTestId('enable-retrospective-menu-item').click();

            // # Confirm in the modal
            confirmModal();

            // # Wait for the request to complete
            cy.wait('@ToggleRetrospective');

            // # Reopen the context menu
            openContextMenu();

            // * The label has switched to "Disable retrospective" without a page reload
            cy.findByTestId('disable-retrospective-menu-item').should('be.visible');
            cy.findByTestId('enable-retrospective-menu-item').should('not.exist');

            // * Verify the backend persisted the change
            cy.apiGetPlaybookRun(run.id).then(({body: updatedRun}) => {
                expect(updatedRun.retrospective_enabled).to.equal(true);
            });
        });
    });

    it('cancelling the disable modal leaves the label unchanged', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Toggle Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            retrospectiveEnabled: true,
        }).then((playbook) => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: playbook.id,
            playbookRunName: 'Cancel Disable Run ' + getRandomId(),
            ownerUserId: testUser.id,
        })).then((run) => {
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            // # Open the context menu and click "Disable retrospective"
            openContextMenu();
            cy.findByTestId('disable-retrospective-menu-item').click();

            // # Cancel the confirmation modal
            cy.get('#cancelModalButton').click();
            cy.get('#confirmModal').should('not.exist');

            // # Reopen the context menu — label should still say "Disable retrospective"
            openContextMenu();
            cy.findByTestId('disable-retrospective-menu-item').should('be.visible');
            cy.findByTestId('enable-retrospective-menu-item').should('not.exist');
        });
    });
});
