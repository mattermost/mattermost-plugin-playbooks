// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > status update template resolution', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testRun;
    const TOKEN_OWNER = '{OWNER}';
    const TOKEN_CREATOR = '{CREATOR}';

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(user);

            // # Create a shared playbook with status updates enabled and two text property fields.
            // # The playbook is created once; only individual runs are recreated per test.
            cy.apiCreatePlaybook({
                teamId: team.id,
                title: 'Status Update Template Playbook ' + getRandomId(),
                memberIDs: [user.id],
                makePublic: true,
                createPublicPlaybookRun: true,
                statusUpdateEnabled: true,
                reminderTimerDefaultSeconds: 86400,
            }).then((playbook) => {
                testPlaybook = playbook;

                cy.apiAddPropertyField(playbook.id, {
                    name: 'Zone',
                    type: 'text',
                    attrs: {visibility: 'always', sortOrder: 0},
                });

                cy.apiAddPropertyField(playbook.id, {
                    name: 'Manager',
                    type: 'text',
                    attrs: {visibility: 'always', sortOrder: 1},
                });
            });
        });
    });

    after(() => {
        cy.apiLogin(testUser);
        if (testPlaybook) {
            cy.apiArchivePlaybook(testPlaybook.id);
        }
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');

        // # Create a fresh run per test (status update posts mutate run state)
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Template Status Update Run (' + getRandomId() + ')',
            ownerUserId: testUser.id,
        }).then((run) => {
            testRun = run;

            // # Set property values via the run details page sidebar
            cy.playbooksVisitRun(testRun.id);
            cy.playbooksSetRunPropertyViaRHS('Zone', 'Alpha', {type: 'text'});
            cy.playbooksSetRunPropertyViaRHS('Manager', 'Jane Smith', {type: 'text'});

            // Verify properties were actually persisted before running tests
            cy.assertRunPropertyValueStored(testRun.id, 'Zone', 'Alpha');
            cy.assertRunPropertyValueStored(testRun.id, 'Manager', 'Jane Smith');
        });
    });

    it('system tokens {OWNER} and {CREATOR} are resolved in status update messages', () => {
        cy.playbooksPostStatusUpdateViaRunPage(testRun, `Owner: ${TOKEN_OWNER}. Created by: ${TOKEN_CREATOR}.`).then((resolvedMessage) => {
            // * Static label must survive resolution
            expect(resolvedMessage).to.include('Owner:');

            // * Raw tokens must not remain
            expect(resolvedMessage).to.not.include(TOKEN_OWNER);
            expect(resolvedMessage).to.not.include(TOKEN_CREATOR);

            // * The resolved owner display name should appear in the message.
            // The server resolves {OWNER} via ShowNicknameFullName: nickname > full name > username.
            cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
                cy.apiGetUserById(run.owner_user_id).then(({user: ownerUser}) => {
                    const fullName = [ownerUser.first_name, ownerUser.last_name].filter(Boolean).join(' ');
                    const displayName = ownerUser.nickname || fullName || ownerUser.username;
                    expect(resolvedMessage).to.include(displayName);
                });
            });
        });
    });

    it('custom attribute token {Zone} is resolved in status update messages', () => {
        cy.playbooksPostStatusUpdateViaRunPage(testRun, '{Zone} zone update.').then((resolvedMessage) => {
            // * The Zone attribute value "Alpha" must appear
            expect(resolvedMessage).to.include('Alpha');

            // * Raw token must not remain
            expect(resolvedMessage).to.not.include('{Zone}');
        });
    });

    it('demo template: {SEQ}, {Zone}, {OWNER}, {Manager}, {CREATOR} all resolve together', () => {
        // This is the exact template from Feature 13 demo (SS-16):
        // "[{SEQ}] {Zone} zone update. Owner: {OWNER}. Manager: {Manager}. Created by: {CREATOR}."
        cy.playbooksPostStatusUpdateViaRunPage(testRun, `[{SEQ}] {Zone} zone update. Owner: ${TOKEN_OWNER}. Manager: {Manager}. Created by: ${TOKEN_CREATOR}.`).then((resolvedMessage) => {
            // * The Zone attribute value "Alpha" must appear
            expect(resolvedMessage).to.include('Alpha');

            // * The Manager attribute value "Jane Smith" must appear
            expect(resolvedMessage).to.include('Jane Smith');

            // * No raw tokens must remain
            // * {SEQ} is stripped because no run_number_prefix is configured on this playbook.
            // # This tests the "no sequential ID → strip {SEQ} placeholder" path.
            // # The positive resolution path ({SEQ} → 'INC-00001') is covered in sequential_id_spec.js.
            expect(resolvedMessage).to.not.include('{SEQ}');
            expect(resolvedMessage).to.not.include('{Zone}');
            expect(resolvedMessage).to.not.include(TOKEN_OWNER);
            expect(resolvedMessage).to.not.include('{Manager}');
            expect(resolvedMessage).to.not.include(TOKEN_CREATOR);
        });
    });

    it('unknown tokens are left as-is (lenient resolution)', () => {
        // The template engine is lenient — unknown tokens pass through unchanged.
        cy.playbooksPostStatusUpdateViaRunPage(testRun, `Update from ${TOKEN_OWNER}. Unknown: {DoesNotExist}.`).then((resolvedMessage) => {
            // * Unknown token is preserved verbatim
            expect(resolvedMessage).to.include('{DoesNotExist}');

            // * Known system token was still resolved
            expect(resolvedMessage).to.not.include(TOKEN_OWNER);
        });
    });
});
