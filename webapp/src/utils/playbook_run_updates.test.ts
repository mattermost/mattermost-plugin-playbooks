// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

import {applyIncrementalUpdate} from './playbook_run_updates';

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
                        assignee_type: '',
                        assignee_modified: 0,
                        command: '',
                        description: '',
                        command_last_run: 0,
                        due_date: 0,
                        task_actions: [],
                        condition_id: '',
                        condition_action: '',
                        condition_reason: '',
                        restrict_completion_to_assignee: false,
                        assignee_group_id: '',
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
        current_status: PlaybookRunStatus.InProgress,
        type: PlaybookRunType.Playbook,
        items_order: ['checklist_1'],
        run_number: 0,
        sequential_id: '',
        task_total: 0,
        task_completed: 0,
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
            expect(result.update_at).toBe(2000);
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

        it('should preserve property_values when owner changes and properties are not in changed_fields', () => {
            // This tests the correct server behavior: after the fix, the server
            // uses service-level GetPlaybookRun for both originalRun and updatedRun,
            // so property_values are NOT included in changed_fields (they didn't change).
            const runWithProperties = {
                ...testPlaybookRun,
                property_fields: [
                    {id: 'field1', name: 'Oncall', type: 'user', attrs: {}} as any,
                ],
                property_values: [
                    {id: 'val1', field_id: 'field1', value: 'user-abc', create_at: 0, update_at: 0, delete_at: 0},
                ],
            };

            const update = {
                id: runWithProperties.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    owner_user_id: 'new-owner',
                },
            };

            const result = applyIncrementalUpdate(runWithProperties, update);

            expect(result.owner_user_id).toBe('new-owner');
            expect(result.property_values).toEqual(runWithProperties.property_values);
            expect(result.property_fields).toEqual(runWithProperties.property_fields);
        });

        it('should wipe property_values if server incorrectly includes null property_values in changed_fields', () => {
            // This documents the bug behavior before the server fix: if the server
            // uses store-level GetPlaybookRun (nil properties) for updatedRun,
            // DetectChangedFields sends property_values: null, which overwrites the
            // existing values on the frontend. The server fix prevents this, but this
            // test documents the frontend's pass-through behavior.
            const runWithProperties = {
                ...testPlaybookRun,
                property_fields: [
                    {id: 'field1', name: 'Oncall', type: 'user', attrs: {}} as any,
                ],
                property_values: [
                    {id: 'val1', field_id: 'field1', value: 'user-abc', create_at: 0, update_at: 0, delete_at: 0},
                ],
            };

            const update = {
                id: runWithProperties.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    owner_user_id: 'new-owner',
                    property_values: null as any,
                },
            };

            const result = applyIncrementalUpdate(runWithProperties, update);

            expect(result.owner_user_id).toBe('new-owner');

            // null overwrites the existing array — this is the bug symptom on the frontend
            expect(result.property_values).toBeNull();
        });
    });
});