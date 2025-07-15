// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaybookRun} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

import {applyChecklistItemUpdate, applyChecklistUpdate, applyIncrementalUpdate} from './playbook_run_updates';

describe('playbook_run_updates utilities', () => {
    // Create a test playbook run for testing
    const testPlaybookRun: PlaybookRun = {
        id: 'run_123',
        team_id: 'team_456',
        channel_id: 'channel_789',
        name: 'Test Run',
        owner_user_id: 'user_1',
        checklists: [
            {
                id: 'checklist_1',
                title: 'Test Checklist',
                update_at: 1000,
                items: [
                    {
                        id: 'item_1',
                        title: 'Test Item',
                        state: 'Open',
                        state_modified: 0,
                        assignee_id: '',
                        assignee_modified: 0,
                        command: '',
                        description: '',
                        command_last_run: 0,
                        due_date: 0,
                        task_actions: [],
                        update_at: 1000,
                    },
                ],
            },
        ],
        create_at: 1000,
        update_at: 1000,
        end_at: 0,
        post_id: '',
        participant_ids: [],
        timeline_events: [],
        status_posts: [],
        reporter_user_id: '',
        broadcast_channel_ids: [],
        status_update_enabled: false,
        previous_reminder: 0,
        reminder_post_id: '',
        reminder_message_template: '',
        reminder_timer_default_seconds: 0,
        last_status_update_at: 0,
        metrics_data: [],
        retrospective: '',
        retrospective_published_at: 0,
        retrospective_was_canceled: false,
        retrospective_reminder_interval_seconds: 0,
        retrospective_enabled: false,
        webhook_on_status_update_urls: [],
        status_update_broadcast_channels_enabled: false,
        status_update_broadcast_webhooks_enabled: false,
        create_channel_member_on_new_participant: false,
        remove_channel_member_on_removed_participant: false,
        playbook_id: '',
        summary: '',
        summary_modified_at: 0,
        current_status: 'InProgress' as any,
        type: PlaybookRunType.Playbook,
        items_order: ['checklist_1'],
    };

    describe('applyIncrementalUpdate', () => {
        it('should apply simple field updates', () => {
            const update = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    name: 'Updated Name',
                    owner_user_id: 'user_2',
                },
            };

            const result = applyIncrementalUpdate(testPlaybookRun, update);

            expect(result.name).toBe('Updated Name');
            expect(result.owner_user_id).toBe('user_2');
            expect(result.id).toBe(testPlaybookRun.id); // Unchanged
            expect(result.team_id).toBe(testPlaybookRun.team_id); // Unchanged
        });

        it('should not mutate the original run', () => {
            const update = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    name: 'Updated Name',
                },
            };

            const result = applyIncrementalUpdate(testPlaybookRun, update);

            expect(result).not.toBe(testPlaybookRun); // Different objects
            expect(testPlaybookRun.name).toBe('Test Run'); // Original unchanged
            expect(result.name).toBe('Updated Name'); // Result changed
        });
    });

    describe('applyChecklistUpdate', () => {
        it('should update checklist fields', () => {
            const payload = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'checklist_1',
                    index: 0,
                    checklist_updated_at: 2000,
                    fields: {
                        title: 'Updated Checklist Title',
                    },
                },
            };

            const result = applyChecklistUpdate(testPlaybookRun, payload);

            expect(result.checklists[0].title).toBe('Updated Checklist Title');
            expect(result.checklists[0].items.length).toBe(1); // Items preserved
        });

        it('should handle item insertions without duplicates', () => {
            const newItem = {
                id: 'item_2',
                title: 'New Item',
                state: 'Open',
                state_modified: 0,
                assignee_id: '',
                assignee_modified: 0,
                command: '',
                description: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
            };

            const payload = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'checklist_1',
                    index: 0,
                    checklist_updated_at: 2000,
                    item_inserts: [newItem],
                },
            };

            const result = applyChecklistUpdate(testPlaybookRun, payload);

            expect(result.checklists[0].items.length).toBe(2);
            expect(result.checklists[0].items[1]).toMatchObject({
                id: 'item_2',
                title: 'New Item',
            });

            // Applying the same update again should not create duplicates
            const result2 = applyChecklistUpdate(result, payload);
            expect(result2.checklists[0].items.length).toBe(2); // Still 2, no duplicates
        });

        it('should skip updates for older timestamps', () => {
            // First update checklist to timestamp 2000
            const firstPayload = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'checklist_1',
                    index: 0,
                    checklist_updated_at: 2000,
                    fields: {
                        title: 'First Update',
                    },
                },
            };

            // Apply the first update to get a result with proper timestamp
            const firstResult = applyChecklistUpdate(testPlaybookRun, firstPayload);

            // Try to apply an older update (timestamp 1500)
            const olderPayload = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'checklist_1',
                    index: 0,
                    checklist_updated_at: 1500,
                    fields: {
                        title: 'Older Update',
                    },
                },
            };

            const result = applyChecklistUpdate(firstResult, olderPayload);

            // Should remain unchanged due to older timestamp
            expect(result.checklists[0].title).toBe('First Update');
        });

        it('should create new checklist for non-existent checklist', () => {
            const payload = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'non_existent_checklist',
                    index: 0,
                    checklist_updated_at: 2000,
                    fields: {
                        title: 'Updated Title',
                    },
                },
            };

            const result = applyChecklistUpdate(testPlaybookRun, payload);

            // Should create new checklist when it doesn't exist
            expect(result.checklists).toHaveLength(2);
            expect(result.checklists[1]).toMatchObject({
                id: 'non_existent_checklist',
                title: 'Updated Title',
                update_at: 2000,
            });
            expect(result.checklists[1].items).toHaveLength(0);
        });
    });

    describe('applyChecklistItemUpdate', () => {
        it('should update item fields', () => {
            const payload = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: 'checklist_1',
                update: {
                    id: 'item_1',
                    index: 0,
                    checklist_item_updated_at: 2000,
                    fields: {
                        state: 'Closed',
                        assignee_id: 'user_2',
                    },
                },
            };

            const result = applyChecklistItemUpdate(testPlaybookRun, payload);

            expect(result.checklists[0].items[0].state).toBe('Closed');
            expect(result.checklists[0].items[0].assignee_id).toBe('user_2');
            expect(result.checklists[0].items[0].title).toBe('Test Item'); // Unchanged
        });

        it('should skip updates for older timestamps', () => {
            // First update item to timestamp 2000
            const firstPayload = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: 'checklist_1',
                update: {
                    id: 'item_1',
                    index: 0,
                    checklist_item_updated_at: 2000,
                    fields: {
                        state: 'Closed',
                    },
                },
            };

            // Apply the first update to get a result with proper timestamp
            const firstResult = applyChecklistItemUpdate(testPlaybookRun, firstPayload);

            // Try to apply an older update (timestamp 1500)
            const olderPayload = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: 'checklist_1',
                update: {
                    id: 'item_1',
                    index: 0,
                    checklist_item_updated_at: 1500,
                    fields: {
                        state: 'Open',
                    },
                },
            };

            const result = applyChecklistItemUpdate(firstResult, olderPayload);

            // Should remain unchanged due to older timestamp
            expect(result.checklists[0].items[0].state).toBe('Closed');
        });

        it('should return unchanged for non-existent checklist', () => {
            const payload = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: 'non_existent_checklist',
                update: {
                    id: 'item_1',
                    index: 0,
                    checklist_item_updated_at: 2000,
                    fields: {
                        state: 'Closed',
                    },
                },
            };

            const result = applyChecklistItemUpdate(testPlaybookRun, payload);

            expect(result).toBe(testPlaybookRun); // Same object, unchanged
        });

        it('should return unchanged for non-existent item', () => {
            const payload = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: 'checklist_1',
                update: {
                    id: 'non_existent_item',
                    index: 0,
                    checklist_item_updated_at: 2000,
                    fields: {
                        state: 'Closed',
                    },
                },
            };

            const result = applyChecklistItemUpdate(testPlaybookRun, payload);

            expect(result).toBe(testPlaybookRun); // Same object, unchanged
        });

        it('should not mutate the original run', () => {
            const payload = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: 'checklist_1',
                update: {
                    id: 'item_1',
                    index: 0,
                    checklist_item_updated_at: 2000,
                    fields: {
                        state: 'Closed',
                    },
                },
            };

            const result = applyChecklistItemUpdate(testPlaybookRun, payload);

            expect(result).not.toBe(testPlaybookRun); // Different objects
            expect(testPlaybookRun.checklists[0].items[0].state).toBe('Open'); // Original unchanged
            expect(result.checklists[0].items[0].state).toBe('Closed'); // Result changed
        });
    });

    describe('NEW CHECKLIST CREATION TESTS - Bug Fix Validation', () => {
        it('applyChecklistUpdate should create new checklist when not found', () => {
            const payload = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'brand_new_checklist',
                    index: 1,
                    checklist_updated_at: 2000,
                    fields: {
                        title: 'New Checklist Created',
                    },
                    item_inserts: [
                        {
                            id: 'new_item_1',
                            title: 'New Item 1',
                            state: 'Open',
                            state_modified: 0,
                            assignee_id: 'user_1',
                            assignee_modified: 0,
                            command: '',
                            description: '',
                            command_last_run: 0,
                            due_date: 0,
                            task_actions: [],
                        },
                    ],
                },
            };

            const result = applyChecklistUpdate(testPlaybookRun, payload);

            // Should create a new checklist
            expect(result.checklists).toHaveLength(2);
            expect(result.checklists[1]).toMatchObject({
                id: 'brand_new_checklist',
                title: 'New Checklist Created',
                update_at: 2000,
            });
            expect(result.checklists[1].items).toHaveLength(1);
            expect(result.checklists[1].items[0]).toMatchObject({
                id: 'new_item_1',
                title: 'New Item 1',
                assignee_id: 'user_1',
            });
        });

        it('applyChecklistUpdate should create new checklist with empty items when no item_inserts', () => {
            const payload = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'empty_checklist',
                    index: 1,
                    checklist_updated_at: 2000,
                    fields: {
                        title: 'Empty New Checklist',
                    },
                },
            };

            const result = applyChecklistUpdate(testPlaybookRun, payload);

            // Should create a new checklist with empty items
            expect(result.checklists).toHaveLength(2);
            expect(result.checklists[1]).toMatchObject({
                id: 'empty_checklist',
                title: 'Empty New Checklist',
                update_at: 2000,
            });
            expect(result.checklists[1].items).toHaveLength(0);
        });

        it('applyChecklistUpdate should handle new checklist creation idempotently', () => {
            const payload = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'idempotent_checklist',
                    index: 1,
                    checklist_updated_at: 2000,
                    fields: {
                        title: 'Idempotent Checklist',
                    },
                    item_inserts: [
                        {
                            id: 'item_x',
                            title: 'Item X',
                            state: 'Open',
                            state_modified: 0,
                            assignee_id: '',
                            assignee_modified: 0,
                            command: '',
                            description: '',
                            command_last_run: 0,
                            due_date: 0,
                            task_actions: [],
                        },
                    ],
                },
            };

            // Apply the same update twice
            const result1 = applyChecklistUpdate(testPlaybookRun, payload);
            const result2 = applyChecklistUpdate(result1, payload);

            // Should not create duplicates
            expect(result1.checklists).toHaveLength(2);
            expect(result2.checklists).toHaveLength(2);
            expect(result2.checklists[1].id).toBe('idempotent_checklist');
            expect(result2.checklists[1].items).toHaveLength(1);
        });

        it('applyChecklistUpdate should reject older timestamps for new checklist creation', () => {
            // First create a checklist with timestamp 2000
            const firstPayload = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'timestamp_test_checklist',
                    index: 1,
                    checklist_updated_at: 2000,
                    fields: {
                        title: 'First Version',
                    },
                },
            };

            const result1 = applyChecklistUpdate(testPlaybookRun, firstPayload);

            // Try to apply older update (timestamp 1500)
            const olderPayload = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'timestamp_test_checklist',
                    index: 1,
                    checklist_updated_at: 1500,
                    fields: {
                        title: 'Older Version',
                    },
                },
            };

            const result2 = applyChecklistUpdate(result1, olderPayload);

            // Should remain unchanged due to older timestamp
            expect(result2.checklists[1].title).toBe('First Version');
            expect(result2.checklists[1].update_at).toBe(2000);
        });

        it('applyChecklistUpdates should create new checklist when not found', () => {
            // Test the non-idempotent version
            const update = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    checklists: [
                        {
                            id: 'another_new_checklist',
                            index: 1,
                            checklist_updated_at: 2000,
                            fields: {
                                title: 'Another New Checklist',
                            },
                            item_inserts: [
                                {
                                    id: 'another_item',
                                    title: 'Another Item',
                                    state: 'Closed',
                                    state_modified: 2000,
                                    assignee_id: 'user_2',
                                    assignee_modified: 1900,
                                    command: '/test command',
                                    description: 'Test description',
                                    command_last_run: 0,
                                    due_date: 1234567890,
                                    task_actions: [],
                                },
                            ],
                        },
                    ],
                },
            };

            const result = applyIncrementalUpdate(testPlaybookRun, update);

            // Should create a new checklist
            expect(result.checklists).toHaveLength(2);
            expect(result.checklists[1]).toMatchObject({
                id: 'another_new_checklist',
                title: 'Another New Checklist',
            });
            expect(result.checklists[1].items).toHaveLength(1);
            expect(result.checklists[1].items[0]).toMatchObject({
                id: 'another_item',
                title: 'Another Item',
                state: 'Closed',
                assignee_id: 'user_2',
                command: '/test command',
                description: 'Test description',
                due_date: 1234567890,
            });
        });
    });

    describe('DELETION SCENARIOS TESTS', () => {
        describe('checklist item deletion', () => {
            it('should delete checklist items using item_deletes', () => {
                // First add another item to the checklist
                const runWithMultipleItems = {
                    ...testPlaybookRun,
                    checklists: [{
                        ...testPlaybookRun.checklists[0],
                        items: [
                            ...testPlaybookRun.checklists[0].items,
                            {
                                id: 'item_2',
                                title: 'Second Item',
                                state: 'Open',
                                state_modified: 0,
                                assignee_id: '',
                                assignee_modified: 0,
                                command: '',
                                description: '',
                                command_last_run: 0,
                                due_date: 0,
                                task_actions: [],
                                update_at: 1000,
                            },
                        ],
                    }],
                };

                const update = {
                    id: runWithMultipleItems.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'checklist_1',
                                index: 0,
                                checklist_updated_at: 2000,
                                item_deletes: ['item_1'],
                            },
                        ],
                    },
                };

                const result = applyIncrementalUpdate(runWithMultipleItems, update);

                expect(result.checklists[0].items).toHaveLength(1);
                expect(result.checklists[0].items[0].id).toBe('item_2');
                expect(result.checklists[0].items.find((item) => item.id === 'item_1')).toBeUndefined();
            });

            it('should handle deletion of multiple items', () => {
                const runWithMultipleItems = {
                    ...testPlaybookRun,
                    checklists: [{
                        ...testPlaybookRun.checklists[0],
                        items: [
                            ...testPlaybookRun.checklists[0].items,
                            {
                                id: 'item_2',
                                title: 'Second Item',
                                state: 'Open',
                                state_modified: 0,
                                assignee_id: '',
                                assignee_modified: 0,
                                command: '',
                                description: '',
                                command_last_run: 0,
                                due_date: 0,
                                task_actions: [],
                                update_at: 1000,
                            },
                            {
                                id: 'item_3',
                                title: 'Third Item',
                                state: 'Open',
                                state_modified: 0,
                                assignee_id: '',
                                assignee_modified: 0,
                                command: '',
                                description: '',
                                command_last_run: 0,
                                due_date: 0,
                                task_actions: [],
                                update_at: 1000,
                            },
                        ],
                    }],
                };

                const update = {
                    id: runWithMultipleItems.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'checklist_1',
                                index: 0,
                                checklist_updated_at: 2000,
                                item_deletes: ['item_1', 'item_3'],
                            },
                        ],
                    },
                };

                const result = applyIncrementalUpdate(runWithMultipleItems, update);

                expect(result.checklists[0].items).toHaveLength(1);
                expect(result.checklists[0].items[0].id).toBe('item_2');
                expect(result.checklists[0].items.find((item) => item.id === 'item_1')).toBeUndefined();
                expect(result.checklists[0].items.find((item) => item.id === 'item_3')).toBeUndefined();
            });

            it('should handle deletion of non-existent items gracefully', () => {
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'checklist_1',
                                index: 0,
                                checklist_updated_at: 2000,
                                item_deletes: ['non_existent_item', 'another_missing_item'],
                            },
                        ],
                    },
                };

                const result = applyIncrementalUpdate(testPlaybookRun, update);

                // Should remain unchanged since items don't exist
                expect(result.checklists[0].items).toHaveLength(1);
                expect(result.checklists[0].items[0].id).toBe('item_1');
            });
        });

        describe('checklist item deletion in idempotent updates', () => {
            it('should delete items in applyChecklistUpdate', () => {
                const runWithMultipleItems = {
                    ...testPlaybookRun,
                    checklists: [{
                        ...testPlaybookRun.checklists[0],
                        items: [
                            ...testPlaybookRun.checklists[0].items,
                            {
                                id: 'item_2',
                                title: 'Second Item',
                                state: 'Open',
                                state_modified: 0,
                                assignee_id: '',
                                assignee_modified: 0,
                                command: '',
                                description: '',
                                command_last_run: 0,
                                due_date: 0,
                                task_actions: [],
                                update_at: 1000,
                            },
                        ],
                    }],
                };

                const payload = {
                    playbook_run_id: runWithMultipleItems.id,
                    update: {
                        id: 'checklist_1',
                        index: 0,
                        checklist_updated_at: 2000,
                        item_deletes: ['item_1'],
                    },
                };

                const result = applyChecklistUpdate(runWithMultipleItems, payload);

                expect(result.checklists[0].items).toHaveLength(1);
                expect(result.checklists[0].items[0].id).toBe('item_2');
            });
        });

        describe('checklist deletion', () => {
            it('should delete entire checklists using checklist_deletes', () => {
                const runWithMultipleChecklists = {
                    ...testPlaybookRun,
                    checklists: [
                        testPlaybookRun.checklists[0],
                        {
                            id: 'checklist_2',
                            title: 'Second Checklist',
                            items: [
                                {
                                    id: 'item_2',
                                    title: 'Second Item',
                                    state: 'Open',
                                    state_modified: 0,
                                    assignee_id: '',
                                    assignee_modified: 0,
                                    command: '',
                                    description: '',
                                    command_last_run: 0,
                                    due_date: 0,
                                    task_actions: [],
                                    update_at: 1000,
                                },
                            ],
                        },
                    ],
                };

                const update = {
                    id: runWithMultipleChecklists.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {},
                    checklist_deletes: ['checklist_2'],
                };

                const result = applyIncrementalUpdate(runWithMultipleChecklists, update);
                expect(result.checklists).toHaveLength(1);
                expect(result.checklists[0].id).toBe('checklist_1');
                expect(result.checklists.find((checklist) => checklist.id === 'checklist_2')).toBeUndefined();
            });

            it('should handle deletion of multiple checklists', () => {
                const runWithMultipleChecklists = {
                    ...testPlaybookRun,
                    checklists: [
                        testPlaybookRun.checklists[0],
                        {
                            id: 'checklist_2',
                            title: 'Second Checklist',
                            items: [],
                        },
                        {
                            id: 'checklist_3',
                            title: 'Third Checklist',
                            items: [],
                        },
                    ],
                };

                const update = {
                    id: runWithMultipleChecklists.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {},
                    checklist_deletes: ['checklist_2', 'checklist_3'],
                };

                const result = applyIncrementalUpdate(runWithMultipleChecklists, update);
                expect(result.checklists).toHaveLength(1);
                expect(result.checklists[0].id).toBe('checklist_1');
            });

            it('should handle deletion of non-existent checklists gracefully', () => {
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {},
                    checklist_deletes: ['non_existent_checklist'],
                };

                const result = applyIncrementalUpdate(testPlaybookRun, update);
                expect(result.checklists).toHaveLength(1);
                expect(result.checklists[0].id).toBe('checklist_1');
            });
        });
    });

    describe('REORDERING SCENARIOS TESTS', () => {
        describe('checklist reordering', () => {
            it('should handle checklist reordering via items_order field', () => {
                const runWithMultipleChecklists = {
                    ...testPlaybookRun,
                    checklists: [
                        testPlaybookRun.checklists[0],
                        {
                            id: 'checklist_2',
                            title: 'Second Checklist',
                            update_at: 1000,
                            items: [],
                        },
                        {
                            id: 'checklist_3',
                            title: 'Third Checklist',
                            update_at: 1000,
                            items: [],
                        },
                    ],
                    items_order: ['checklist_1', 'checklist_2', 'checklist_3'],
                };

                const update = {
                    id: runWithMultipleChecklists.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        items_order: ['checklist_3', 'checklist_1', 'checklist_2'],
                    },
                };

                const result = applyIncrementalUpdate(runWithMultipleChecklists, update);

                expect(result.items_order).toEqual(['checklist_3', 'checklist_1', 'checklist_2']);

                // Original checklists array should remain unchanged (reordering is handled by items_order)
                expect(result.checklists).toHaveLength(3);
                expect(result.checklists[0].id).toBe('checklist_1');
                expect(result.checklists[1].id).toBe('checklist_2');
                expect(result.checklists[2].id).toBe('checklist_3');
            });
        });

        describe('checklist item reordering', () => {
            it('should handle item reordering within a checklist', () => {
                const runWithMultipleItems = {
                    ...testPlaybookRun,
                    checklists: [{
                        ...testPlaybookRun.checklists[0],
                        items: [
                            testPlaybookRun.checklists[0].items[0],
                            {
                                id: 'item_2',
                                title: 'Second Item',
                                state: 'Open',
                                state_modified: 0,
                                assignee_id: '',
                                assignee_modified: 0,
                                command: '',
                                description: '',
                                command_last_run: 0,
                                due_date: 0,
                                task_actions: [],
                                update_at: 1000,
                            },
                            {
                                id: 'item_3',
                                title: 'Third Item',
                                state: 'Open',
                                state_modified: 0,
                                assignee_id: '',
                                assignee_modified: 0,
                                command: '',
                                description: '',
                                command_last_run: 0,
                                due_date: 0,
                                task_actions: [],
                                update_at: 1000,
                            },
                        ],
                    }],
                };

                const update = {
                    id: runWithMultipleItems.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'checklist_1',
                                index: 0,
                                checklist_updated_at: 2000,
                                items_order: ['item_3', 'item_1', 'item_2'],
                            },
                        ],
                    },
                };

                const result = applyIncrementalUpdate(runWithMultipleItems, update);

                // Check that the items_order field was updated
                expect(result.checklists[0]).toHaveProperty('items_order');
                expect((result.checklists[0] as any).items_order).toEqual(['item_3', 'item_1', 'item_2']);
            });

            it('should handle item reordering in idempotent checklist updates', () => {
                const runWithMultipleItems = {
                    ...testPlaybookRun,
                    checklists: [{
                        ...testPlaybookRun.checklists[0],
                        items: [
                            testPlaybookRun.checklists[0].items[0],
                            {
                                id: 'item_2',
                                title: 'Second Item',
                                state: 'Open',
                                state_modified: 0,
                                assignee_id: '',
                                assignee_modified: 0,
                                command: '',
                                description: '',
                                command_last_run: 0,
                                due_date: 0,
                                task_actions: [],
                                update_at: 1000,
                            },
                        ],
                    }],
                };

                const payload = {
                    playbook_run_id: runWithMultipleItems.id,
                    update: {
                        id: 'checklist_1',
                        index: 0,
                        checklist_updated_at: 2000,
                        items_order: ['item_2', 'item_1'],
                    },
                };

                const result = applyChecklistUpdate(runWithMultipleItems, payload);

                expect((result.checklists[0] as any).items_order).toEqual(['item_2', 'item_1']);
            });
        });
    });

    describe('COMPREHENSIVE INCREMENTAL UPDATES FRAMEWORK TESTS', () => {
        describe('applyIncrementalUpdate - advanced scenarios', () => {
            it('should handle complex nested updates with timeline events', () => {
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 3000,
                    changed_fields: {
                        name: 'Complex Update Test',
                        owner_user_id: 'user_3',
                        status_update_enabled: true,
                        timeline_events: [
                            {
                                id: 'event_1',
                                playbook_run_id: testPlaybookRun.id,
                                create_at: 3000,
                                delete_at: 0,
                                event_at: 3000,
                                event_type: 'StatusUpdated' as any,
                                summary: 'Status updated to In Progress',
                                details: 'Automatic status update',
                                subject_user_id: 'user_3',
                                creator_user_id: 'user_3',
                                post_id: '',
                            },
                        ],
                        metrics_data: [
                            {
                                metric_config_id: 'metric_1',
                                value: 42,
                            },
                        ],
                        checklists: [
                            {
                                id: 'checklist_1',
                                index: 0,
                                checklist_updated_at: 3000,
                                fields: {
                                    title: 'Updated via Complex Update',
                                },
                                item_updates: [
                                    {
                                        id: 'item_1',
                                        index: 0,
                                        checklist_item_updated_at: 3000,
                                        fields: {
                                            state: 'Closed',
                                            assignee_id: 'user_3',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                };

                const result = applyIncrementalUpdate(testPlaybookRun, update);

                expect(result.name).toBe('Complex Update Test');
                expect(result.owner_user_id).toBe('user_3');
                expect(result.status_update_enabled).toBe(true);
                expect(result.timeline_events).toHaveLength(1);
                expect(result.metrics_data).toHaveLength(1);
                expect(result.checklists[0].title).toBe('Updated via Complex Update');
                expect(result.checklists[0].items[0].state).toBe('Closed');
                expect(result.checklists[0].items[0].assignee_id).toBe('user_3');
            });

            it('should preserve immutability with deep nested structures', () => {
                const originalRun = JSON.parse(JSON.stringify(testPlaybookRun));
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        checklists: [
                            {
                                id: 'checklist_1',
                                index: 0,
                                checklist_updated_at: 2000,
                                item_updates: [
                                    {
                                        id: 'item_1',
                                        index: 0,
                                        checklist_item_updated_at: 2000,
                                        fields: {
                                            task_actions: [{
                                                trigger: {
                                                    type: 'status_update' as any,
                                                    payload: '',
                                                },
                                                actions: [{
                                                    type: 'send_webhook' as any,
                                                    payload: 'http://example.com',
                                                }],
                                            }],
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                };

                const result = applyIncrementalUpdate(testPlaybookRun, update);

                // Verify deep immutability
                expect(result).not.toBe(testPlaybookRun);
                expect(result.checklists).not.toBe(testPlaybookRun.checklists);
                expect(result.checklists[0]).not.toBe(testPlaybookRun.checklists[0]);
                expect(result.checklists[0].items).not.toBe(testPlaybookRun.checklists[0].items);
                expect(result.checklists[0].items[0]).not.toBe(testPlaybookRun.checklists[0].items[0]);

                // Original should be unchanged
                expect(testPlaybookRun).toEqual(originalRun);
                expect(testPlaybookRun.checklists[0].items[0].task_actions).toHaveLength(0);

                // Result should have new data
                expect(result.checklists[0].items[0].task_actions).toHaveLength(1);
            });
        });

        describe('error handling and edge cases', () => {
            it('should handle updates with missing playbook_run_updated_at', () => {
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 0,
                    changed_fields: {
                        name: 'Update Without Timestamp',
                    },
                };

                const result = applyIncrementalUpdate(testPlaybookRun, update);

                expect(result.name).toBe('Update Without Timestamp');
                expect(result.update_at).toBe(testPlaybookRun.update_at); // Should preserve original
            });

            it('should handle empty changed_fields', () => {
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {},
                };

                const result = applyIncrementalUpdate(testPlaybookRun, update);

                expect(result).toEqual({
                    ...testPlaybookRun,
                    update_at: 2000,
                });
            });

            it('should handle null/undefined values in fields', () => {
                const update = {
                    id: testPlaybookRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        retrospective: null as any,
                        summary: null as any,
                        end_at: 0,
                    },
                };

                const result = applyIncrementalUpdate(testPlaybookRun, update);

                expect(result.retrospective).toBeNull();
                expect(result.summary).toBeNull();
                expect(result.end_at).toBe(0);
            });
        });

        describe('performance and memory optimization', () => {
            it('should handle updates to large checklists efficiently', () => {
                // Create a run with many checklists and items
                const largeRun = {
                    ...testPlaybookRun,
                    checklists: Array.from({length: 50}, (_, i) => ({
                        id: `checklist_${i}`,
                        title: `Checklist ${i}`,
                        update_at: 1000,
                        items: Array.from({length: 20}, (__, j) => ({
                            id: `item_${i}_${j}`,
                            title: `Item ${i}-${j}`,
                            state: 'Open' as any,
                            state_modified: 0,
                            assignee_id: '',
                            assignee_modified: 0,
                            command: '',
                            description: '',
                            command_last_run: 0,
                            due_date: 0,
                            task_actions: [],
                            update_at: 1000,
                        })),
                    })),
                };

                const update = {
                    id: largeRun.id,
                    playbook_run_updated_at: 2000,
                    changed_fields: {
                        name: 'Updated Large Run',
                        checklists: [
                            {
                                id: 'checklist_5',
                                index: 5,
                                checklist_updated_at: 2000,
                                fields: {
                                    title: 'Updated Checklist 5',
                                },
                                item_updates: [
                                    {
                                        id: 'item_5_10',
                                        index: 10,
                                        checklist_item_updated_at: 2000,
                                        fields: {
                                            state: 'Closed',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                };

                const startTime = performance.now();
                const result = applyIncrementalUpdate(largeRun, update);
                const endTime = performance.now();

                // Should complete quickly (less than 50ms for large update)
                expect(endTime - startTime).toBeLessThan(50);

                // Verify the specific updates were applied
                expect(result.name).toBe('Updated Large Run');
                expect(result.checklists[5].title).toBe('Updated Checklist 5');
                expect(result.checklists[5].items[10].state).toBe('Closed');

                // Other data should remain unchanged
                expect(result.checklists[0].title).toBe('Checklist 0');
                expect(result.checklists[10].items[5].state).toBe('Open');
            });
        });
    });

    // Test for checklist item move duplication issue (PR #2008)
    describe('checklist item move duplication prevention', () => {
        test('should prevent duplicate item insertions when multiple events arrive with different timestamps', () => {
            // Create a minimal run with two checklists for testing move operations
            const moveTestRun: PlaybookRun = {
                ...testPlaybookRun,
                checklists: [
                    {
                        id: 'checklist_1',
                        title: 'Source Checklist',
                        update_at: 1000,
                        items: [
                            {
                                id: 'item_to_move',
                                title: 'Item to Move',
                                state: 'Open',
                                state_modified: 1000,
                                assignee_id: '',
                                assignee_modified: 1000,
                                command: '',
                                description: '',
                                command_last_run: 0,
                                due_date: 0,
                                task_actions: [],
                                update_at: 1000,
                            },
                        ],
                    },
                    {
                        id: 'checklist_2',
                        title: 'Destination Checklist',
                        update_at: 1000,
                        items: [],
                    },
                ],
            };

            // First event: Move item to destination checklist
            const moveEvent1 = {
                playbook_run_id: 'run_123',
                update: {
                    id: 'checklist_2',
                    index: 1,
                    fields: {},
                    item_inserts: [
                        {
                            id: 'item_to_move',
                            title: 'Item to Move',
                            state: 'Open',
                            state_modified: 2000,
                            assignee_id: '',
                            assignee_modified: 2000,
                            command: '',
                            description: '',
                            command_last_run: 0,
                            due_date: 0,
                            task_actions: [],
                            update_at: 2000,
                        },
                    ],
                    checklist_updated_at: 2000,
                },
            };

            // Apply the first move event
            let updatedRun = applyChecklistUpdate(moveTestRun, moveEvent1);

            // Verify item was moved to destination checklist
            expect(updatedRun.checklists[1].items).toHaveLength(1);
            expect(updatedRun.checklists[1].items[0].id).toBe('item_to_move');

            // Second event: Duplicate move event with newer timestamp (simulates race condition)
            const moveEvent2 = {
                playbook_run_id: 'run_123',
                update: {
                    id: 'checklist_2',
                    index: 1,
                    fields: {},
                    item_inserts: [
                        {
                            id: 'item_to_move',
                            title: 'Item to Move',
                            state: 'Open',
                            state_modified: 2001,
                            assignee_id: '',
                            assignee_modified: 2001,
                            command: '',
                            description: '',
                            command_last_run: 0,
                            due_date: 0,
                            task_actions: [],
                            update_at: 2001,
                        },
                    ],
                    checklist_updated_at: 2001,
                },
            };

            // Apply the second (duplicate) move event
            updatedRun = applyChecklistUpdate(updatedRun, moveEvent2);

            // Verify no duplication occurred - should still be exactly 1 item
            expect(updatedRun.checklists[1].items).toHaveLength(1);
            expect(updatedRun.checklists[1].items[0].id).toBe('item_to_move');

            // The duplicate event should be ignored, preserving original timestamp
            expect(updatedRun.checklists[1].items[0].update_at).toBe(2000);
        });

        test('should handle rapid sequence of duplicate move events without creating duplicates', () => {
            const rapidMoveTestRun: PlaybookRun = {
                ...testPlaybookRun,
                checklists: [
                    {
                        id: 'checklist_1',
                        title: 'Checklist 1',
                        update_at: 1000,
                        items: [],
                    },
                    {
                        id: 'checklist_2',
                        title: 'Checklist 2',
                        update_at: 1000,
                        items: [],
                    },
                ],
            };

            let currentRun = rapidMoveTestRun;

            // Simulate rapid sequence of move events (like rapid drag and drop)
            for (let i = 0; i < 5; i++) {
                const timestamp = 2000 + i;
                const rapidMoveEvent = {
                    playbook_run_id: 'run_123',
                    update: {
                        id: 'checklist_2',
                        index: 1,
                        fields: {},
                        item_inserts: [
                            {
                                id: 'rapid_move_item',
                                title: 'Rapid Move Item',
                                state: 'Open',
                                state_modified: timestamp,
                                assignee_id: '',
                                assignee_modified: timestamp,
                                command: '',
                                description: '',
                                command_last_run: 0,
                                due_date: 0,
                                task_actions: [],
                                update_at: timestamp,
                            },
                        ],
                        checklist_updated_at: timestamp,
                    },
                };

                currentRun = applyChecklistUpdate(currentRun, rapidMoveEvent);
            }

            // After all rapid events, should still have exactly 1 item
            expect(currentRun.checklists[1].items).toHaveLength(1);
            expect(currentRun.checklists[1].items[0].id).toBe('rapid_move_item');

            // Should have the first timestamp (subsequent duplicates ignored)
            expect(currentRun.checklists[1].items[0].update_at).toBe(2000);
        });

        test('should prevent insertion of items that already exist in the same checklist', () => {
            const duplicateTestRun: PlaybookRun = {
                ...testPlaybookRun,
                checklists: [
                    {
                        id: 'checklist_1',
                        title: 'Test Checklist',
                        update_at: 1000,
                        items: [
                            {
                                id: 'existing_item',
                                title: 'Existing Item',
                                state: 'Open',
                                state_modified: 1000,
                                assignee_id: '',
                                assignee_modified: 1000,
                                command: '',
                                description: '',
                                command_last_run: 0,
                                due_date: 0,
                                task_actions: [],
                                update_at: 1000,
                            },
                        ],
                    },
                ],
            };

            // Attempt to insert the same item again
            const duplicateInsertEvent = {
                playbook_run_id: 'run_123',
                update: {
                    id: 'checklist_1',
                    index: 0,
                    fields: {},
                    item_inserts: [
                        {
                            id: 'existing_item', // Same ID as existing item
                            title: 'Existing Item',
                            state: 'Open',
                            state_modified: 2000,
                            assignee_id: '',
                            assignee_modified: 2000,
                            command: '',
                            description: '',
                            command_last_run: 0,
                            due_date: 0,
                            task_actions: [],
                            update_at: 2000,
                        },
                    ],
                    checklist_updated_at: 2000,
                },
            };

            const result = applyChecklistUpdate(duplicateTestRun, duplicateInsertEvent);

            // Should still have exactly 1 item (no duplicate created)
            expect(result.checklists[0].items).toHaveLength(1);
            expect(result.checklists[0].items[0].id).toBe('existing_item');

            // Original item should be preserved (duplicate event ignored)
            expect(result.checklists[0].items[0].update_at).toBe(1000);
        });
    });
});