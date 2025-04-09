// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import configureStore, {MockStoreEnhanced} from 'redux-mock-store';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {WebSocketMessage} from '@mattermost/client';

import {
    handleReconnect,
    handleWebsocketPlaybookChecklistItemUpdated,
    handleWebsocketPlaybookChecklistUpdated,
    handleWebsocketPlaybookRunUpdatedIncremental,
} from './websocket_events';

import {PlaybookRun, PlaybookRunStatus} from './types/playbook_run';
import {PlaybookRunUpdate} from './types/websocket_events';
import {PlaybookRunType} from './graphql/generated/graphql';
import {TimelineEventType} from './types/rhs';

const mockStore = configureStore<GlobalState, DispatchFunc>();

// No mocks needed for these specific tests

// We don't need to mock the client module since our tests don't interact with it directly

describe('handleReconnect', () => {
    it('does nothing if there is no current team', async () => {
        const initialState = {
            entities: {
                users: {
                    currentUserId: 'user_id',
                },
                teams: {
                    currentTeamId: '',
                    teams: {},
                },
            },
        } as GlobalState;
        const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(initialState);

        const reconnectHandler = handleReconnect(store.getState, store.dispatch);
        const result = await reconnectHandler();
        expect(result).toBeUndefined();
    });

    it('does nothing if there is no current user', async () => {
        const team = {id: 'team_id', delete_at: 0};
        const initialState = {
            entities: {
                users: {
                    currentUserId: '',
                },
                teams: {
                    currentTeamId: team.id,
                    teams: {
                        [team.id]: team,
                    },
                },
            },
        } as GlobalState;
        const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(initialState);

        const reconnectHandler = handleReconnect(store.getState, store.dispatch);
        const result = await reconnectHandler();
        expect(result).toBeUndefined();
    });
});

