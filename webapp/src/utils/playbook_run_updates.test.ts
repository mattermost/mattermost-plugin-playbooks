// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaybookRun} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

import {applyChecklistItemUpdateIdempotent, applyChecklistUpdateIdempotent, applyIncrementalUpdate} from './playbook_run_updates';

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

    describe('applyChecklistUpdateIdempotent', () => {
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

            const result = applyChecklistUpdateIdempotent(testPlaybookRun, payload);

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

            const result = applyChecklistUpdateIdempotent(testPlaybookRun, payload);

            expect(result.checklists[0].items.length).toBe(2);
            expect(result.checklists[0].items[1]).toMatchObject({
                id: 'item_2',
                title: 'New Item',
            });

            // Applying the same update again should not create duplicates
            const result2 = applyChecklistUpdateIdempotent(result, payload);
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
            const firstResult = applyChecklistUpdateIdempotent(testPlaybookRun, firstPayload);

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

            const result = applyChecklistUpdateIdempotent(firstResult, olderPayload);

            // Should remain unchanged due to older timestamp
            expect(result.checklists[0].title).toBe('First Update');
        });

        it('should return unchanged for non-existent checklist', () => {
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

            const result = applyChecklistUpdateIdempotent(testPlaybookRun, payload);

            expect(result).toBe(testPlaybookRun); // Same object, unchanged
        });
    });

    describe('applyChecklistItemUpdateIdempotent', () => {
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

            const result = applyChecklistItemUpdateIdempotent(testPlaybookRun, payload);

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
            const firstResult = applyChecklistItemUpdateIdempotent(testPlaybookRun, firstPayload);

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

            const result = applyChecklistItemUpdateIdempotent(firstResult, olderPayload);

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

            const result = applyChecklistItemUpdateIdempotent(testPlaybookRun, payload);

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

            const result = applyChecklistItemUpdateIdempotent(testPlaybookRun, payload);

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

            const result = applyChecklistItemUpdateIdempotent(testPlaybookRun, payload);

            expect(result).not.toBe(testPlaybookRun); // Different objects
            expect(testPlaybookRun.checklists[0].items[0].state).toBe('Open'); // Original unchanged
            expect(result.checklists[0].items[0].state).toBe('Closed'); // Result changed
        });
    });
});