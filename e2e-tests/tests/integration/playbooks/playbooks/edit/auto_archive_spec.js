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

describe('playbooks > edit > auto archive', () => {
    const TOOLTIP_DISABLED_TEXT = 'cannot be auto-archived';

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

    it('shows the auto-archive toggle in the playbook editor and defaults to off', () => {
        // # Create a playbook
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Auto Archive Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.playbooksVisitEditor(playbook.id, 'outline');

            // * Assert the auto-archive toggle is present and unchecked by default
            cy.findByTestId('auto-archive-channel-toggle').should('exist');
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('not.be.checked');
        });
    });

    it('shows confirmation banner when auto-archive is enabled, persists after reload, and clears when toggled off', () => {
        // # Create a playbook
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Auto Archive Toggle Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.playbooksVisitEditor(playbook.id, 'outline');

            // # Intercept the save request before clicking so the alias is registered
            cy.playbooksInterceptPlaybookSave();

            // # Enable the auto-archive toggle
            cy.findByTestId('auto-archive-channel-toggle').find('label').first().click();

            // * Assert confirmation banner appears stating channels will be auto-archived
            cy.findByTestId('auto-archive-confirmation-banner').scrollIntoView().should('be.visible');
            cy.findByTestId('auto-archive-confirmation-banner').should('contain', 'auto-archived');

            // # Wait for the PUT to complete before reloading or reading back via API
            cy.wait('@SavePlaybook');

            // * Assert state persists after reload
            cy.reload();
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('be.checked');

            // # Toggle auto-archive off and verify banner disappears
            cy.playbooksInterceptPlaybookSave();
            cy.findByTestId('auto-archive-channel-toggle').find('label').first().click();
            cy.findByTestId('auto-archive-confirmation-banner').should('not.exist');
            cy.wait('@SavePlaybook');
        });
    });

    it('archives the run channel after finishing via the RHS Finish button', () => {
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
            cy.playbooksVisitEditor(testPlaybook.id, 'outline');
            cy.playbooksInterceptPlaybookSave();
            cy.findByTestId('auto-archive-channel-toggle').find('label').first().click();

            // * Confirm the banner appears (guards against a silent toggle failure)
            cy.findByTestId('auto-archive-confirmation-banner').scrollIntoView().should('be.visible');

            // # Wait for the PUT to complete before reading back via API
            cy.wait('@SavePlaybook');

            // * Verify auto_archive_channel was persisted via API
            cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
                expect(pb.auto_archive_channel, 'auto_archive_channel should be true').to.equal(true);
            });

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
                cy.get('#channel-header').should('be.visible');
                cy.findByTestId('rhs-finish-section').findByRole('button', {name: /finish/i}).click();
                cy.playbooksConfirmFinishModal();

                // * Assert the run's channel is now archived (poll for async archive)
                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at > 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not archived after run finish'},
                );
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
            cy.playbooksVisitEditor(playbook.id, 'outline');

            // * Assert the auto-archive toggle is disabled
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('be.disabled');

            // * Assert a tooltip explains why it's disabled
            cy.findByTestId('auto-archive-channel-toggle').find('span').first().trigger('mouseover');
            cy.findByRole('tooltip').should('be.visible').and('contain', TOOLTIP_DISABLED_TEXT);

            // * Assert via API that channel_mode is link_existing_channel
            cy.apiGetPlaybook(playbook.id).then((pb) => {
                expect(pb.channel_mode).to.equal('link_existing_channel');
            });
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
            cy.playbooksVisitEditor(playbook.id, 'outline');

            // * Assert the auto-archive toggle is enabled (not disabled)
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('not.be.disabled');
        });
    });

    it('unarchives the run channel when the run is restored via API', () => {
        let testRun;

        // # Create a playbook with auto-archive enabled
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Auto Archive Restore (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            autoArchiveChannel: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Start a run
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Auto Archive Restore Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;

                // # Finish the run via API
                cy.apiFinishRun(testRun.id);

                // * Wait for the channel to be archived
                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at > 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not archived after run finish'},
                );

                // # Restore the run via API
                cy.apiRestoreRun(testRun.id);

                // * Assert the channel is unarchived (delete_at === 0)
                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at === 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not unarchived after run restore'},
                );
            });
        });
    });

    it('does not archive the run channel when auto-archive is disabled (default)', () => {
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
                cy.get('#channel-header').should('be.visible');
                cy.findByTestId('rhs-finish-section').findByRole('button', {name: /finish/i}).click();
                cy.playbooksConfirmFinishModal();

                // * Wait for the server to commit the finish before reading back
                cy.waitUntil(
                    () => cy.apiGetPlaybookRun(testRun.id).then(({body: fetchedRun}) => fetchedRun.current_status === 'Finished'),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Run did not reach Finished status within timeout'},
                );

                // * Assert the run channel is NOT archived (delete_at === 0)
                cy.apiGetChannel(testRun.channel_id).then(({channel}) => {
                    expect(channel.delete_at).to.equal(0);
                });
            });
        });
    });
});
