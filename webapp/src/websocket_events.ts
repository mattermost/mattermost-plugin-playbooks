// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {GetStateFunc} from 'mattermost-redux/types/actions';
import {Post} from '@mattermost/types/posts';
import {WebSocketMessage} from '@mattermost/client';
import {getCurrentTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {PlaybookRun, StatusPost} from 'src/types/playbook_run';

import {navigateToUrl} from 'src/browser_routing';
import {
    playbookArchived,
    playbookCreated,
    playbookRestored,
    playbookRunCreated,
    playbookRunUpdated,
    receivedTeamPlaybookRuns,
    removedFromPlaybookRunChannel,
} from 'src/actions';
import {fetchPlaybookRun, fetchPlaybookRunByChannel, fetchPlaybookRuns} from 'src/client';
import {clientId, myPlaybookRunsMap} from 'src/selectors';
import {ChecklistItemUpdate, ChecklistUpdate, PlaybookRunUpdate} from 'src/types/websocket_events';

export const websocketSubscribersToPlaybookRunUpdate = new Set<(playbookRun: PlaybookRun) => void>();

export function handleReconnect(getState: GetStateFunc, dispatch: Dispatch) {
    return async (): Promise<void> => {
        const currentTeam = getCurrentTeam(getState());
        const currentUserId = getCurrentUserId(getState());

        if (!currentTeam || !currentUserId) {
            return;
        }

        const fetched = await fetchPlaybookRuns({
            page: 0,
            per_page: 0,
            team_id: currentTeam.id,
            participant_id: currentUserId,
        });

        dispatch(receivedTeamPlaybookRuns(fetched.items));
    };
}

export function handleWebsocketPlaybookRunUpdated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }
        const data = JSON.parse(msg.data.payload);

        // This always processes the full update (existing behavior)
        const playbookRun = data as PlaybookRun;
        dispatch(playbookRunUpdated(playbookRun));
        websocketSubscribersToPlaybookRunUpdate.forEach((fn) => fn(playbookRun));
    };
}

// Separate handler for incremental updates
export function handleWebsocketPlaybookRunUpdatedIncremental(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }
        const data = JSON.parse(msg.data.payload);

        // This is an incremental update
        const update = data as PlaybookRunUpdate;
        const state = getState();
        const runsState = (state.entities as any).playbookRuns?.runs;

        // Get the current state of the playbook run
        const currentRun = runsState[update.id];

        if (!currentRun) {
            // If we don't have the current state, we need to fetch the full playbook run
            // This should be rare but can happen if client state gets out of sync
            fetchPlaybookRun(update.id).then((fullRun) => {
                dispatch(playbookRunUpdated(fullRun));
                websocketSubscribersToPlaybookRunUpdate.forEach((fn) => fn(fullRun));
            }).catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Error fetching playbook run after incremental update:', error);
            });
            return;
        }

        // Clone the current run to create an updated version
        const updatedRun = {...currentRun};

        // Apply the changed fields to the run
        applyChangedFields(updatedRun, update.changed_fields);

        // Dispatch the updated run
        dispatch(playbookRunUpdated(updatedRun));
        websocketSubscribersToPlaybookRunUpdate.forEach((fn) => fn(updatedRun));
    };
}

