// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../../utils';

describe('playbooks > edit > new channel only', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

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

        // # Create a fresh playbook for each test
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'New Channel Only Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            testPlaybook = playbook;
        });
    });

    afterEach(() => {
        // # Login as testUser and archive the playbook created in beforeEach
        cy.apiLogin(testUser);
        if (testPlaybook) {
            cy.apiArchivePlaybook(testPlaybook.id);
        }
    });

    it('shows the Require new channel toggle in the playbook editor', () => {
        // # Visit the playbook outline editor
        cy.visitPlaybookEditor(testPlaybook.id, 'outline');

        // * Assert "Require new channel for all runs" toggle exists
        cy.findByTestId('new-channel-only-toggle').should('exist');

        // * Assert toggle is initially unchecked (default state)
        cy.findByTestId('new-channel-only-toggle').find('input').first().should('not.be.checked');

        // * Assert via API that new_channel_only defaults to false
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            expect(pb.new_channel_only).to.equal(false);
        });
    });

    // NOTE: The API rejection test (new_channel_only=true + existing channel_id → 400)
    // lives in runs/new_channel_enforcement_spec.js to keep API contract tests co-located.

    it('API allows run creation without channel_id when new_channel_only is true', () => {
        const runName = 'New Channel Run ' + getRandomId();

        // # Enable new_channel_only on the playbook
        cy.apiPatchPlaybook(testPlaybook.id, {new_channel_only: true}).then(() => {
            // * Assert via API that new_channel_only is now true
            cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
                expect(pb.new_channel_only).to.equal(true);
            });

            // # Create a run without channel_id (new channel mode) — should succeed
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: runName,
                ownerUserId: testUser.id,
            }).then((run) => {
                // * Assert the run was created with a fresh channel
                expect(run.id).to.be.a('string').and.not.be.empty;
                expect(run.channel_id).to.be.a('string').and.not.be.empty;
                expect(run.name).to.equal(runName);

                // * Assert the channel exists
                cy.apiGetChannel(run.channel_id).then(({channel}) => {
                    expect(channel).to.exist;
                });
            });
        });
    });
});
