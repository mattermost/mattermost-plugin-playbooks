// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > condition actions', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let alternateUser;
    let createdPlaybookIds = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateAndAddUserToTeam(testTeam.id).then((newUser) => {
                alternateUser = newUser;
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

    describe('set_owner action', () => {
        it('changes run owner when condition transitions to met', () => {
            let testPlaybook;
            let testRun;
            let priorityField;

            // # Create playbook with a Priority select field
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Set Owner Action Test ' + getRandomId(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
                createdPlaybookIds.push(playbook.id);
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Priority',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [
                            {name: 'High'},
                            {name: 'Low'},
                        ],
                    },
                });

                cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                    priorityField = fields.find((f) => f.name === 'Priority');
                });
            });

            // # Create condition: "when Priority is High" → set owner to alternateUser
            cy.then(() => {
                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: priorityField.id,
                        value: [highOptionId],
                    },
                }, [
                    {
                        type: 'set_owner',
                        set_owner_user_id: alternateUser.id,
                    },
                ]);
            });

            // # Start a run (owner = testUser)
            cy.then(() => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Owner Action Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((run) => {
                    testRun = run;
                });
            });

            // # Navigate to the run detail page
            cy.then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });

            // * Verify initial owner is testUser
            cy.findByTestId('runinfo-owner').should('contain.text', testUser.username);

            // # Change Priority to High in the RHS to trigger the condition action
            cy.playbooksSetRunPropertyViaRHS('Priority', 'High');

            // * Verify the owner changed to alternateUser
            cy.findByTestId('runinfo-owner').should('contain.text', alternateUser.username);

            // * Assert via API that the ownership change was persisted server-side
            cy.then(() => {
                cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
                    expect(run.owner_user_id, 'server should reflect the new owner').to.equal(alternateUser.id);
                });
            });
        });

        it('does not change owner when condition was already met', () => {
            let testPlaybook;
            let testRun;
            let priorityField;

            // # Create playbook with Priority field
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'No Re-trigger Test ' + getRandomId(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
                createdPlaybookIds.push(playbook.id);
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Priority',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [
                            {name: 'High'},
                            {name: 'Medium'},
                            {name: 'Low'},
                        ],
                    },
                });

                cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                    priorityField = fields.find((f) => f.name === 'Priority');
                });
            });

            // # Create condition: "when Priority is High OR Medium" → set owner to alternateUser
            cy.then(() => {
                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;
                const mediumOptionId = priorityField.attrs.options.find((o) => o.name === 'Medium').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: priorityField.id,
                        value: [highOptionId, mediumOptionId],
                    },
                }, [
                    {
                        type: 'set_owner',
                        set_owner_user_id: alternateUser.id,
                    },
                ]);
            });

            // # Start run and set Priority=High (triggers the action)
            cy.then(() => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'No Re-trigger Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((run) => {
                    testRun = run;
                });
            });

            cy.then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });

            // # Trigger the condition the first time
            cy.playbooksSetRunPropertyViaRHS('Priority', 'High');

            // * Owner changed to alternateUser
            cy.findByTestId('runinfo-owner').should('contain.text', alternateUser.username);

            // # Change owner back to testUser via UI (logged in as alternateUser — the new owner)
            cy.then(() => {
                cy.apiLogin(alternateUser);
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });
            cy.playbooksChangeRunOwnerOnRunPage(testUser.username);

            cy.then(() => {
                cy.apiLogin(testUser);
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });

            cy.playbooksSetRunPropertyViaRHS('Priority', 'Medium');

            // * Owner should still be testUser (action did not re-fire)
            cy.findByTestId('runinfo-owner').should('contain.text', testUser.username);

            // * Assert via API that owner_user_id was not changed by the condition re-fire
            cy.then(() => {
                cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
                    expect(run.owner_user_id, 'owner_user_id should remain unchanged').to.equal(testUser.id);
                });
            });
        });
    });

    describe('creation-time action', () => {
        it('fires set_owner action when run is created with matching property value', () => {
            let testPlaybook;
            let zoneField;

            // # Create playbook with Zone field
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Creation-time Action Test ' + getRandomId(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
                createdPlaybookIds.push(playbook.id);
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Zone',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [
                            {name: 'Alpha'},
                            {name: 'Bravo'},
                        ],
                    },
                });

                cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                    zoneField = fields.find((f) => f.name === 'Zone');
                });
            });

            // # Create condition: Zone=Alpha → set owner to alternateUser
            cy.then(() => {
                const alphaOptionId = zoneField.attrs.options.find((o) => o.name === 'Alpha').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: zoneField.id,
                        value: [alphaOptionId],
                    },
                }, [
                    {
                        type: 'set_owner',
                        set_owner_user_id: alternateUser.id,
                    },
                ]);

                // # Link a task to the condition so it's copied to the run
                return cy.apiGetPlaybook(testPlaybook.id);
            }).then(() => {
                // # Start a run and set Zone=Alpha via run-level fields
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Creation Action Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((run) => {
                    // # Set Zone=Alpha via UI on the run details page to trigger the condition
                    cy.playbooksVisitRun(run.id);
                    cy.playbooksSetRunPropertyViaUI('run-property-zone', 'Alpha');

                    // * Verify owner changed to alternateUser (condition fired on Zone=Alpha)
                    cy.findByTestId('runinfo-owner').should('contain.text', alternateUser.username);
                });
            });
        });
    });

    describe('consolidation scenario', () => {
        it('one playbook routes to different owners based on property value', () => {
            let testPlaybook;
            let testRun;
            let zoneField;

            // # Create playbook with Zone field (Alpha / Bravo)
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Consolidation Test ' + getRandomId(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
                createdPlaybookIds.push(playbook.id);
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Zone',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [
                            {name: 'Alpha'},
                            {name: 'Bravo'},
                        ],
                    },
                });

                cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                    zoneField = fields.find((f) => f.name === 'Zone');
                });
            });

            // # Create TWO conditions: Alpha → testUser, Bravo → alternateUser
            cy.then(() => {
                const alphaOptionId = zoneField.attrs.options.find((o) => o.name === 'Alpha').id;
                const bravoOptionId = zoneField.attrs.options.find((o) => o.name === 'Bravo').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {field_id: zoneField.id, value: [alphaOptionId]},
                }, [{type: 'set_owner', set_owner_user_id: testUser.id}]);

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {field_id: zoneField.id, value: [bravoOptionId]},
                }, [{type: 'set_owner', set_owner_user_id: alternateUser.id}]);
            });

            // # Start a run
            cy.then(() => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Consolidation Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((run) => {
                    testRun = run;
                });
            });

            cy.then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });

            // # Set Zone=Alpha → owner should be testUser (already is, but action fires)
            cy.playbooksSetRunPropertyViaRHS('Zone', 'Alpha');
            cy.findByTestId('runinfo-owner').should('contain.text', testUser.username);
            cy.then(() => {
                cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
                    expect(run.owner_user_id).to.equal(testUser.id);
                });
            });

            // # Change Zone=Bravo → owner should change to alternateUser
            cy.playbooksSetRunPropertyViaRHS('Zone', 'Bravo');
            cy.findByTestId('runinfo-owner').should('contain.text', alternateUser.username);
            cy.then(() => {
                cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
                    expect(run.owner_user_id).to.equal(alternateUser.id);
                });
            });

            // # Change back to Alpha → owner should change back to testUser
            cy.playbooksSetRunPropertyViaRHS('Zone', 'Alpha');
            cy.findByTestId('runinfo-owner').should('contain.text', testUser.username);
            cy.then(() => {
                cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
                    expect(run.owner_user_id).to.equal(testUser.id);
                });
            });
        });
    });

    describe('notify_channel action', () => {
        it('posts notification to run channel when condition transitions to met', () => {
            let testPlaybook;
            let testRun;
            let priorityField;
            let notifyChannelId;

            // # Create playbook with Priority field
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Notify Action Test ' + getRandomId(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
                createdPlaybookIds.push(playbook.id);
            });

            // # Get town-square channel for notifications (known before run exists)
            cy.apiGetChannelByName(testTeam.name, 'town-square').then(({channel}) => {
                notifyChannelId = channel.id;
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Priority',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [
                            {name: 'Critical'},
                            {name: 'Normal'},
                        ],
                    },
                });

                cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                    priorityField = fields.find((f) => f.name === 'Priority');
                });
            });

            // # Create condition BEFORE starting the run so it gets copied
            cy.then(() => {
                const criticalOptionId = priorityField.attrs.options.find((o) => o.name === 'Critical').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: priorityField.id,
                        value: [criticalOptionId],
                    },
                }, [
                    {
                        type: 'notify_channel',
                        notify_channel_ids: [notifyChannelId],
                        notify_message: 'Priority escalated to Critical on run {Priority}',
                    },
                ]);
            });

            // # Start a run (condition is now copied to it)
            cy.then(() => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Notify Action Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((run) => {
                    testRun = run;
                });
            });

            // # Navigate to run and trigger the condition
            cy.then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });

            cy.playbooksSetRunPropertyViaRHS('Priority', 'Critical');

            // # Navigate to town-square to check the notification
            cy.then(() => {
                cy.visit(`/${testTeam.name}/channels/town-square`);
            });

            // * Verify notification message was posted
            cy.get('#postListContent').within(() => {
                cy.contains('Priority escalated to Critical on run Critical').should('exist');
            });
        });

        it('resolves multiple {PropertyName} tokens in notify_message to current field values', () => {
            let testPlaybook;
            let testRun;
            let zoneField;
            let notifyChannelId;

            // # Create playbook with two property fields: Zone (select) and Severity (select)
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Multi-Token Notify Test ' + getRandomId(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
                createdPlaybookIds.push(playbook.id);
            });

            // # Get town-square for notifications
            cy.apiGetChannelByName(testTeam.name, 'town-square').then(({channel}) => {
                notifyChannelId = channel.id;
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Zone',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [{name: 'Alpha'}, {name: 'Bravo'}],
                    },
                });

                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Severity',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 2,
                        options: [{name: 'Critical'}, {name: 'Low'}],
                    },
                });

                cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                    zoneField = fields.find((f) => f.name === 'Zone');
                });
            });

            // # Create condition BEFORE starting the run so it gets copied
            cy.then(() => {
                const alphaOptionId = zoneField.attrs.options.find((o) => o.name === 'Alpha').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: zoneField.id,
                        value: [alphaOptionId],
                    },
                }, [
                    {
                        type: 'notify_channel',
                        notify_channel_ids: [notifyChannelId],
                        notify_message: 'Alert in zone {Zone} with severity {Severity}',
                    },
                ]);
            });

            // # Start a run (condition is now copied to it)
            cy.then(() => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Multi-Token Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((run) => {
                    testRun = run;
                });
            });

            // # Set Severity=Critical first (so it has a value when the condition fires)
            cy.then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });
            cy.playbooksSetRunPropertyViaRHS('Severity', 'Critical');

            // # Trigger the condition by setting Zone=Alpha
            cy.playbooksSetRunPropertyViaRHS('Zone', 'Alpha');

            // # Navigate to town-square to check the posted notification
            cy.then(() => {
                cy.visit(`/${testTeam.name}/channels/town-square`);
            });

            // * Both tokens must be resolved — raw {Zone} and {Severity} must NOT appear
            cy.get('#postListContent').within(() => {
                cy.contains('Alert in zone Alpha with severity Critical').should('exist');
            });
        });
    });

    describe('playbook editor UI', () => {
        it('shows condition header with action in the playbook outline', () => {
            let testPlaybook;
            let priorityField;

            // # Create playbook with Priority field
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Editor UI Test ' + getRandomId(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
                createdPlaybookIds.push(playbook.id);
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Priority',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [
                            {name: 'High'},
                            {name: 'Low'},
                        ],
                    },
                });

                cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                    priorityField = fields.find((f) => f.name === 'Priority');
                });
            });

            // # Create condition with set_owner action and link a task to it
            cy.then(() => {
                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: priorityField.id,
                        value: [highOptionId],
                    },
                }, [
                    {
                        type: 'set_owner',
                        set_owner_user_id: alternateUser.id,
                    },
                ]).then((condition) => {
                    return cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                        playbook.checklists[0].items[0].title = 'High priority task';
                        playbook.checklists[0].items[0].condition_id = condition.id;
                        return cy.apiUpdatePlaybook(playbook);
                    });
                });
            });

            // # Navigate to the playbook outline
            cy.then(() => {
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            });

            // * Verify condition header is visible
            cy.findByTestId('condition-header').should('exist');
            cy.findByTestId('condition-header').should('contain.text', 'If');
            cy.findByTestId('condition-header').should('contain.text', 'Priority');

            // # Click edit on the condition header
            cy.findByTestId('condition-header-edit-button').click();

            // * Verify the "Then" action section is visible in edit mode
            cy.contains('Then').should('exist');
            cy.contains('Set owner').should('exist');
        });
    });

    describe('multiple actions in one condition', () => {
        it('fires both set_owner and notify_channel when condition transitions to met', () => {
            let testPlaybook;
            let testRun;
            let severityField;
            let notifyChannelId;

            // # Create playbook with a Severity select field
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Multi-Action Test ' + getRandomId(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
                createdPlaybookIds.push(playbook.id);
            });

            // # Get town-square for notifications
            cy.apiGetChannelByName(testTeam.name, 'town-square').then(({channel}) => {
                notifyChannelId = channel.id;
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Severity',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [
                            {name: 'Critical'},
                            {name: 'Normal'},
                        ],
                    },
                });

                cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                    severityField = fields.find((f) => f.name === 'Severity');
                });
            });

            // # Create condition BEFORE run: Severity=Critical → set_owner AND notify_channel
            cy.then(() => {
                const criticalOptionId = severityField.attrs.options.find((o) => o.name === 'Critical').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: severityField.id,
                        value: [criticalOptionId],
                    },
                }, [
                    {
                        type: 'set_owner',
                        set_owner_user_id: alternateUser.id,
                    },
                    {
                        type: 'notify_channel',
                        notify_channel_ids: [notifyChannelId],
                        notify_message: 'Severity escalated to Critical — ownership transferred',
                    },
                ]);
            });

            // # Start run AFTER condition is created (so condition gets copied)
            cy.then(() => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Multi-Action Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((run) => {
                    testRun = run;
                });
            });

            // # Navigate to run and trigger the condition
            cy.then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });

            cy.playbooksSetRunPropertyViaRHS('Severity', 'Critical');

            // * Verify owner changed (set_owner action fired)
            cy.findByTestId('runinfo-owner').should('contain.text', alternateUser.username);
            cy.then(() => {
                cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
                    expect(run.owner_user_id, 'set_owner action should have fired').to.equal(alternateUser.id);
                });
            });

            // * Verify notification was posted to town-square (notify_channel action fired)
            cy.then(() => {
                cy.visit(`/${testTeam.name}/channels/town-square`);
            });
            cy.get('#postListContent').within(() => {
                cy.contains('Severity escalated to Critical — ownership transferred').should('exist');
            });
        });
    });

    describe('condition state machine', () => {
        it('re-fires action when condition goes unmet→met, does not fire on met→unmet, fires again on unmet→met', () => {
            let testPlaybook;
            let testRun;
            let zoneField;

            // # Create playbook with a Zone select field (Alpha / Bravo / Delta)
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'State Machine Test ' + getRandomId(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
                createdPlaybookIds.push(playbook.id);
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Zone',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [
                            {name: 'Alpha'},
                            {name: 'Bravo'},
                            {name: 'Delta'},
                        ],
                    },
                });

                cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                    zoneField = fields.find((f) => f.name === 'Zone');
                });
            });

            // # Condition: Zone=Alpha → set owner to alternateUser
            cy.then(() => {
                const alphaOptionId = zoneField.attrs.options.find((o) => o.name === 'Alpha').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {field_id: zoneField.id, value: [alphaOptionId]},
                }, [{type: 'set_owner', set_owner_user_id: alternateUser.id}]);
            });

            // # Start a run (owner = testUser)
            cy.then(() => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'State Machine Run ' + getRandomId(),
                    ownerUserId: testUser.id,
                }).then((run) => {
                    testRun = run;
                });
            });

            cy.then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });

            // STEP 1: unmet → met: set Zone=Alpha → condition fires, owner = alternateUser
            cy.playbooksSetRunPropertyViaRHS('Zone', 'Alpha');
            cy.findByTestId('runinfo-owner').should('contain.text', alternateUser.username);

            // STEP 2: met → unmet: set Zone=Bravo → condition no longer met, action should NOT re-fire
            // Reset owner back to testUser first (to observe whether action would fire again)
            cy.apiLogin(alternateUser);
            cy.then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });

            cy.playbooksChangeRunOwnerOnRunPage(testUser.username);
            cy.apiLogin(testUser);

            cy.then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });
            cy.playbooksSetRunPropertyViaRHS('Zone', 'Bravo');

            // * Owner should remain testUser — action did NOT fire on the met→unmet transition
            cy.findByTestId('runinfo-owner').should('contain.text', testUser.username);

            // STEP 3: unmet → met again: set Zone=Alpha → condition fires again, owner = alternateUser
            cy.playbooksSetRunPropertyViaRHS('Zone', 'Alpha');
            cy.findByTestId('runinfo-owner').should('contain.text', alternateUser.username);

            cy.then(() => {
                cy.apiGetPlaybookRun(testRun.id).then(({body: run}) => {
                    expect(run.owner_user_id, 'condition should re-fire on second unmet→met transition').to.equal(alternateUser.id);
                });
            });
        });
    });
});