// Helper function to apply changed fields to a playbook run
function applyChangedFields(run: PlaybookRun, changedFields: Record<string, any>) {
    // Apply simple field changes first
    for (const [field, value] of Object.entries(changedFields)) {
        // Skip special fields that need custom handling
        if (field === 'checklist_updates' || field === 'checklists' || field === 'timeline_events') {
            continue;
        }

        // Apply the change to the run
        (run as any)[field] = value;
    }

    // Handle timeline events specially by merging them with existing events
    if (changedFields.timeline_events) {
        // If we don't have any existing timeline events, just set them
        if (!run.timeline_events || !Array.isArray(run.timeline_events)) {
            run.timeline_events = changedFields.timeline_events;
        } else {
            // Merge new timeline events with existing ones
            // Create a map of existing events by ID for quick lookup
            const existingEventsMap = new Map();
            run.timeline_events.forEach(event => {
                if (event && event.id) {
                    existingEventsMap.set(event.id, event);
                }
            });

            // Process each event from the update
            changedFields.timeline_events.forEach(newEvent => {
                if (newEvent && newEvent.id) {
                    // If an event with this ID already exists, replace it
                    // Otherwise, it's a new event to add
                    existingEventsMap.set(newEvent.id, newEvent);
                }
            });

            // Convert the map back to an array and sort by createAt if available
            run.timeline_events = Array.from(existingEventsMap.values());
            run.timeline_events.sort((a, b) => (a.createAt || 0) - (b.createAt || 0));
        }
    }

    // If we have the entire checklists array, replace it
    if (changedFields.checklists) {
        run.checklists = changedFields.checklists;
        return;
    }

    // Apply checklist updates if available
    if (changedFields.checklist_updates) {
        applyChecklistUpdates(run, changedFields.checklist_updates);
    }
}

// Helper function to apply checklist updates
function applyChecklistUpdates(run: PlaybookRun, updates: ChecklistUpdate[]) {
    for (const update of updates) {
        // Find the checklist to update
        const checklistIndex = run.checklists.findIndex((cl: any) => cl.id === update.id);
        if (checklistIndex === -1) {
            continue;
        }

        // Make a copy of the checklist
        const checklist = {...run.checklists[checklistIndex]};

        // Apply checklist field updates
        if (update.fields) {
            for (const [field, value] of Object.entries(update.fields)) {
                (checklist as any)[field] = value;
            }
        }

        // Apply item updates
        if (update.item_updates && update.item_updates.length > 0) {
            checklist.items = [...checklist.items]; // Make a copy of the items array

            for (const itemUpdate of update.item_updates) {
                const itemIndex = checklist.items.findIndex((item) => item.id === itemUpdate.id);
                if (itemIndex === -1) {
                    continue;
                }

                // Update the item with changed fields
                checklist.items[itemIndex] = {
                    ...checklist.items[itemIndex],
                    ...itemUpdate.fields,
                };
            }
        }

        // Apply item deletions
        if (update.item_deletes && update.item_deletes.length > 0) {
            checklist.items = checklist.items.filter((item: any) => {
                // Don't include items whose IDs are in the item_deletes array
                return !update.item_deletes?.includes(item.id as string);
            });
        }

        // Apply item insertions
        if (update.item_inserts && update.item_inserts.length > 0) {
            checklist.items = [...checklist.items, ...update.item_inserts];
        }

        // Update the checklist in the run
        run.checklists[checklistIndex] = checklist;
    }
}

export function handleWebsocketPlaybookRunCreated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }
        const payload = JSON.parse(msg.data.payload);
        const data = payload.playbook_run;
        const playbookRun = data as PlaybookRun;

        dispatch(playbookRunCreated(playbookRun));

        if (payload.client_id !== clientId(getState())) {
            return;
        }

        const currentTeam = getCurrentTeam(getState());

        // Navigate to the newly created channel
        const pathname = `/${currentTeam.name}/channels/${payload.channel_name}`;
        const search = '?forceRHSOpen';
        navigateToUrl({pathname, search});
    };
}

export function handleWebsocketPlaybookCreated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        const payload = JSON.parse(msg.data.payload);

        dispatch(playbookCreated(payload.teamID));
    };
}

export function handleWebsocketPlaybookArchived(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        const payload = JSON.parse(msg.data.payload);

        dispatch(playbookArchived(payload.teamID));
    };
}

export function handleWebsocketPlaybookRestored(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        const payload = JSON.parse(msg.data.payload);

        dispatch(playbookRestored(payload.teamID));
    };
}

