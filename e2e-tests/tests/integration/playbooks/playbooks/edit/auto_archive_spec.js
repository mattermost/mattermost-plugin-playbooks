// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../../utils';

describe('playbooks > edit > auto archive', {testIsolation: true}, () => {
    const TOOLTIP_DISABLED_TEXT = 'auto-archived';

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

    it('shows the auto-archive toggle in the playbook editor', () => {
        // # Create a playbook
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Auto Archive Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            // * Assert the auto-archive toggle is present
            cy.findByTestId('auto-archive-channel-toggle').should('exist');
        });
    });

    it('shows confirmation banner when auto-archive toggle is enabled', () => {
        // # Create a playbook
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Auto Archive Toggle Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            // # Enable the auto-archive toggle
            cy.findByTestId('auto-archive-channel-toggle').find('label').first().click();

            // * Assert confirmation banner appears stating channels will be auto-archived
            cy.findByTestId('auto-archive-confirmation-banner').scrollIntoView().should('be.visible');
            cy.findByTestId('auto-archive-confirmation-banner').should('contain', 'auto-archived');

            // * Assert state persists after reload
            cy.reload();
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('be.checked');

            // * Assert the backend persisted the setting (GraphQL editor → REST read-back)
            cy.apiGetPlaybook(playbook.id).then((pb) => {
                expect(pb.auto_archive_channel, 'auto_archive_channel should be true').to.equal(true);
            });
        });
    });

    it('archives the run channel automatically after the run is finished', () => {
        let testPlaybook;
        let testRun;

        // # Create a playbook and enable auto-archive via the editor UI
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Auto Archive On Finish (' + getRandomId() + ')',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            testPlaybook = playbook;
            createdPlaybookIds.push(playbook.id);

            // # Enable auto-archive via the playbook editor UI
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            cy.findByTestId('auto-archive-channel-toggle').find('label').first().click();

            // * Confirm the banner appears (guards against a silent toggle failure)
            cy.findByTestId('auto-archive-confirmation-banner').scrollIntoView().should('be.visible');

            // # Start a run from the playbook
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'Auto Archive Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;

                // # Finish the run via the RHS Finish button
                cy.playbooksVisitRunChannel(testTeam.name, testRun);
                cy.findByTestId('rhs-finish-section').findByRole('button', {name: /finish/i}).click();
                cy.playbooksConfirmFinishModal();

                // * Assert the run's channel is now archived (delete_at > 0)
                cy.apiGetChannel(testRun.channel_id).then(({channel}) => {
                    expect(channel.delete_at).to.be.greaterThan(0);
                });
            });
        });
    });

    it('disables the auto-archive toggle when channel_mode is link_existing_channel', () => {
        // # Create a playbook that links to an existing channel
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Link Existing Channel Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            channelMode: 'link_existing_channel',
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            // * Assert the auto-archive toggle is disabled
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('be.disabled');

            // * Assert a tooltip explains why it's disabled
            cy.findByTestId('auto-archive-channel-toggle').find('span').first().trigger('mouseover');
            cy.findByRole('tooltip').should('be.visible').and('contain', TOOLTIP_DISABLED_TEXT);
        });
    });

    it('enables the auto-archive toggle when channel_mode is create_new_channel', () => {
        // # Create a playbook with create_new_channel mode
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'New Channel Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            channelMode: 'create_new_channel',
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            // * Assert the auto-archive toggle is enabled (not disabled)
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('not.be.disabled');
        });
    });

    it('does NOT archive the run channel when auto-archive is disabled (default)', () => {
        let testRun;

        // # Create a playbook WITHOUT enabling auto-archive (default off)
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'No Auto Archive Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Start a run on the playbook (auto-archive not enabled)
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'No Auto Archive Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;

                // # Finish the run via the RHS Finish button
                cy.playbooksVisitRunChannel(testTeam.name, testRun);
                cy.findByTestId('rhs-finish-section').findByRole('button', {name: /finish/i}).click();
                cy.playbooksConfirmFinishModal();

                // * Assert the run channel is NOT archived (delete_at === 0)
                cy.apiGetChannel(testRun.channel_id).then(({channel}) => {
                    expect(channel.delete_at).to.equal(0);
                });
            });
        });
    });
});
