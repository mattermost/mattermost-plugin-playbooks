// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../../utils';

describe('playbooks > edit > retrospective toggle', {testIsolation: true}, () => {
    const RETRO_REMINDER_TEXT = 'fill out the retrospective';

    let testTeam;
    let testUser;
    let createdPlaybookIds = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport
        cy.viewport('macbook-13');
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        createdPlaybookIds = [];
    });

    it('shows the retrospective toggle in the playbook editor', () => {
        // # Create a playbook
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retrospective Toggle Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.visitPlaybookEditor(playbook.id, 'outline');

            // * Assert the retrospective section exists in the outline
            cy.get('[id="retrospective"]').should('exist');

            // * Assert the retrospective toggle exists within the section
            cy.get('[data-testid="retrospective-toggle"]').find('input').should('exist');
        });
    });

    it('retrospective toggle is enabled by default for new playbooks', () => {
        // # Create a playbook without specifying retrospective_enabled (defaults to true)
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retrospective Default Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.visitPlaybookEditor(playbook.id, 'outline');

            // # Scroll to the retrospective section and check the checkbox
            cy.get('[id="retrospective"]').scrollIntoView().should('be.visible');
            cy.get('[data-testid="retrospective-toggle"]').find('input').should('be.checked');

            // * Assert toggle state persists after reload
            cy.reload();
            cy.get('[data-testid="retrospective-toggle"]').find('input').should('be.checked');

            // * Assert backend state: retrospective_enabled is true by default
            cy.apiGetPlaybook(playbook.id).then((pb) => {
                expect(pb.retrospective_enabled, 'retrospective_enabled should be true').to.equal(true);
            });
        });
    });

    it('clicking the toggle in the editor disables retrospective and persists via API', () => {
        // # Create a playbook with retrospective enabled (default)
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retrospective Click Toggle Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.visitPlaybookEditor(playbook.id, 'outline');

            // * Assert toggle is initially checked (enabled)
            cy.get('[id="retrospective"]').scrollIntoView().should('be.visible');
            cy.get('[data-testid="retrospective-toggle"]').find('input').should('be.checked');

            // # Intercept the GraphQL mutation so we can wait for the debounced save
            cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');

            // # Click the toggle to disable retrospective
            cy.get('[data-testid="retrospective-toggle"]').find('label').click();

            // * Assert toggle is now unchecked
            cy.get('[data-testid="retrospective-toggle"]').find('input').should('not.be.checked');

            // # Wait for the save to reach the server
            cy.wait('@UpdatePlaybook');

            // * Verify via API that retrospective_enabled was persisted as false
            cy.apiGetPlaybook(playbook.id).then((pb) => {
                expect(pb.retrospective_enabled, 'retrospective_enabled should be false after clicking toggle').to.equal(false);
            });

            // # Reload to confirm persistence
            cy.reload();
            cy.get('[data-testid="retrospective-toggle"]').find('input').should('not.be.checked');
        });
    });

    it('disabling retrospective hides the retrospective section in run details', () => {
        // # Create a playbook with retrospective disabled, then start a run
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retrospective Disabled Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            retrospectiveEnabled: false,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // * Assert backend state: retrospective_enabled is false
            cy.apiGetPlaybook(playbook.id).then((pb) => {
                expect(pb.retrospective_enabled).to.equal(false);
            });

            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Retrospective Disabled Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            });
        }).then((playbookRun) => {
            // # Visit the run details page
            cy.visit(`/playbooks/runs/${playbookRun.id}`);

            // * Wait for the run page to load by checking for the checklists section
            cy.findByTestId('run-checklist-section').should('exist');

            // * Assert the checklist section IS visible
            cy.findByTestId('run-checklist-section').should('be.visible');

            // * Assert the retrospective section is NOT visible in run details
            cy.findByTestId('run-retrospective-section').should('not.exist');
        });
    });

    it('enabling retrospective shows the retrospective section in run details', () => {
        // # Create a playbook with retrospective enabled, then start a run
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retrospective Enabled Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            retrospectiveEnabled: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // * Assert backend state: retrospective_enabled is true
            cy.apiGetPlaybook(playbook.id).then((pb) => {
                expect(pb.retrospective_enabled).to.equal(true);
            });

            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Retrospective Enabled Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            });
        }).then((playbookRun) => {
            // # Visit the run details page
            cy.visit(`/playbooks/runs/${playbookRun.id}`);

            // * Assert the retrospective section IS visible in run details
            cy.findByTestId('run-retrospective-section').should('exist').and('be.visible');
        });
    });

    it('finishing a run with retrospective disabled posts no reminder to the channel', () => {
        // # Create a playbook with retrospective disabled
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retrospective Disabled Finish Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            retrospectiveEnabled: false,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Retro Disabled Finish Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            });
        }).then((playbookRun) => {
            // # Finish the run via the UI
            cy.playbooksVisitRunChannel(testTeam.name, playbookRun);

            // # Intercept the finish API so we can wait for it to settle
            cy.intercept('POST', '/plugins/playbooks/api/v0/runs/*/finish').as('FinishRun');

            cy.findByTestId('rhs-finish-section').findByRole('button', {name: /Finish/i}).click();
            cy.playbooksConfirmFinishModal();

            // # Wait for the finish request to complete, then for the UI to reflect the finished state
            cy.wait('@FinishRun');
            cy.findByTestId('rhs-finish-section').should('not.exist');

            // * Assert no retrospective prompt bot message was posted. Wait for at least one
            // post to be visible first so the channel list has settled before the negative check.
            cy.findAllByTestId('postView').should('have.length.greaterThan', 0);
            cy.findAllByTestId('postView').each(($el) => {
                expect($el.text()).not.to.include(RETRO_REMINDER_TEXT);
            });
        });
    });

    it('finishing a run with retrospective enabled posts a reminder to the channel', () => {
        // # Create a playbook with retrospective enabled
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retrospective Enabled Finish Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            retrospectiveEnabled: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Retro Enabled Finish Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            });
        }).then((playbookRun) => {
            // # Finish the run via the UI
            cy.playbooksVisitRunChannel(testTeam.name, playbookRun);

            // # Intercept the finish API so we can wait for it to settle
            cy.intercept('POST', '/plugins/playbooks/api/v0/runs/*/finish').as('FinishRun');

            cy.findByTestId('rhs-finish-section').findByRole('button', {name: /Finish/i}).click();
            cy.playbooksConfirmFinishModal();

            // # Wait for the finish request to complete before asserting the bot post
            cy.wait('@FinishRun');

            // * Assert the retrospective prompt bot message was posted
            cy.findAllByText(new RegExp(RETRO_REMINDER_TEXT, 'i')).filter(':visible').first().should('be.visible');
        });
    });
});
