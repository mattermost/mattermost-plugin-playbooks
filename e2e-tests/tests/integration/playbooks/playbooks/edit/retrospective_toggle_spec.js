// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../../utils';
import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('playbooks > edit > retrospective toggle', {testIsolation: true}, () => {
    const RETRO_REMINDER_TEXT = 'fill out the retrospective';

    let testTeam;
    let testUser;
    let createdPlaybookIds = [];

    before(() => {
        cy.apiRequireLicense();
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
            cy.playbooksVisitEditor(playbook.id, 'outline');

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
            cy.playbooksVisitEditor(playbook.id, 'outline');

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
            cy.playbooksVisitEditor(playbook.id, 'outline');

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
            cy.assertRunDetailsPageRenderComplete(testUser.username);

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
            cy.assertRunDetailsPageRenderComplete(testUser.username);

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
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Retro Disabled Finish Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            });
        }).then((playbookRun) => {
            // # Finish the run via API, then visit the channel to inspect posts
            cy.apiFinishRun(playbookRun.id);
            cy.playbooksVisitRunChannel(testTeam.name, playbookRun);

            // # Wait for the run-finished system post to confirm the channel has settled.
            // The server posts any retrospective reminder synchronously in the same finish
            // request, so once this post is visible all channel posts are present.
            cy.contains('as finished', {timeout: TIMEOUTS.TEN_SEC}).should('exist');

            // * Assert no retrospective prompt bot message was posted
            cy.contains(RETRO_REMINDER_TEXT).should('not.exist');
            cy.findByTestId('retrospective-reminder').should('not.exist');
        });
    });

    it('finishing a run with retrospective enabled posts a reminder to the channel', () => {
        // # Create a playbook with retrospective enabled
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retrospective Enabled Finish Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            retrospectiveEnabled: true,
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Retro Enabled Finish Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            });
        }).then((playbookRun) => {
            // # Finish the run via API, then visit the channel to inspect posts
            cy.apiFinishRun(playbookRun.id);
            cy.playbooksVisitRunChannel(testTeam.name, playbookRun);

            // # Wait for the run-finished system post to confirm the channel has settled
            cy.contains('as finished', {timeout: TIMEOUTS.TEN_SEC}).should('exist');

            // * Assert the retrospective prompt bot message was posted
            cy.findByTestId('retrospective-reminder').should('be.visible');
        });
    });

    it('re-enabling retrospective on a finished run posts an immediate reminder', () => {
        // # Create a playbook with retrospective disabled, finish the run, then re-enable
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retrospective Re-enable Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            retrospectiveEnabled: false,
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Retro Re-enable Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            });
        }).then((playbookRun) => {
            // # Finish the run — no reminder should be posted (retro is disabled)
            cy.apiFinishRun(playbookRun.id);
            cy.playbooksVisitRunChannel(testTeam.name, playbookRun);
            cy.contains('as finished', {timeout: TIMEOUTS.TEN_SEC}).should('exist');
            cy.contains(RETRO_REMINDER_TEXT).should('not.exist');

            // # Re-enable retrospective on the now-finished run via the RDP context menu
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${playbookRun.id}/retrospective-enabled`).as('ToggleRetrospective');
            cy.findByTestId('run-header-section').findByTestId('menuButton').click();
            cy.findByTestId('dropdownmenu').should('be.visible');
            cy.findByTestId('enable-retrospective-menu-item').click();
            cy.get('#confirmModalButton').click();
            cy.wait('@ToggleRetrospective');

            // # Visit the run channel and verify the reminder was posted
            cy.playbooksVisitRunChannel(testTeam.name, playbookRun);
            cy.findByTestId('retrospective-reminder').should('be.visible');
        });
    });

    it('"Yes, start retrospective" navigates to the retro section, and publish posts to channel', () => {
        // # Create a playbook with retrospective DISABLED
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Retro Disabled Then Enabled Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            retrospectiveEnabled: false,
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            return cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Retro Re-enable Then Finish Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            });
        }).then((playbookRun) => {
            // # Enable retrospective on the active run via the RDP context menu
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);

            cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${playbookRun.id}/retrospective-enabled`).as('EnableRetrospective');
            cy.findByTestId('run-header-section').findByTestId('menuButton').click();
            cy.findByTestId('dropdownmenu').should('be.visible');
            cy.findByTestId('enable-retrospective-menu-item').click();
            cy.get('#confirmModalButton').click();
            cy.wait('@EnableRetrospective');

            // # Finish the run — should post the retrospective reminder
            cy.apiFinishRun(playbookRun.id);

            // # Navigate to the run channel via the RDP sidebar link (SPA navigation preserves
            // Redux state so currentPlaybookRun remains populated, keeping buttons enabled)
            cy.get('#playbooks-sidebar-right').findByTestId('runinfo-channel-link').click();
            cy.contains('as finished', {timeout: TIMEOUTS.TEN_SEC}).should('exist');

            // * Verify the retrospective reminder post is visible
            cy.findByTestId('retrospective-reminder').should('be.visible');

            // # Click "Yes, start retrospective"
            cy.findByTestId('retrospective-reminder').
                findByRole('button', {name: 'Yes, start retrospective'}).
                click();

            // * Should be on the run details page with the retrospective section in view
            cy.url().should('include', `/playbooks/runs/${playbookRun.id}`);
            cy.findByTestId('run-retrospective-section').should('be.visible');

            // # Click the report text area to enter edit mode and type
            cy.intercept('POST', `/plugins/playbooks/api/v0/runs/${playbookRun.id}/retrospective`).as('SaveRetrospective');
            cy.findByTestId('run-retrospective-section').within(() => {
                cy.findByTestId('retro-report-text').click();

                // # clicking retro-report-text swaps the div for a <textarea> with no data-testid;
                // # findByRole retries until the textarea mounts and is ready
                cy.findByRole('textbox').type('Retrospective report content');

                // # Click outside the textarea to end editing mode and flush changes before publishing
                cy.findByText('Report').click();
            });

            // # Wait for the auto-save to complete before publishing
            cy.wait('@SaveRetrospective');

            // # Publish the retrospective
            cy.findByTestId('run-retrospective-section').within(() => {
                cy.findByRole('button', {name: 'Publish'}).click();
            });
            cy.get('#confirm-modal-light').within(() => {
                cy.findByText('Are you sure you want to publish?').should('be.visible');
                cy.findByRole('button', {name: 'Publish'}).click();
            });

            // # Go back to the run channel
            cy.playbooksVisitRunChannel(testTeam.name, playbookRun);

            // * Verify the retrospective was published to the channel
            cy.contains('[data-testid="postView"]', `Retrospective for ${playbookRun.name} has been published by`).
                should('exist');
        });
    });
});