export function handleWebsocketUserAdded(getState: GetStateFunc, dispatch: Dispatch) {
    return async (msg: WebSocketMessage<{ team_id: string, user_id: string }>) => {
        const currentUserId = getCurrentUserId(getState());
        const currentTeamId = getCurrentTeamId(getState());
        if (currentUserId === msg.data.user_id && currentTeamId === msg.data.team_id) {
            try {
                const playbookRun = await fetchPlaybookRunByChannel(msg.broadcast.channel_id);
                dispatch(receivedTeamPlaybookRuns([playbookRun]));
            } catch (error) {
                if (error.status_code !== 404) {
                    throw error;
                }
            }
        }
    };
}

export function handleWebsocketUserRemoved(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ channel_id: string, user_id: string }>) => {
        const currentUserId = getCurrentUserId(getState());
        if (currentUserId === msg.broadcast.user_id) {
            dispatch(removedFromPlaybookRunChannel(msg.data.channel_id));
        }
    };
}

// Handler for playbook_checklist_updated events
export function handleWebsocketPlaybookChecklistUpdated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        const data = JSON.parse(msg.data.payload);

        // Get the update data from the payload which contains PlaybookRunID and Update
        const updateData = data.Update as ChecklistUpdate;
        const runID = data.PlaybookRunID;

        // Initialize updateData if it's undefined
        if (!updateData) {
            // eslint-disable-next-line no-console
            console.error('Update data missing in checklist update event');
            return;
        }

        // Skip if missing updated_at field (for backward compatibility)
        if (!updateData.updated_at) {
            updateData.updated_at = Date.now();
        }

        const state = getState();
        const runsState = (state.entities as any).playbookRuns?.runs;

        // Get the current state of the playbook run
        const currentRun = runsState[runID];

        if (!currentRun) {
            // If we don't have the current state, we need to fetch the full playbook run
            fetchPlaybookRun(runID).then((fullRun) => {
                dispatch(playbookRunUpdated(fullRun));
                websocketSubscribersToPlaybookRunUpdate.forEach((fn) => fn(fullRun));
            }).catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Error fetching playbook run after checklist update:', error);
            });
            return;
        }

        // Clone the current run to create an updated version
        const updatedRun = {...currentRun};

        // Find the checklist to update
        const checklistIndex = updatedRun.checklists.findIndex((cl: any) => cl.id === updateData.id);
        if (checklistIndex === -1) {
            return;
        }

        // Make a copy of the checklist
        const checklist = {...updatedRun.checklists[checklistIndex]};

        // Apply checklist field updates
        if (updateData.fields) {
            for (const [field, value] of Object.entries(updateData.fields)) {
                (checklist as any)[field] = value;
            }
        }

        // Apply item deletions
        if (updateData.item_deletes && updateData.item_deletes.length > 0) {
            checklist.items = checklist.items.filter((item: any) => {
                // Don't include items whose IDs are in the item_deletes array
                return !updateData.item_deletes?.includes(item.id as string);
            });
        }

        // Apply item insertions
        if (updateData.item_inserts && updateData.item_inserts.length > 0) {
            checklist.items = [...checklist.items, ...updateData.item_inserts];
        }

        // Update the checklist in the run
        updatedRun.checklists[checklistIndex] = checklist;

        // Dispatch the updated run
        dispatch(playbookRunUpdated(updatedRun));
        websocketSubscribersToPlaybookRunUpdate.forEach((fn) => fn(updatedRun));
    };
}

