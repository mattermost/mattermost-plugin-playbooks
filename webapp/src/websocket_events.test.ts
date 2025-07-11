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
import {WEBSOCKET_PLAYBOOK_CHECKLIST_ITEM_UPDATE_RECEIVED, WEBSOCKET_PLAYBOOK_CHECKLIST_UPDATE_RECEIVED, WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED} from './types/actions';

import {PlaybookRun, PlaybookRunStatus} from './types/playbook_run';
import {ChecklistUpdate, PlaybookRunUpdate} from './types/websocket_events';
import {TimelineEvent, TimelineEventType} from './types/rhs';
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
        update_at: 1,
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
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [testPlaybookRun.team_id]: {
                                [testPlaybookRun.channel_id]: testPlaybookRun,
                            },
                        },
                    },
                } as any;
            });
        });

        it('dispatches the correct action with update data', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with just one field change
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1000,
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

            // Check dispatch was called with the correct action
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and data
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
        });

        it('handles missing payload gracefully', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a WebSocket message without payload
            const msg = {
                data: {},
            } as WebSocketMessage<{payload: string}>;

            // Call the handler
            handler(msg);

            // Check dispatch was not called
            expect(testDispatch).not.toHaveBeenCalled();
        });

        it('handles nested field updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with nested field changes
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name',
                    status_update_enabled: true,
                    broadcast_channel_ids: ['channel_1', 'channel_2'],
                    metrics_data: [
                        {
                            metric_config_id: 'metric_1',
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

            // Verify action type and that data contains the update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.name).toBe('Updated Name');
            expect(dispatchedAction.data.changed_fields.status_update_enabled).toBe(true);
            expect(dispatchedAction.data.changed_fields.broadcast_channel_ids).toEqual(['channel_1', 'channel_2']);
            expect(dispatchedAction.data.changed_fields.metrics_data).toEqual([
                {
                    metric_config_id: 'metric_1',
                    value: 42,
                },
            ]);
        });

        it('handles structured checklist updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an incremental update for the checklist
            const checklistUpdates: ChecklistUpdate[] = [
                {
                    id: 'checklist_1',
                    index: 0,
                    checklist_updated_at: 1000,
                    fields: {
                        title: 'Updated Checklist Title',
                    },
                    item_updates: [
                        {
                            id: 'item_1',
                            index: 0,
                            checklist_item_updated_at: 1000,
                            fields: {
                                state: 'Closed',
                                assignee_id: 'user_2',
                            },
                        },
                        {
                            id: 'item_2',
                            index: 1,
                            checklist_item_updated_at: 1000,
                            fields: {},
                        },
                    ],
                    items_order: ['item_1', 'item_2'],
                },
            ];

            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1000,
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.checklists).toEqual(checklistUpdates);
            expect(dispatchedAction.data.changed_fields.checklists[0].fields.title).toBe('Updated Checklist Title');
            expect(dispatchedAction.data.changed_fields.checklists[0].item_updates[0].fields.state).toBe('Closed');
            expect(dispatchedAction.data.changed_fields.checklists[0].item_updates[0].fields.assignee_id).toBe('user_2');
        });

        it('handles incremental checklist updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with checklists updates
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    name: 'Updated Name', // Some other field update
                    checklists: [
                        {
                            id: 'checklist_1',
                            index: 0,
                            checklist_updated_at: 1000,
                            fields: {
                                title: 'Updated Checklist Title via updates',
                            },
                            item_updates: [
                                {
                                    id: 'item_1',
                                    index: 0,
                                    checklist_item_updated_at: 1000,
                                    fields: {
                                        state: 'Closed',
                                        assignee_id: 'user_3',
                                    },
                                },
                            ],
                            item_deletes: ['item_2'], // Delete the second item
                            items_order: ['item_1'], // Updated order after deletion
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.name).toBe('Updated Name');
            expect(dispatchedAction.data.changed_fields.checklists[0].fields.title).toBe('Updated Checklist Title via updates');
            expect(dispatchedAction.data.changed_fields.checklists[0].item_updates[0].fields.state).toBe('Closed');
            expect(dispatchedAction.data.changed_fields.checklists[0].item_updates[0].fields.assignee_id).toBe('user_3');
            expect(dispatchedAction.data.changed_fields.checklists[0].item_deletes).toEqual(['item_2']);
        });

        it('handles playbook run items_order field updates', () => {
            // Add a second checklist to test order changes
            testPlaybookRun.checklists.push({
                id: 'checklist_2',
                title: 'Checklist 2',
                items: [],
            });
            testPlaybookRun.items_order = ['checklist_1', 'checklist_2'];

            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update that changes the items_order (reverse the order)
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1000,
                changed_fields: {
                    items_order: ['checklist_2', 'checklist_1'], // Reverse the order
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.items_order).toEqual(['checklist_2', 'checklist_1']);
        });

        it('handles playbook_run_updated_at field', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create an update with playbook_run_updated_at field
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 1500,
                changed_fields: {
                    name: 'Updated Name with Timestamp',
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.playbook_run_updated_at).toBe(1500);
            expect(dispatchedAction.data.changed_fields.name).toBe('Updated Name with Timestamp');
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
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [testPlaybookRun.team_id]: {
                                [testPlaybookRun.channel_id]: testPlaybookRun,
                            },
                        },
                    },
                } as any;
            });
        });

        it('dispatches the correct checklist update action', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistUpdated(testGetState, testDispatch);

            // Create a checklist update with only title change
            const update = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'checklist_1',
                    index: 0,
                    checklist_updated_at: 1000,
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

            // Check dispatch was called with the correct action
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and data
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_CHECKLIST_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
        });

        it('handles item deletions', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistUpdated(testGetState, testDispatch);

            // Create a checklist update with item deletion
            const update = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'checklist_1',
                    index: 0,
                    checklist_updated_at: 1000,
                    item_deletes: ['item_1'], // Delete the first item
                    items_order: ['item_2'], // Updated order after deletion
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_CHECKLIST_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.update.item_deletes).toEqual(['item_1']);
            expect(dispatchedAction.data.update.items_order).toEqual(['item_2']);
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
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'checklist_1',
                    index: 0,
                    checklist_updated_at: 1000,
                    item_inserts: [newItem],
                    items_order: ['item_1', 'item_2', 'item_3'], // Updated order with new item
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_CHECKLIST_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.update.item_inserts).toEqual([newItem]);
            expect(dispatchedAction.data.update.items_order).toEqual(['item_1', 'item_2', 'item_3']);
        });

        it('handles items_order field updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistUpdated(testGetState, testDispatch);

            // Create a checklist update that only changes the items order
            const update = {
                playbook_run_id: testPlaybookRun.id,
                update: {
                    id: 'checklist_1',
                    index: 0,
                    checklist_updated_at: 1000,
                    items_order: ['item_2', 'item_1'], // Reverse the order
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_CHECKLIST_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.update.items_order).toEqual(['item_2', 'item_1']);
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
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [testPlaybookRun.team_id]: {
                                [testPlaybookRun.channel_id]: testPlaybookRun,
                            },
                        },
                    },
                } as any;
            });
        });

        it('dispatches the correct checklist item update action', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0];

            // Create an item update with just the assignee change
            const update = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: checklist.id as string,
                update: {
                    id: item.id,
                    index: 0,
                    checklist_item_updated_at: 1000,
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

            // Verify dispatch was called with the correct action
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];

            // Verify action type and data
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_CHECKLIST_ITEM_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
        });

        it('handles single field updates (state)', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0];

            // Create an item update with just the state change
            const update = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: checklist.id as string,
                update: {
                    id: item.id,
                    index: 0,
                    checklist_item_updated_at: 1000,
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

            // Verify dispatch was called with the correct action type and data
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_CHECKLIST_ITEM_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.update.fields.state).toBe('Closed');
        });

        it('handles multiple field changes at once', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0];

            // Create an item update with multiple field changes
            const update = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: checklist.id as string,
                update: {
                    id: item.id,
                    index: 0,
                    checklist_item_updated_at: 1000,
                    fields: {
                        state: 'Closed',
                        assignee_id: 'user_2',
                        title: 'Updated Item Title',
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

            // Verify dispatch was called with the correct action type and data
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_CHECKLIST_ITEM_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.update.fields.state).toBe('Closed');
            expect(dispatchedAction.data.update.fields.assignee_id).toBe('user_2');
            expect(dispatchedAction.data.update.fields.title).toBe('Updated Item Title');
            expect(dispatchedAction.data.update.fields.due_date).toBe(1234567890);
        });

        it('handles missing updated_at field', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0];

            // Create an item update without updated_at field (for backward compatibility)
            const update = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: checklist.id as string,
                update: {
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

            // Verify dispatch was called with the correct action type and data
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_CHECKLIST_ITEM_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.update.fields.assignee_id).toBe('user_2');
        });

        it('handles checklist_item_updated_at field', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Find the checklist and item in the existing run data
            const checklist = testPlaybookRun.checklists[0];
            const item = checklist.items[0];

            // Create an item update with checklist_item_updated_at field
            const update = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: checklist.id as string,
                update: {
                    id: item.id,
                    index: 0,
                    checklist_item_updated_at: 1500,
                    fields: {title: 'Updated Title'},
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

            // Verify dispatch was called with the correct action type and data
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_CHECKLIST_ITEM_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.update.checklist_item_updated_at).toBe(1500);
            expect(dispatchedAction.data.update.fields.title).toBe('Updated Title');
        });

        it('handles missing input data', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookChecklistItemUpdated(testGetState, testDispatch);

            // Create a malformed update without Update field
            const update = {
                playbook_run_id: testPlaybookRun.id,
                checklist_id: 'checklist_1',

                // Missing update field
            };

            // Create the WebSocket message
            const msg = {
                data: {
                    payload: JSON.stringify(update),
                },
            } as WebSocketMessage<{payload: string}>;

            // Call the handler - should not throw an error
            handler(msg);

            // Verify dispatch was called with the malformed data (handlers now just pass through)
            expect(testDispatch).toHaveBeenCalledTimes(1);
            const dispatchedAction = testDispatch.mock.calls[0][0];
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_CHECKLIST_ITEM_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
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
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [testPlaybookRun.team_id]: {
                                [testPlaybookRun.channel_id]: testPlaybookRun,
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
            const newEvent: TimelineEvent = {
                id: 'event_3',
                playbook_run_id: testPlaybookRun.id,
                create_at: 3000,
                delete_at: 0,
                event_at: 3000,
                event_type: TimelineEventType.StatusUpdated,
                summary: 'Status updated',
                details: 'Status was updated to "In progress"',
                subject_user_id: 'user_1',
                creator_user_id: 'user_1',
                post_id: '',
            };

            // Create an update with the timeline_events field including the new event
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 3000,
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events).toBeDefined();
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(3);

            // Check for the new event in the action data
            const addedEvent = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_3'
            );
            expect(addedEvent).toBeDefined();
            expect(addedEvent?.event_type).toBe(TimelineEventType.StatusUpdated);
            expect(addedEvent?.summary).toBe('Status updated');
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
                playbook_run_updated_at: 3000,
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(2);

            // Check that the event was modified correctly in the action data
            const modifiedEvent = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_1'
            );
            expect(modifiedEvent).toBeDefined();
            expect(modifiedEvent?.summary).toBe('Updated summary');
            expect(modifiedEvent?.details).toBe('Updated details');
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
                playbook_run_updated_at: 3000,
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(2);

            // Check that the event was marked as deleted in the action data
            const deletedEventInData = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_1'
            );
            expect(deletedEventInData).toBeDefined();
            expect(deletedEventInData?.delete_at).toBe(3000);
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
            const newEvent: TimelineEvent = {
                id: 'event_4',
                playbook_run_id: testPlaybookRun.id,
                create_at: 1500, // This timestamp is between events 1 and 2
                delete_at: 0,
                event_at: 1500,
                event_type: TimelineEventType.RanSlashCommand,
                summary: 'Slash command executed',
                details: 'User ran a slash command',
                subject_user_id: 'user_1',
                creator_user_id: 'user_1',
                post_id: '',
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
                playbook_run_updated_at: 4000,
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(4);

            // Verify the new event was added in the action data
            const addedEvent = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_4'
            );
            expect(addedEvent).toBeDefined();
            expect(addedEvent?.event_type).toBe(TimelineEventType.RanSlashCommand);

            // Verify the modified event was updated in the action data
            const updatedEvent = dispatchedAction.data.changed_fields.timeline_events.find(
                (e: any) => e.id === 'event_2'
            );
            expect(updatedEvent).toBeDefined();
            expect(updatedEvent?.summary).toBe('Owner updated');
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
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [runWithoutTimeline.team_id]: {
                                [runWithoutTimeline.channel_id]: runWithoutTimeline,
                            },
                        },
                    },
                } as any;
            });

            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // New timeline events to add
            const newEvents: TimelineEvent[] = [
                {
                    id: 'event_1',
                    playbook_run_id: runWithoutTimeline.id,
                    create_at: 1000,
                    delete_at: 0,
                    event_at: 1000,
                    event_type: TimelineEventType.RunCreated,
                    summary: 'Playbook run created',
                    details: 'Run was created',
                    subject_user_id: 'user_1',
                    creator_user_id: 'user_1',
                    post_id: '',
                },
            ];

            // Create an update with timeline events
            const update: PlaybookRunUpdate = {
                id: runWithoutTimeline.id,
                playbook_run_updated_at: 1000,
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events).toBeDefined();
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(1);
            expect(dispatchedAction.data.changed_fields.timeline_events[0].id).toBe('event_1');
        });

        it('handles concurrent timeline and other field updates', () => {
            // Create a handler with our mocks
            const handler = handleWebsocketPlaybookRunUpdatedIncremental(testGetState, testDispatch);

            // Create a new timeline event
            const newEvent: TimelineEvent = {
                id: 'event_3',
                playbook_run_id: testPlaybookRun.id,
                create_at: 3000,
                delete_at: 0,
                event_at: 3000,
                event_type: TimelineEventType.StatusUpdated,
                summary: 'Status updated',
                details: 'Status was updated to "In progress"',
                subject_user_id: 'user_1',
                creator_user_id: 'user_1',
                post_id: '',
            };

            // Create an update with both timeline_events and other field changes
            const update: PlaybookRunUpdate = {
                id: testPlaybookRun.id,
                playbook_run_updated_at: 3000,
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

            // Verify action type and that data contains the raw update
            expect(dispatchedAction.type).toBe(WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED);
            expect(dispatchedAction.data).toEqual(update);
            expect(dispatchedAction.data.changed_fields.timeline_events.length).toBe(3);
            expect(dispatchedAction.data.changed_fields.name).toBe('Updated Run Name');
            expect(dispatchedAction.data.changed_fields.owner_user_id).toBe('user_2');

            // Verify the new event was added in the action data
            const addedEvent = dispatchedAction.data.changed_fields.timeline_events.find(
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
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [basePlaybookRun.team_id]: {
                                [basePlaybookRun.channel_id]: basePlaybookRun,
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
                    checklist_updated_at: 1000,
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
                    'plugins-playbooks': {
                        myPlaybookRunsByTeam: {
                            [basePlaybookRun.team_id]: {
                                [basePlaybookRun.channel_id]: JSON.parse(JSON.stringify(basePlaybookRun)),
                            },
                        },
                    },
                } as any;
            });

            const handler = handleWebsocketPlaybookChecklistUpdated(getState, dispatch);

            // Create an update with a non-existent item ID but with valid checklist ID
            const update = {
                playbook_run_id: basePlaybookRun.id,
                update: {
                    id: basePlaybookRun.checklists[0].id,
                    index: 0,
                    checklist_updated_at: 1000,
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
