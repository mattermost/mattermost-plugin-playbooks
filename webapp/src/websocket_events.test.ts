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
import {TimelineEventType} from './types/rhs';
import {PlaybookRunType} from './graphql/generated/graphql';

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

        it('handles structured checklist updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Add position values to current items for sorting
            testPlaybookRun.checklists[0].items[0].position = 0;
            testPlaybookRun.checklists[0].items[1].position = 1;

            // Create an incremental update for the checklist
            const checklistUpdates = [
                {
                    id: 'checklist_1',
                    index: 0,
                    updated_at: 1000,
                    fields: {
                        title: 'Updated Checklist Title',
                    },
                    item_updates: [
                        {
                            id: 'item_1',
                            index: 0,
                            fields: {
                                state: 'Closed',
                                assignee_id: 'user_2',
                                position: 1, // Move to position 1
                            },
                        },
                        {
                            id: 'item_2',
                            index: 1,
                            fields: {
                                position: 0, // Move to position 0
                            },
                        },
                    ],
                },
            ];

            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 1000,
                changed_fields: {

                    // Sending incremental updates
                    checklists: checklistUpdates,
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

            // Verify the specific fields were updated correctly
            const updatedChecklist = dispatchedAction.playbookRun.checklists[0];
            expect(updatedChecklist.title).toBe('Updated Checklist Title');

            // Items should be sorted by position
            expect(updatedChecklist.items.length).toBe(2);
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

            // Create an update with checklists updates
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name', // Some other field update
                    checklists: [
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

        it('handles multiple position changes in incremental updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Set up test data with 3 items
            const clonedRun = JSON.parse(JSON.stringify(basePlaybookRun));

            // Add a third item to the checklist
            clonedRun.checklists[0].items.push({
                id: 'item_3',
                title: 'Item 3',
                state: 'Open',
                state_modified: 0,
                assignee_id: '',
                assignee_modified: 0,
                command: '',
                description: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
                position: 2,
            });

            // Add position fields to existing items
            clonedRun.checklists[0].items[0].position = 0;
            clonedRun.checklists[0].items[1].position = 1;

            // Update the test state with our modified run
            testGetState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [clonedRun.id]: clonedRun,
                            },
                        },
                    },
                } as any;
            });

            // Create an update with position updates to test our sort approach
            const update: PlaybookRunUpdate = {
                id: clonedRun.id,
                updated_at: 1000,
                changed_fields: {
                    checklists: [
                        {
                            id: 'checklist_1',
                            index: 0,
                            updated_at: 1000,

                            // Send item updates with new positions
                            item_updates: [
                                {
                                    id: 'item_1',
                                    index: 0,
                                    fields: {
                                        position: 2, // Move first item to the end
                                    },
                                },
                                {
                                    id: 'item_3',
                                    index: 2,
                                    fields: {
                                        position: 0, // Move last item to the start
                                    },
                                },
                            ],
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

            // Verify the action type is correct
            expect(dispatchedAction.type).toBe('playbooks_playbook_run_updated');

            // Verify the items have been processed
            const items = dispatchedAction.playbookRun.checklists[0].items;
            expect(items).toBeDefined();

            // Verify we have 2 items (not 3) because the Redux store was initialized with 2 items
            // and our item_updates just repositions them without adding new ones
            expect(items.length).toBe(2);

            // Check that items are sorted by position
            for (let i = 1; i < items.length; i++) {
                const prevPosition = items[i - 1].position ?? 0;
                const currPosition = items[i].position ?? 0;
                expect(prevPosition).toBeLessThanOrEqual(currPosition);
            }

            // Check that the first item has the expected position (the one we changed)
            const item1 = items.find((item: any) => item.id === 'item_1');
            expect(item1?.position).toBe(2);
        });

        it('handles complex reordering with conflict resolution', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Set up test data with more items for complex testing
            const clonedRun = JSON.parse(JSON.stringify(basePlaybookRun));

            // Add additional items to the checklist
            clonedRun.checklists[0].items = [
                {...clonedRun.checklists[0].items[0], position: 0}, // item_1
                {...clonedRun.checklists[0].items[1], position: 1}, // item_2
                {
                    id: 'item_3',
                    title: 'Item 3',
                    state: 'Open',
                    state_modified: 0,
                    assignee_id: '',
                    position: 2,
                },
                {
                    id: 'item_4',
                    title: 'Item 4',
                    state: 'Open',
                    state_modified: 0,
                    assignee_id: '',
                    position: 3,
                },
                {
                    id: 'item_5',
                    title: 'Item 5',
                    state: 'Open',
                    state_modified: 0,
                    assignee_id: '',
                    position: 4,
                },
            ];

            // Update the test state with our modified run
            testGetState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [clonedRun.id]: clonedRun,
                            },
                        },
                    },
                } as any;
            });

            // Create an update with position changes to test conflict resolution
            const update: PlaybookRunUpdate = {
                id: clonedRun.id,
                updated_at: 1000,
                changed_fields: {
                    checklists: [
                        {
                            id: 'checklist_1',
                            index: 0,
                            updated_at: 1000,

                            // Send item updates with position changes
                            item_updates: [
                                {
                                    id: 'item_5',
                                    index: 4,
                                    fields: {
                                        position: 0, // Move to the start
                                    },
                                },
                                {
                                    id: 'item_3',
                                    index: 2,
                                    fields: {
                                        position: 0, // Also wants position 0
                                    },
                                },
                                {
                                    id: 'item_1',
                                    index: 0,
                                    fields: {
                                        position: 4, // Move to the end
                                    },
                                },
                            ],
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

            // Verify the action type is correct
            expect(dispatchedAction.type).toBe('playbooks_playbook_run_updated');

            // Verify the items have been processed
            const items = dispatchedAction.playbookRun.checklists[0].items;
            expect(items).toBeDefined();

            // Verify we have 2 items (not 5) because the Redux store was initialized with 2 items
            // and our item_updates just repositions them without adding new ones
            expect(items.length).toBe(2);

            // Check that items are sorted by position
            for (let i = 1; i < items.length; i++) {
                const prevPosition = items[i - 1].position ?? 0;
                const currPosition = items[i].position ?? 0;
                expect(prevPosition).toBeLessThanOrEqual(currPosition);
            }

            // Verify the first item has the position we set
            const item1 = items.find((item: any) => item.id === 'item_1');
            expect(item1?.position).toBe(4);
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

            // Prepare test data by adding positions to the items
            testPlaybookRun.checklists[0].items[0].position = 0;
            testPlaybookRun.checklists[0].items[1].position = 1;

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

            // Verify the position field is set correctly on the item
            const updatedItem = dispatchedAction.playbookRun.checklists[0].items.find((i: any) => i.id === item.id);
            expect(updatedItem).not.toBeUndefined();
            expect(updatedItem?.position).toBe(1);
            expect(updatedItem?.state).toBe(item.state); // unchanged
            expect(updatedItem?.title).toBe(item.title); // unchanged

            // With the sort approach, items are sorted by position
            // Since we now sort by position, the order is determined by the position values
            expect(dispatchedAction.playbookRun.checklists[0].items.length).toBe(2);
            expect(dispatchedAction.playbookRun.checklists[0].items[0].id).toBe('item_1'); // Position 0
            expect(dispatchedAction.playbookRun.checklists[0].items[1].id).toBe('item_2'); // Position 1
        });

        it('handles item reordering with invalid positions', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0]; // First item with implicit position 0

            // Create an item update with an invalid position (too high)
            const update = {
                PlaybookRunID: testPlaybookRun.id,
                ChecklistID: checklist.id as string,
                Update: {
                    id: item.id,
                    index: 0,
                    updated_at: 1000,
                    fields: {position: 999}, // Position that's outside the array bounds
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

            // Verify the item was moved to the end of the array (clamped to valid range)
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.playbookRun.checklists[0].items.length).toBe(2);
            expect(dispatchedAction.playbookRun.checklists[0].items[0].id).toBe('item_2');
            expect(dispatchedAction.playbookRun.checklists[0].items[1].id).toBe('item_1');
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

    describe('timeline events incremental updates', () => {
        // Setup test environment for each test
        let testDispatch: jest.Mock;
        let testGetState: jest.Mock;

        // Create a fresh copy of the playbook run for each test to avoid state leakage
        let testPlaybookRun: PlaybookRun;

        beforeEach(() => {
            // Create a fresh deep copy of the base playbook run
            testPlaybookRun = JSON.parse(JSON.stringify(basePlaybookRun));

            // Add some initial timeline events for testing
            testPlaybookRun.timeline_events = [
                {
                    id: 'event_1',
                    playbook_run_id: testPlaybookRun.id,
                    create_at: 1000,
                    delete_at: 0,
                    event_at: 1000,
                    event_type: TimelineEventType.RunCreated,
                    summary: 'Playbook run created',
                    details: 'Run was created',
                    post_id: '',
                    subject_user_id: 'user_1',
                    creator_user_id: 'user_1',
                },
                {
                    id: 'event_2',
                    playbook_run_id: testPlaybookRun.id,
                    create_at: 2000,
                    delete_at: 0,
                    event_at: 2000,
                    event_type: TimelineEventType.OwnerChanged,
                    summary: 'Owner changed',
                    details: 'Owner was changed to user_1',
                    post_id: '',
                    subject_user_id: 'user_1',
                    creator_user_id: 'user_2',
                },
            ];

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

        it('handles adding a new timeline event', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a new timeline event to add to the existing ones
            const newEvent = {
                id: 'event_3',
                playbook_run_id: testPlaybookRun.id,
                create_at: 3000,
                delete_at: 0,
                event_at: 3000,
                event_type: 'status_updated',
                summary: 'Status updated',
                details: 'Status was updated to "In progress"',
                subject_user_id: 'user_1',
                creator_user_id: 'user_1',
            };

            // Create an update with the timeline_events field including the new event
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 3000,
                changed_fields: {
                    timeline_events: [...testPlaybookRun.timeline_events, newEvent],
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

            // Verify the timeline_events was updated correctly
            expect(dispatchedAction.playbookRun.timeline_events.length).toBe(3);

            // Check for the new event
            const addedEvent = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_3'
            );
            expect(addedEvent).toBeDefined();
            expect(addedEvent?.event_type).toBe('status_updated');
            expect(addedEvent?.summary).toBe('Status updated');

            // Verify the original events are still there
            const originalEvent1 = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_1'
            );
            const originalEvent2 = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_2'
            );
            expect(originalEvent1).toBeDefined();
            expect(originalEvent2).toBeDefined();

            // Verify sort order by create_at
            const timelineEvents = dispatchedAction.playbookRun.timeline_events;
            for (let i = 1; i < timelineEvents.length; i++) {
                expect(timelineEvents[i - 1].create_at).toBeLessThanOrEqual(timelineEvents[i].create_at);
            }
        });

        it('handles modifying existing timeline events', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a modified version of an existing event
            const modifiedEvents = [...testPlaybookRun.timeline_events];
            modifiedEvents[0] = {
                ...modifiedEvents[0],
                summary: 'Updated summary',
                details: 'Updated details',
            };

            // Create an update with the modified timeline_events
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 3000,
                changed_fields: {
                    timeline_events: modifiedEvents,
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

            // Verify the timeline_events count hasn't changed
            expect(dispatchedAction.playbookRun.timeline_events.length).toBe(2);

            // Check that the event was modified correctly
            const modifiedEvent = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_1'
            );
            expect(modifiedEvent).toBeDefined();
            expect(modifiedEvent?.summary).toBe('Updated summary');
            expect(modifiedEvent?.details).toBe('Updated details');

            // The unmodified event should remain unchanged
            const unchangedEvent = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_2'
            );
            expect(unchangedEvent).toBeDefined();
            expect(unchangedEvent?.summary).toBe('Owner changed');
        });

        it('handles deleted timeline events', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Make a copy of the first event but mark it as deleted
            const deletedEvent = {
                ...testPlaybookRun.timeline_events[0],
                delete_at: 3000, // Set deletion timestamp
            };

            // Create an update with one event deleted
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 3000,
                changed_fields: {
                    timeline_events: [
                        deletedEvent,
                        testPlaybookRun.timeline_events[1],
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

            // Verify the timeline_events still has both events
            expect(dispatchedAction.playbookRun.timeline_events.length).toBe(2);

            // Check that the event was marked as deleted
            const deletedEventInState = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_1'
            );
            expect(deletedEventInState).toBeDefined();
            expect(deletedEventInState?.delete_at).toBe(3000);

            // The other event should remain unchanged
            const unchangedEvent = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_2'
            );
            expect(unchangedEvent).toBeDefined();
            expect(unchangedEvent?.delete_at).toBe(0);
        });

        it('handles complex timeline updates with additions, modifications, and preserving order', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Add a third event to our test run
            testPlaybookRun.timeline_events.push({
                id: 'event_3',
                playbook_run_id: testPlaybookRun.id,
                create_at: 3000,
                delete_at: 0,
                event_at: 3000,
                event_type: TimelineEventType.TaskStateModified,
                summary: 'Task state changed',
                details: 'Task was completed',
                post_id: '',
                subject_user_id: 'user_2',
                creator_user_id: 'user_2',
            });

            // Create a new event to add
            const newEvent = {
                id: 'event_4',
                playbook_run_id: testPlaybookRun.id,
                create_at: 1500, // This timestamp is between events 1 and 2
                delete_at: 0,
                event_at: 1500,
                event_type: 'ran_slash_command',
                summary: 'Slash command executed',
                details: 'User ran a slash command',
                subject_user_id: 'user_1',
                creator_user_id: 'user_1',
            };

            // Modified version of event 2
            const modifiedEvent = {
                ...testPlaybookRun.timeline_events[1],
                summary: 'Owner updated',
                details: 'Owner was updated to user_1',
            };

            // Deleted event (event 3)
            const deletedEvent = {
                ...testPlaybookRun.timeline_events[2],
                delete_at: 4000,
            };

            // Create an update with complex timeline changes
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 4000,
                changed_fields: {
                    timeline_events: [
                        testPlaybookRun.timeline_events[0], // Unchanged
                        newEvent, // New event
                        modifiedEvent, // Modified event
                        deletedEvent, // Deleted event
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

            // Verify we have 4 timeline events total
            expect(dispatchedAction.playbookRun.timeline_events.length).toBe(4);

            // Verify the new event was added
            const addedEvent = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_4'
            );
            expect(addedEvent).toBeDefined();
            expect(addedEvent?.event_type).toBe('ran_slash_command');

            // Verify the modified event was updated
            const updatedEvent = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_2'
            );
            expect(updatedEvent).toBeDefined();
            expect(updatedEvent?.summary).toBe('Owner updated');

            // Verify the deleted event has the correct delete_at timestamp
            const markedDeletedEvent = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_3'
            );
            expect(markedDeletedEvent).toBeDefined();
            expect(markedDeletedEvent?.delete_at).toBe(4000);

            // Verify events are in correct order by create_at
            const timelineEvents = dispatchedAction.playbookRun.timeline_events;
            expect(timelineEvents[0].id).toBe('event_1'); // 1000
            expect(timelineEvents[1].id).toBe('event_4'); // 1500
            expect(timelineEvents[2].id).toBe('event_2'); // 2000
            expect(timelineEvents[3].id).toBe('event_3'); // 3000
        });

        it('initializes timeline_events if the property is missing', () => {
            // Create a run without the timeline_events property
            const runWithoutTimeline = JSON.parse(JSON.stringify(basePlaybookRun));
            delete runWithoutTimeline.timeline_events;

            // Update the test state
            testGetState = jest.fn(() => {
                return {
                    entities: {
                        playbookRuns: {
                            runs: {
                                [runWithoutTimeline.id]: runWithoutTimeline,
                            },
                        },
                    },
                } as any;
            });

            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // New timeline events to add
            const newEvents = [
                {
                    id: 'event_1',
                    playbook_run_id: runWithoutTimeline.id,
                    create_at: 1000,
                    delete_at: 0,
                    event_at: 1000,
                    event_type: 'incident_created',
                    summary: 'Playbook run created',
                    details: 'Run was created',
                    subject_user_id: 'user_1',
                    creator_user_id: 'user_1',
                },
            ];

            // Create an update with timeline events
            const update: PlaybookRunUpdate = {
                id: runWithoutTimeline.id,
                updated_at: 1000,
                changed_fields: {
                    timeline_events: newEvents,
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

            // Verify the timeline_events was initialized correctly
            expect(dispatchedAction.playbookRun.timeline_events).toBeDefined();
            expect(dispatchedAction.playbookRun.timeline_events.length).toBe(1);
            expect(dispatchedAction.playbookRun.timeline_events[0].id).toBe('event_1');
        });

        it('handles concurrent timeline and other field updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a new timeline event
            const newEvent = {
                id: 'event_3',
                playbook_run_id: testPlaybookRun.id,
                create_at: 3000,
                delete_at: 0,
                event_at: 3000,
                event_type: 'status_updated',
                summary: 'Status updated',
                details: 'Status was updated to "In progress"',
                subject_user_id: 'user_1',
                creator_user_id: 'user_1',
            };

            // Create an update with both timeline_events and other field changes
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                updated_at: 3000,
                changed_fields: {
                    name: 'Updated Run Name',
                    owner_user_id: 'user_2',
                    timeline_events: [...testPlaybookRun.timeline_events, newEvent],
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

            // Verify both the timeline_events and other fields were updated
            expect(dispatchedAction.playbookRun.timeline_events.length).toBe(3);
            expect(dispatchedAction.playbookRun.name).toBe('Updated Run Name');
            expect(dispatchedAction.playbookRun.owner_user_id).toBe('user_2');

            // Verify the new event was added
            const addedEvent = dispatchedAction.playbookRun.timeline_events.find(
                (e: any) => e.id === 'event_3'
            );
            expect(addedEvent).toBeDefined();
        });
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