// Handler for playbook_checklist_item_updated events
export function handleWebsocketPlaybookChecklistItemUpdated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        const data = JSON.parse(msg.data.payload);

        // Initialize update data if it's undefined
        if (!data.Update) {
            // eslint-disable-next-line no-console
            console.error('Update data missing in checklist item update event');
            return;
        }

        const itemData = data.Update as ChecklistItemUpdate;
        const runID = data.PlaybookRunID;
        const checklistID = data.ChecklistID;

        if (!itemData.id || !runID || !checklistID) {
            // eslint-disable-next-line no-console
            console.error('Missing required fields in checklist item update event');
            return;
        }

        const state = getState();
        const runsState = (state.entities as any).playbookRuns?.runs;

        // Get the current state of the playbook run
        const currentRun = runsState[runID];

        if (!currentRun) {
            // If we don't have the current state, we need to fetch the full playbook run
            fetchPlaybookRun(runID).then((fullRun) => {
                dispatch(playbookRunUpdated(fullRun));
                websocketSubscribersToPlaybookRunUpdate.forEach((fn) => fn(fullRun));
            }).catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Error fetching playbook run after item update:', error);
            });
            return;
        }

        // Clone the current run to create an updated version
        const updatedRun = {...currentRun};

        // Find the checklist that contains the item
        const checklist = updatedRun.checklists.find((cl: any) => cl.id === checklistID);
        if (!checklist) {
            return;
        }

        // Find the item to update
        const itemIndex = checklist.items.findIndex((item: any) => item.id === itemData.id);
        if (itemIndex === -1) {
            return;
        }

        // Create a copy of the items array and the specific item
        const itemsCopy = [...checklist.items];
        const updatedItem = {...itemsCopy[itemIndex]};

        // Apply all fields from the update
        if (itemData.fields) {
            for (const [key, value] of Object.entries(itemData.fields)) {
                (updatedItem as any)[key] = value;
            }
        }

        // Update the item in the items array
        itemsCopy[itemIndex] = updatedItem;

        // Update the checklist with the new items array
        const checklistIndex = updatedRun.checklists.findIndex((cl: any) => cl.id === checklistID);
        updatedRun.checklists[checklistIndex] = {
            ...checklist,
            items: itemsCopy,
        };

        // Dispatch the updated run
        dispatch(playbookRunUpdated(updatedRun));
        websocketSubscribersToPlaybookRunUpdate.forEach((fn) => fn(updatedRun));
    };
}

async function getPlaybookRunFromStatusUpdate(post: Post): Promise<PlaybookRun | null> {
    let playbookRun: PlaybookRun;
    try {
        playbookRun = await fetchPlaybookRunByChannel(post.channel_id);
    } catch (err) {
        return null;
    }

    if (playbookRun.status_posts.find((value: StatusPost) => post.id === value.id)) {
        return playbookRun;
    }

    return null;
}

export const handleWebsocketPostEditedOrDeleted = (getState: GetStateFunc, dispatch: Dispatch) => {
    return async (msg: WebSocketMessage<{ post: string }>) => {
        const playbookRunsMap = myPlaybookRunsMap(getState());
        if (playbookRunsMap[msg.broadcast.channel_id]) {
            const playbookRun = await getPlaybookRunFromStatusUpdate(JSON.parse(msg.data.post));
            if (playbookRun) {
                dispatch(playbookRunUpdated(playbookRun));
                websocketSubscribersToPlaybookRunUpdate.forEach((fn) => fn(playbookRun));
            }
        }
    };
};

export const handleWebsocketChannelUpdated = (getState: GetStateFunc, dispatch: Dispatch) => {
    return async (msg: WebSocketMessage<{ channel: string }>) => {
        const channel = JSON.parse(msg.data.channel);

        // Ignore updates to non-playbook run channels.
        const playbookRunsMap = myPlaybookRunsMap(getState());
        if (!playbookRunsMap[channel.id]) {
            return;
        }

        // Fetch the updated playbook run, since some metadata (like playbook run name) comes directly
        // from the channel, and the plugin cannot detect channel update events for itself.
        const playbookRun = await fetchPlaybookRunByChannel(channel.id);
        if (playbookRun) {
            dispatch(playbookRunUpdated(playbookRun));
        }
    };
};