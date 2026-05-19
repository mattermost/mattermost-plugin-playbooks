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
    let participantUser;
    let adminUser;
    let createdPlaybookIds = [];

    before(() => {
        cy.apiRequireLicense();
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a non-owner participant
            cy.apiCreateUser().then(({user: created}) => {
                participantUser = created;
                cy.apiAddUserToTeam(testTeam.id, created.id);
            });

            // # Create a sysadmin who is not the run owner
            cy.apiCreateCustomAdmin().then(({sysadmin: created}) => {
                adminUser = created;
                cy.apiAddUserToTeam(testTeam.id, created.id);
            });
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        createdPlaybookIds = [];
    });

    const openContextMenu = () => {
        cy.findByTestId('run-header-section').findByTestId('menuButton').click();
        cy.findByTestId('dropdownmenu').should('be.visible');
    };

    // The confirmation modal component exposes HTML id attributes (id="confirmModalButton",
    // id="cancelModalButton", id="confirmModal") rather than data-testid attributes.
    // These CSS id selectors are the correct way to target the modal buttons.
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
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Retro Enabled Run ' + getRandomId(),
                ownerUserId: testUser.id,
            });
        }).then((run) => {
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
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Retro Disabled Run ' + getRandomId(),
                ownerUserId: testUser.id,
            });
        }).then((run) => {
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
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Disable Retro Run ' + getRandomId(),
                ownerUserId: testUser.id,
            });
        }).then((run) => {
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
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Enable Retro Run ' + getRandomId(),
                ownerUserId: testUser.id,
            });
        }).then((run) => {
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

    it('disabling retrospective via context menu hides the retrospective section immediately', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Toggle Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            retrospectiveEnabled: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Section Hide Run ' + getRandomId(),
                ownerUserId: testUser.id,
            });
        }).then((run) => {
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            // * Section is visible before toggle
            cy.findByTestId('run-retrospective-section').should('exist').and('be.visible');

            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${run.id}/retrospective-enabled`).as('ToggleRetrospective');

            openContextMenu();
            cy.findByTestId('disable-retrospective-menu-item').click();
            confirmModal();
            cy.wait('@ToggleRetrospective');

            // * Section disappears without a page reload
            cy.findByTestId('run-retrospective-section').should('not.exist');
        });
    });

    it('enabling retrospective via context menu shows the retrospective section immediately', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Toggle Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            retrospectiveEnabled: false,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Section Show Run ' + getRandomId(),
                ownerUserId: testUser.id,
            });
        }).then((run) => {
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            // * Section is hidden before toggle
            cy.findByTestId('run-retrospective-section').should('not.exist');

            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${run.id}/retrospective-enabled`).as('ToggleRetrospective');

            openContextMenu();
            cy.findByTestId('enable-retrospective-menu-item').click();
            confirmModal();
            cy.wait('@ToggleRetrospective');

            // * Section appears without a page reload
            cy.findByTestId('run-retrospective-section').should('exist').and('be.visible');
        });
    });

    it('toggle option is not shown to a non-owner participant', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Toggle Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            retrospectiveEnabled: true,
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Participant Perm Run ' + getRandomId(),
                ownerUserId: testUser.id,
            });
        }).then((run) => {
            // # Log in as the participant (non-owner, non-admin); public channel so no explicit add needed
            cy.apiLogin(participantUser);
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            openContextMenu();

            // * Neither toggle option is present
            cy.findByTestId('disable-retrospective-menu-item').should('not.exist');
            cy.findByTestId('enable-retrospective-menu-item').should('not.exist');
        });
    });

    it('system admin who is not the run owner can toggle retrospective', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Toggle Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            retrospectiveEnabled: true,
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Admin Perm Run ' + getRandomId(),
                ownerUserId: testUser.id,
            });
        }).then((run) => {
            // # Log in as the sysadmin (not the run owner)
            cy.apiLogin(adminUser);
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${run.id}/retrospective-enabled`).as('ToggleRetrospective');

            // * Toggle option is visible to admin
            openContextMenu();
            cy.findByTestId('disable-retrospective-menu-item').should('be.visible').click();
            confirmModal();
            cy.wait('@ToggleRetrospective');

            // * Section hides and label switches — admin toggle worked
            cy.findByTestId('run-retrospective-section').should('not.exist');
            openContextMenu();
            cy.findByTestId('enable-retrospective-menu-item').should('be.visible');
        });
    });

    it('cancelling the disable modal leaves the label unchanged', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Toggle Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            retrospectiveEnabled: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Cancel Disable Run ' + getRandomId(),
                ownerUserId: testUser.id,
            });
        }).then((run) => {
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            // # Open the context menu and click "Disable retrospective"
            openContextMenu();
            cy.findByTestId('disable-retrospective-menu-item').click();

            // # Cancel the confirmation modal (uses HTML id attribute, not data-testid)
            cy.get('#cancelModalButton').click();
            cy.get('#confirmModal').should('not.exist');

            // # Reopen the context menu — label should still say "Disable retrospective"
            openContextMenu();
            cy.findByTestId('disable-retrospective-menu-item').should('be.visible');
            cy.findByTestId('enable-retrospective-menu-item').should('not.exist');

            cy.apiGetPlaybookRun(run.id).then(({body: updatedRun}) => {
                expect(updatedRun.retrospective_enabled).to.equal(true);
            });
        });
    });
});
