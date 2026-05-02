// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {TimelineEventType} from 'src/types/rhs';

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
                        assignee_modified: 0,
                        command: '',
                        description: '',
                        command_last_run: 0,
                        due_date: 0,
                        task_actions: [],
                        condition_id: '',
                        condition_action: '',
                        condition_reason: '',
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
                    {id: 'val1', field_id: 'field1', value: 'user-abc', target_id: 'run_123', target_type: 'run', group_id: '', create_at: 0, update_at: 0, delete_at: 0},
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

        it('should update run_number when present in changed_fields', () => {
            const update = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    run_number: 5,
                },
            };

            const result = applyIncrementalUpdate(testPlaybookRun, update);

            expect(result.run_number).toBe(5);
        });

        it('should update sequential_id when present in changed_fields', () => {
            const update = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    sequential_id: 'INC-00005',
                },
            };

            const result = applyIncrementalUpdate(testPlaybookRun, update);

            expect(result.sequential_id).toBe('INC-00005');
        });

        it('should preserve run_number and sequential_id when absent from changed_fields', () => {
            const runWithIds = {
                ...testPlaybookRun,
                run_number: 3,
                sequential_id: 'INC-00003',
            };

            const update = {
                id: runWithIds.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    name: 'Updated Name',
                },
            };

            const result = applyIncrementalUpdate(runWithIds, update);

            expect(result.run_number).toBe(3);
            expect(result.sequential_id).toBe('INC-00003');
        });

        it('should return the original run reference unchanged when update is older than current state', () => {
            const currentRun = {...testPlaybookRun, update_at: 2000};
            const update = {
                id: currentRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    name: 'Stale Name',
                },
            };

            const result = applyIncrementalUpdate(currentRun, update);

            expect(result).toBe(currentRun);
        });

        it('should apply update when update timestamp is newer than current state', () => {
            const currentRun = {...testPlaybookRun, update_at: 1000};
            const update = {
                id: currentRun.id,
                playbook_run_updated_at: 2000,
                changed_fields: {
                    name: 'Newer Name',
                },
            };

            const result = applyIncrementalUpdate(currentRun, update);

            expect(result).not.toBe(currentRun);
            expect(result.name).toBe('Newer Name');
        });

        it('should remove checklist specified in checklist_deletes', () => {
            const runWith2Checklists = {
                ...testPlaybookRun,
                checklists: [
                    {
                        id: 'checklist_1',
                        title: 'Checklist One',
                        items: [],
                    },
                    {
                        id: 'checklist_2',
                        title: 'Checklist Two',
                        items: [],
                    },
                ],
            };

            const update = {
                id: runWith2Checklists.id,
                playbook_run_updated_at: 2000,
                changed_fields: {},
                checklist_deletes: ['checklist_1'],
            };

            const result = applyIncrementalUpdate(runWith2Checklists, update);

            expect(result.checklists).toHaveLength(1);
            expect(result.checklists[0].id).toBe('checklist_2');
        });

        it('should remove timeline event specified in timeline_event_deletes', () => {
            const runWith2Events = {
                ...testPlaybookRun,
                timeline_events: [
                    {id: 'event_1', create_at: 100, delete_at: 0, event_at: 100, playbook_run_id: 'run_123', event_type: TimelineEventType.RunCreated, summary: '', details: '', post_id: '', subject_user_id: '', creator_user_id: ''},
                    {id: 'event_2', create_at: 200, delete_at: 0, event_at: 200, playbook_run_id: 'run_123', event_type: TimelineEventType.RunCreated, summary: '', details: '', post_id: '', subject_user_id: '', creator_user_id: ''},
                ],
            };

            const update = {
                id: runWith2Events.id,
                playbook_run_updated_at: 2000,
                changed_fields: {},
                timeline_event_deletes: ['event_1'],
            };

            const result = applyIncrementalUpdate(runWith2Events, update);

            expect(result.timeline_events).toHaveLength(1);
            expect(result.timeline_events![0].id).toBe('event_2');
        });

        it('should remove status post specified in status_post_deletes', () => {
            const runWith2Posts = {
                ...testPlaybookRun,
                status_posts: [
                    {id: 'post_1', create_at: 100, delete_at: 0},
                    {id: 'post_2', create_at: 200, delete_at: 0},
                ],
            };

            const update = {
                id: runWith2Posts.id,
                playbook_run_updated_at: 2000,
                changed_fields: {},
                status_post_deletes: ['post_1'],
            };

            const result = applyIncrementalUpdate(runWith2Posts, update);

            expect(result.status_posts).toHaveLength(1);
            expect(result.status_posts![0].id).toBe('post_2');
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
                    {id: 'val1', field_id: 'field1', value: 'user-abc', target_id: 'run_123', target_type: 'run', group_id: '', create_at: 0, update_at: 0, delete_at: 0},
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