describe('incremental updates', () => {
    // Create a base playbook run for testing
    const basePlaybookRun: PlaybookRun = {
        id: 'playbook_run_1',
        team_id: 'team_1',
        channel_id: 'channel_1',
        name: 'Test Playbook Run',
        owner_user_id: 'user_1',
        checklists: [
            {
                id: 'checklist_1',
                title: 'Checklist 1',
                items: [
                    {
                        id: 'item_1',
                        title: 'Item 1',
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
                    {
                        id: 'item_2',
                        title: 'Item 2',
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
        ],

        // Other required fields with default values
        create_at: 1,
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
    };

    describe('handleWebsocketPlaybookRunUpdatedIncremental', () => {
        // Setup test environment for each test
        let testDispatch: jest.Mock;
        let testGetState: jest.Mock;

        // Create a fresh copy of the playbook run for each test to avoid state leakage
        let testPlaybookRun: PlaybookRun;

        beforeEach(() => {
            // Create a fresh deep copy of the base playbook run
            testPlaybookRun = JSON.parse(JSON.stringify(basePlaybookRun));

            // Reset mocks with fresh playbook run
            testDispatch = jest.fn();
            testGetState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [testPlaybookRun.id]: testPlaybookRun,
                            },
                        },
                    },
                } as any;
            });
        });

        it('handles single scalar field update', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with just one field change
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name',
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called with the updated playbook run
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Check that only the name was updated
            expect(dispatchedAction.playbookRun.name).toBe('Updated Name');
            expect(dispatchedAction.playbookRun.owner_user_id).toBe(testPlaybookRun.owner_user_id); // unchanged

            // Make sure other fields weren't changed
            expect(dispatchedAction.playbookRun.id).toBe(testPlaybookRun.id);
            expect(dispatchedAction.playbookRun.team_id).toBe(testPlaybookRun.team_id);
        });

        it('handles multiple scalar field updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with multiple field changes
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name',
                    owner_user_id: 'user_2',
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called with the updated playbook run
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Check that all updates were applied correctly
            expect(dispatchedAction.playbookRun.name).toBe('Updated Name');
            expect(dispatchedAction.playbookRun.owner_user_id).toBe('user_2');

            // Make sure other fields weren't changed
            expect(dispatchedAction.playbookRun.id).toBe(testPlaybookRun.id);
            expect(dispatchedAction.playbookRun.team_id).toBe(testPlaybookRun.team_id);
        });

        it('handles nested field updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with nested field changes
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name',
                    status_update_enabled: true,
                    broadcast_channel_ids: ['channel_1', 'channel_2'],
                    metrics_data: [
                        {
                            id: 'metric_1',
                            title: 'Metric 1',
                            value: 42,
                        },
                    ],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Check that all updates were applied correctly
            expect(dispatchedAction.playbookRun.name).toBe('Updated Name');
            expect(dispatchedAction.playbookRun.status_update_enabled).toBe(true);
            expect(dispatchedAction.playbookRun.broadcast_channel_ids).toEqual(['channel_1', 'channel_2']);
            expect(dispatchedAction.playbookRun.metrics_data).toEqual([
                {
                    id: 'metric_1',
                    title: 'Metric 1',
                    value: 42,
                },
            ]);
        });

        it('handles checklist replacements', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a complete modified checklist
            const modifiedChecklists = [
                {
                    id: 'checklist_1',
                    title: 'Updated Checklist Title',
                    items: [
                        {
                            id: 'item_2', // Item order swapped
                            title: 'Item 2',
                            state: 'Open',
                            assignee_id: '',
                            command: '',
                            description: '',
                            command_last_run: 0,
                            due_date: 0,
                            task_actions: [],
                            position: 0, // New position field
                        },
                        {
                            id: 'item_1', // Item order swapped
                            title: 'Item 1',
                            state: 'Closed', // Status changed
                            assignee_id: 'user_2', // Assignee changed
                            command: '',
                            description: '',
                            command_last_run: 0,
                            due_date: 0,
                            task_actions: [],
                            position: 1, // New position field
                        },
                    ],
                },
            ];

            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 1000,
                changed_fields: {

                    // The front-end replaces the entire checklists array
                    checklists: modifiedChecklists,
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Check that the update was applied correctly - the entire checklists array should be replaced
            // Use toEqual instead of toBe to compare contents rather than object references
            expect(dispatchedAction.playbookRun.checklists).toEqual(modifiedChecklists);

            // Verify the specific fields we care about
            const updatedChecklist = dispatchedAction.playbookRun.checklists[0];
            expect(updatedChecklist.title).toBe('Updated Checklist Title');

            // The items should be in their new order with updated values
            expect(updatedChecklist.items[0].id).toBe('item_2');
            expect(updatedChecklist.items[0].position).toBe(0);

            expect(updatedChecklist.items[1].id).toBe('item_1');
            expect(updatedChecklist.items[1].position).toBe(1);
            expect(updatedChecklist.items[1].state).toBe('Closed');
            expect(updatedChecklist.items[1].assignee_id).toBe('user_2');
        });

        it('handles incremental checklist updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with checklist_updates
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name', // Some other field update
                    checklist_updates: [
                        {
                            id: 'checklist_1',
                            index: 0,
                            updated_at: 1000,
                            fields: {
                                title: 'Updated Checklist Title via updates',
                            },
                            item_updates: [
                                {
                                    id: 'item_1',
                                    index: 0,
                                    fields: {
                                        state: 'Closed',
                                        assignee_id: 'user_3',
                                    },
                                },
                            ],
                            item_deletes: ['item_2'], // Delete the second item
                        },
                    ],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Check that both types of updates were applied correctly
            expect(dispatchedAction.playbookRun.name).toBe('Updated Name');

            // Check checklist update was applied
            const updatedChecklist = dispatchedAction.playbookRun.checklists[0];
            expect(updatedChecklist.title).toBe('Updated Checklist Title via updates');

            // Check item update was applied
            expect(updatedChecklist.items.length).toBe(1); // One item should be deleted
            expect(updatedChecklist.items[0].id).toBe('item_1'); // Should have the first item
            expect(updatedChecklist.items[0].state).toBe('Closed'); // With updated state
            expect(updatedChecklist.items[0].assignee_id).toBe('user_3'); // And updated assignee
        });

        // Note: We're not testing the "missing run in store" case here since that would
        // require mocking the fetchPlaybookRun client method, which doesn't align with
        // the existing test patterns. The current tests focus on the handler logic for
        // runs that are already in the store.
        it('handles timeline events updates', () => {
            // First, add some existing timeline events to the test run
            testPlaybookRun.timeline_events = [
                {
                    id: 'event1',
                    create_at: 100,
                    event_at: 100,
                    event_type: TimelineEventType.RunCreated,
                    summary: 'Event 1',
                    playbook_run_id: testPlaybookRun.id,
                    delete_at: 0,
                    details: '',
                    post_id: '',
                    subject_user_id: '',
                    creator_user_id: '',
                },
                {
                    id: 'event2',
                    create_at: 200,
                    event_at: 200,
                    event_type: TimelineEventType.StatusUpdated,
                    summary: 'Event 2',
                    playbook_run_id: testPlaybookRun.id,
                    delete_at: 0,
                    details: '',
                    post_id: '',
                    subject_user_id: '',
                    creator_user_id: '',
                },
            ];

            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a new timeline event to be added via update
            const newEvent = {
                id: 'event3',
                create_at: 300,
                event_at: 300,
                event_type: TimelineEventType.StatusUpdated,
                summary: 'Event 3',
                playbook_run_id: testPlaybookRun.id,
                delete_at: 0,
                details: '',
                post_id: '',
                subject_user_id: '',
                creator_user_id: '',
            };

            // Also create an updated version of an existing event
            const updatedEvent = {
                id: 'event1', // Same ID as existing event
                create_at: 100,
                event_at: 100,
                event_type: TimelineEventType.RunCreated,
                summary: 'Updated Event 1 Summary', // Changed summary
                playbook_run_id: testPlaybookRun.id,
                delete_at: 0,
                details: '',
                post_id: '',
                subject_user_id: '',
                creator_user_id: '',
            };

            // Create an update with timeline events
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name', // Some other field update
                    timeline_events: [updatedEvent, newEvent],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Check that regular field updates were applied
            expect(dispatchedAction.playbookRun.name).toBe('Updated Name');

            // Check that timeline events were properly merged
            expect(dispatchedAction.playbookRun.timeline_events.length).toBe(3);

            // Events should be sorted by createAt
            expect(dispatchedAction.playbookRun.timeline_events[0].id).toBe('event1');
            expect(dispatchedAction.playbookRun.timeline_events[0].summary).toBe('Updated Event 1 Summary'); // Updated summary
            expect(dispatchedAction.playbookRun.timeline_events[1].id).toBe('event2');
            expect(dispatchedAction.playbookRun.timeline_events[1].summary).toBe('Event 2'); // Unchanged
            expect(dispatchedAction.playbookRun.timeline_events[2].id).toBe('event3');
            expect(dispatchedAction.playbookRun.timeline_events[2].summary).toBe('Event 3'); // New event
        });
    });

    describe('handleWebsocketPlaybookChecklistUpdated', () => {
        // Setup test environment for each test
        let testDispatch: jest.Mock;
        let testGetState: jest.Mock;

        // Create a fresh copy of the playbook run for each test to avoid state leakage
        let testPlaybookRun: PlaybookRun;

        beforeEach(() => {
            // Create a fresh deep copy of the base playbook run
            testPlaybookRun = JSON.parse(JSON.stringify(basePlaybookRun));

            // Reset mocks with fresh playbook run
            testDispatch = jest.fn();
            testGetState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [testPlaybookRun.id]: testPlaybookRun,
                            },
                        },
                    },
                } as any;
            });
        });

        it('handles single field update (title)', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistUpdated(testGetState, testDispatch);

            // Create a checklist update with only title change
            const update = {
                PlaybookRunID: testPlaybookRun.id,
                Update: {
                    id: 'checklist_1',
                    index: 0,
                    updated_at: 1000,
                    fields: {
                        title: 'Updated Checklist Title',
                    },
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Check that only the title was updated
            const updatedChecklist = dispatchedAction.playbookRun.checklists[0];
            expect(updatedChecklist.title).toBe('Updated Checklist Title');

            // Make sure items were preserved unchanged
            expect(updatedChecklist.items.length).toBe(2);
            expect(updatedChecklist.items[0].id).toBe('item_1');
            expect(updatedChecklist.items[1].id).toBe('item_2');
        });

        it('handles item deletions', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistUpdated(testGetState, testDispatch);

            // Create a checklist update with item deletion
            const update = {
                PlaybookRunID: testPlaybookRun.id,
                Update: {
                    id: 'checklist_1',
                    index: 0,
                    updated_at: 1000,
                    item_deletes: ['item_1'], // Delete the first item
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Check that the item was deleted
            const updatedChecklist = dispatchedAction.playbookRun.checklists[0];
            expect(updatedChecklist.items.length).toBe(1);
            expect(updatedChecklist.items[0].id).toBe('item_2');
        });

        it('handles item insertions', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistUpdated(testGetState, testDispatch);

            // Create a new item to insert
            const newItem = {
                id: 'item_3',
                title: 'New Item',
                state: 'Open',
                assignee_id: '',
                command: '',
                description: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
            };

            // Create a checklist update with item insertion
            const update = {
                PlaybookRunID: testPlaybookRun.id,
                Update: {
                    id: 'checklist_1',
                    index: 0,
                    updated_at: 1000,
                    item_inserts: [newItem],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was called
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify the item was inserted
            const updatedChecklist = dispatchedAction.playbookRun.checklists[0];
            expect(updatedChecklist.items.length).toBe(3); // Original 2 + 1 new
            expect(updatedChecklist.items).toContainEqual(expect.objectContaining({
                id: 'item_3',
                title: 'New Item',
            }));

            // Verify dispatch was called with the correct action type and run ID
            expect(dispatchedAction.type).toBe('playbooks_playbook_run_updated');
            expect(dispatchedAction.playbookRun.id).toBe(testPlaybookRun.id);
        });

        // Note: We're not testing the "missing run in store" case here since that would
        // require mocking the fetchPlaybookRun client method, which doesn't align with
        // the existing test patterns. The current tests focus on the handler logic for
        // runs that are already in the store.
    });

    describe('handleWebsocketPlaybookChecklistItemUpdated', () => {
        // Setup test environment for each test
        let testDispatch: jest.Mock;
        let testGetState: jest.Mock;

        // Create a fresh copy of the playbook run for each test to avoid state leakage
        let testPlaybookRun: PlaybookRun;

        beforeEach(() => {
            // Create a fresh deep copy of the base playbook run
            testPlaybookRun = JSON.parse(JSON.stringify(basePlaybookRun));

            // Reset mocks with fresh playbook run
            testDispatch = jest.fn();
            testGetState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [testPlaybookRun.id]: testPlaybookRun,
                            },
                        },
                    },
                } as any;
            });
        });

        it('handles single field updates (assignee)', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0];

            // Create an item update with just the assignee change
            const update = {
                PlaybookRunID: testPlaybookRun.id,
                ChecklistID: checklist.id as string,
                Update: {
                    id: item.id,
                    index: 0,
                    updated_at: 1000,
                    fields: {assignee_id: 'user_2'},
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Verify dispatch was called with the correct action type and run ID
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.type).toBe('playbooks_playbook_run_updated');
            expect(dispatchedAction.playbookRun.id).toBe(testPlaybookRun.id);

            // Verify only the assignee was updated
            const updatedItem = dispatchedAction.playbookRun.checklists[0].items[0];
            expect(updatedItem.assignee_id).toBe('user_2');
            expect(updatedItem.state).toBe(item.state); // unchanged
            expect(updatedItem.title).toBe(item.title); // unchanged
        });

        it('handles single field updates (state)', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0];

            // Create an item update with just the state change
            const update = {
                PlaybookRunID: testPlaybookRun.id,
                ChecklistID: checklist.id as string,
                Update: {
                    id: item.id,
                    index: 0,
                    updated_at: 1000,
                    fields: {state: 'Closed'},
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Verify dispatch was called with the correct action type and run ID
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.type).toBe('playbooks_playbook_run_updated');

            // Verify only the state was updated
            const updatedItem = dispatchedAction.playbookRun.checklists[0].items[0];
            expect(updatedItem.state).toBe('Closed');
            expect(updatedItem.assignee_id).toBe(item.assignee_id); // unchanged
            expect(updatedItem.title).toBe(item.title); // unchanged
        });

        it('handles item reordering through position changes', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0]; // First item with implicit position 0

            // Create an item update with just the position change
            const update = {
                PlaybookRunID: testPlaybookRun.id,
                ChecklistID: checklist.id as string,
                Update: {
                    id: item.id,
                    index: 0,
                    updated_at: 1000,
                    fields: {position: 1}, // Move from position 0 to position 1
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Verify dispatch was called with the correct action type
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.type).toBe('playbooks_playbook_run_updated');

            // Verify only the position was updated
            const updatedItem = dispatchedAction.playbookRun.checklists[0].items.find((i: any) => i.id === item.id);
            expect(updatedItem).not.toBeUndefined();
            expect(updatedItem?.position).toBe(1);
            expect(updatedItem?.state).toBe(item.state); // unchanged
            expect(updatedItem?.title).toBe(item.title); // unchanged
        });

        it('handles multiple field changes at once', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0];

            // Create an item update with multiple field changes
            const update = {
                PlaybookRunID: testPlaybookRun.id,
                ChecklistID: checklist.id as string,
                Update: {
                    id: item.id,
                    index: 0,
                    updated_at: 1000,
                    fields: {
                        state: 'Closed',
                        assignee_id: 'user_2',
                        title: 'Updated Item Title',
                        position: 1,
                        due_date: 1234567890,
                    },
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Verify dispatch was called with the correct action type and run ID
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.type).toBe('playbooks_playbook_run_updated');
            expect(dispatchedAction.playbookRun.id).toBe(testPlaybookRun.id);

            // Verify all fields were updated
            const updatedItem = dispatchedAction.playbookRun.checklists[0].items.find((i: any) => i.id === item.id);
            expect(updatedItem).not.toBeUndefined();
            expect(updatedItem?.state).toBe('Closed');
            expect(updatedItem?.assignee_id).toBe('user_2');
            expect(updatedItem?.title).toBe('Updated Item Title');
            expect(updatedItem?.position).toBe(1);
            expect(updatedItem?.due_date).toBe(1234567890);
        });

        it('handles missing updated_at field', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0];

            // Create an item update without updated_at field (for backward compatibility)
            const update = {
                PlaybookRunID: testPlaybookRun.id,
                ChecklistID: checklist.id as string,
                Update: {
                    id: item.id,
                    index: 0,
                    fields: {assignee_id: 'user_2'},
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Verify dispatch was called with the correct action type and run ID
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.type).toBe('playbooks_playbook_run_updated');
            expect(dispatchedAction.playbookRun.id).toBe(testPlaybookRun.id);

            // Verify assignee was updated
            const updatedItem = dispatchedAction.playbookRun.checklists[0].items[0];
            expect(updatedItem.assignee_id).toBe('user_2');
        });

        it('handles missing input data', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Create a malformed update without Update field
            const update = {
                PlaybookRunID: testPlaybookRun.id,
                ChecklistID: 'checklist_1',

                // Missing Update field
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler - should not throw an error
            handler(msg);

            // Verify dispatch was not called
            expect(testDispatch).not.toHaveBeenCalled();
        });

        // Note: We're not testing the "missing run in store" case here since that would
        // require mocking the fetchPlaybookRun client method, which doesn't align with
        // the existing test patterns. The current tests focus on the handler logic for
        // runs that are already in the store.
    });

    describe('handling edge cases', () => {
        // Test edge case handling in the code

        it('gracefully handles non-existent checklist ID', () => {
            // Create a handler with our mocks
            const dispatch = jest.fn();
            const getState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [basePlaybookRun.id]: basePlaybookRun,
                            },
                        },
                    },
                } as any;
            });

            const handler = handleWebsocketPlaybookChecklistUpdated(getState, dispatch);

            // Create an update with a non-existent checklist ID
            const update = {
                PlaybookRunID: basePlaybookRun.id,
                Update: {
                    id: 'non_existent_checklist',
                    index: 0,
                    updated_at: 1000,
                    fields: {
                        title: 'Updated Checklist Title',
                    },
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler - should not throw an error
            handler(msg);

            // Verify that the handler at least returned and didn't crash
            // The actual behavior with non-existent checklists is to just return
            // early, so dispatch may not be called in this case
            expect(() => handler(msg)).not.toThrow();
        });

        it('gracefully handles non-existent items in item_updates', () => {
            // Create a handler with our mocks
            const dispatch = jest.fn();
            const getState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [basePlaybookRun.id]: JSON.parse(JSON.stringify(basePlaybookRun)), // Deep clone
                            },
                        },
                    },
                } as any;
            });

            const handler = handleWebsocketPlaybookChecklistUpdated(getState, dispatch);

            // Create an update with a non-existent item ID but with valid checklist ID
            const update = {
                PlaybookRunID: basePlaybookRun.id,
                Update: {
                    id: basePlaybookRun.checklists[0].id,
                    index: 0,
                    updated_at: 1000,
                    item_updates: [
                        {
                            id: 'non_existent_item',
                            index: 0,
                            fields: {
                                title: 'Updated Item Title',
                            },
                        },
                    ],
                },
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler - should not throw an error
            handler(msg);

            // Verify that the handler didn't crash
            expect(() => handler(msg)).not.toThrow();
        });
    });
});
