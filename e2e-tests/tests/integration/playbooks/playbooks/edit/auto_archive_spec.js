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
        if (!testUser) {
            return;
        }

        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport
        cy.viewport('macbook-13');
    });

    afterEach(() => {
        if (!testUser) {
            return;
        }

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
            cy.findByTestId('auto-archive-channel-toggle').trigger('mousemove');
            cy.findByRole('tooltip').should('be.visible').and('contain', TOOLTIP_DISABLED_TEXT);

            // * Assert via API that channel_mode is link_existing_channel
            cy.apiGetPlaybook(playbook.id).then((pb) => {
                expect(pb.channel_mode).to.equal('link_existing_channel');
            });
        });
    });

    it('disables and unchecks the auto-archive toggle immediately when switching to link_existing_channel', () => {
        // # Create a playbook with the default create_new_channel mode
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Switch Channel Mode Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.playbooksVisitEditor(playbook.id, 'outline');

            // # Enable the auto-archive toggle first
            cy.playbooksInterceptPlaybookSave();
            cy.findByTestId('auto-archive-channel-toggle').find('label').first().click();
            cy.findByTestId('auto-archive-confirmation-banner').scrollIntoView().should('be.visible');
            cy.wait('@SavePlaybook');

            // * Toggle is enabled (not disabled) while in create_new_channel mode
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('not.be.disabled');

            // # Switch channel mode to "Link to an existing channel"
            cy.contains('label', 'Link to an existing channel').click();

            // * Toggle must be disabled immediately — no page reload required
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('be.disabled');

            // * Toggle must also be visually unchecked
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('not.be.checked');
        });
    });

    it('resets auto_archive_channel to false in the DB when switching to link_existing_channel', () => {
        // # Create a playbook with auto-archive already enabled
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Reset On Mode Switch Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            autoArchiveChannel: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.playbooksVisitEditor(playbook.id, 'outline');

            // * Confirm the toggle is ON before switching modes
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('be.checked');

            // # Switch channel mode to "Link to an existing channel" and wait for the auto-reset save
            cy.playbooksInterceptPlaybookSave();
            cy.contains('label', 'Link to an existing channel').click();
            cy.wait('@SavePlaybook');

            // * Verify auto_archive_channel was reset to false in the DB
            cy.apiGetPlaybook(playbook.id).then((pb) => {
                expect(pb.auto_archive_channel, 'auto_archive_channel must be false after switching to link mode').to.equal(false);
            });
        });
    });

    it('re-enables the auto-archive toggle when switching back to create_new_channel', () => {
        // # Create a playbook configured to link an existing channel
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Re-enable Toggle Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            channelMode: 'link_existing_channel',
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Visit the playbook outline editor
            cy.playbooksVisitEditor(playbook.id, 'outline');

            // * Toggle is disabled in link_existing_channel mode
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('be.disabled');

            // # Switch back to "Create a run channel" mode
            cy.contains('label', 'Create a run channel').click();

            // * Toggle must be re-enabled immediately — no page reload required
            cy.findByTestId('auto-archive-channel-toggle').find('input').first().should('not.be.disabled');
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

    it('does not archive a linked (pre-existing) channel on finish even when auto_archive_channel is true', () => {
        let testRun;

        // # Create a channel to link to — this channel must survive the run
        cy.apiGetChannelByName(testTeam.name, 'town-square').then(({channel: existingChannel}) => {
            // # Create a playbook with auto-archive=true but linking to the existing channel
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Auto Archive Linked Channel Playbook (' + getRandomId() + ')',
                memberIDs: [testUser.id],
                autoArchiveChannel: true,
                channelMode: 'link_existing_channel',
                channelId: existingChannel.id,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Start a run (it will link to the existing channel, not create one)
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Auto Archive Linked Channel Run (' + getRandomId() + ')',
                    ownerUserId: testUser.id,
                    channelId: existingChannel.id,
                }).then((run) => {
                    testRun = run;

                    // # Finish the run via API
                    cy.apiFinishRun(testRun.id);

                    // * Wait for the run to reach Finished status
                    cy.waitUntil(
                        () => cy.apiGetPlaybookRun(testRun.id).then(({body: fetchedRun}) => fetchedRun.current_status === 'Finished'),
                        {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Run did not reach Finished status'},
                    );

                    // * The linked channel must NOT be archived even though auto_archive_channel=true
                    cy.apiGetChannel(existingChannel.id).then(({channel}) => {
                        expect(channel.delete_at, 'linked channel must not be archived').to.equal(0);
                    });
                });
            });
        });
    });

    it('does not unarchive the channel on restore when the run did not auto-archive it', () => {
        let testRun;

        // # Create a playbook with auto-archive disabled
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'No Auto Archive Restore Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            autoArchiveChannel: false,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Start a run
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'No Auto Archive Restore Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;

                // # Finish the run — channel should NOT be archived
                cy.apiFinishRun(testRun.id);

                cy.waitUntil(
                    () => cy.apiGetPlaybookRun(testRun.id).then(({body: fetchedRun}) => fetchedRun.current_status === 'Finished'),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Run did not reach Finished status'},
                );

                cy.apiGetChannel(testRun.channel_id).then(({channel}) => {
                    expect(channel.delete_at, 'channel must not be archived (auto-archive was off)').to.equal(0);
                });

                // # Restore the run — channel must remain unarchived
                cy.apiRestoreRun(testRun.id);

                cy.waitUntil(
                    () => cy.apiGetPlaybookRun(testRun.id).then(({body: fetchedRun}) => fetchedRun.current_status === 'InProgress'),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Run did not reach InProgress status after restore'},
                );

                cy.apiGetChannel(testRun.channel_id).then(({channel}) => {
                    expect(channel.delete_at, 'channel must remain unarchived after restore when auto-archive was off').to.equal(0);
                });
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

    it('shows channel_archived timeline event on the run details page after finishing', () => {
        let testRun;

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Timeline Archive Run Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            autoArchiveChannel: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Timeline Archive Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;

                // # Visit the run details page and finish via the Finish button there
                cy.visit(`/playbooks/runs/${testRun.id}`);
                cy.findByTestId('run-header-section').should('be.visible');

                cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${testRun.id}/finish`).as('routeFinish');
                cy.findByTestId('run-finish-section').find('button').click();
                cy.playbooksConfirmFinishModal();
                cy.wait('@routeFinish');

                // * Assert the badge flips to Finished
                cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

                // Wait for the async channel archive and timeline event write before asserting
                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at > 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not archived after run finish'},
                );

                // * Assert the channel_archived timeline event is visible in the UI
                cy.findAllByTestId('timeline-item channel_archived').should('have.length.gte', 1);
            });
        });
    });

    it('unarchives channel and shows channel_unarchived timeline event when restored via run details page UI', () => {
        let testRun;

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'UI Restore Timeline Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            autoArchiveChannel: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'UI Restore Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;

                // # Finish via API so the channel is archived
                cy.apiFinishRun(testRun.id);
                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at > 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not archived after run finish'},
                );

                // # Visit the run details page and restore via the dropdown
                cy.visit(`/playbooks/runs/${testRun.id}`);
                cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

                cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${testRun.id}/restore`).as('routeRestore');
                cy.findByTestId('runDropdown').click();
                cy.get('.restartRun').click();
                cy.get('#confirmModal').get('#confirmModalButton').click();
                cy.wait('@routeRestore');

                // * Assert the badge flips to In Progress
                cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

                // * Assert the channel is unarchived
                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at === 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not unarchived after run restore'},
                );

                // * Assert the channel_unarchived timeline event is visible in the UI
                // should('have.length.gte', 1) retries with Cypress's built-in timeout, giving
                // the server time to commit the timeline row after the channel unarchive.
                cy.findAllByTestId('timeline-item channel_unarchived').should('have.length.gte', 1);
            });
        });
    });

    it('posts a status message in the unarchived channel after restore', () => {
        let testRun;

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Status Message After Restore Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            autoArchiveChannel: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Status Message Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;

                // # Finish the run — channel is auto-archived
                cy.apiFinishRun(testRun.id);
                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at > 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not archived after run finish'},
                );

                // # Restore the run — the server unarchives the channel then posts the status message
                cy.apiRestoreRun(testRun.id);
                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at === 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not unarchived after run restore'},
                );

                // # Visit the now-active channel
                cy.playbooksVisitRunChannel(testTeam.name, testRun);
                cy.get('#channel-header').should('be.visible');

                // * Assert the restore status message is present in the channel
                cy.get('.post-message__text').contains('from Finished to In Progress').should('exist');
            });
        });
    });

    it('allows next finish to auto-archive channel after manual unarchive and run restore', () => {
        let testRun;

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Manual Unarchive Before Restore Playbook (' + getRandomId() + ')',
            memberIDs: [testUser.id],
            autoArchiveChannel: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Manual Unarchive Run (' + getRandomId() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;

                // # Finish the run — channel is auto-archived
                cy.apiFinishRun(testRun.id);
                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at > 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not archived after first finish'},
                );

                // # Manually unarchive the channel as an admin (simulates using the channel header outside Playbooks)
                cy.apiAdminLogin();
                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/api/v4/channels/${testRun.channel_id}/restore`,
                    method: 'POST',
                });
                cy.apiLogin(testUser);

                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at === 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not manually unarchived'},
                );

                // # Restore the run via the run details page — clears the AutoArchivedChannel marker
                cy.visit(`/playbooks/runs/${testRun.id}`);
                cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

                cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${testRun.id}/restore`).as('routeRestore');
                cy.findByTestId('runDropdown').click();
                cy.get('.restartRun').click();
                cy.get('#confirmModal').get('#confirmModalButton').click();
                cy.wait('@routeRestore');

                cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

                // # Finish the run a second time — auto-archive must fire again because the marker was cleared
                cy.intercept('PUT', `/plugins/playbooks/api/v0/runs/${testRun.id}/finish`).as('routeFinish2');
                cy.findByTestId('run-finish-section').find('button').click();
                cy.playbooksConfirmFinishModal();
                cy.wait('@routeFinish2');
                cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

                // * Assert the channel is archived again on the second finish
                cy.waitUntil(
                    () => cy.apiGetChannel(testRun.channel_id).then(({channel}) => channel.delete_at > 0),
                    {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Channel was not re-archived on second finish after manual unarchive and restore'},
                );
            });
        });
    });
});
