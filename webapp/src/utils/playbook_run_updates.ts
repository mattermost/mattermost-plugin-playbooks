// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaybookRun} from 'src/types/playbook_run';
import {Checklist} from 'src/types/playbook';
import {
    ChecklistItemUpdatePayload,
    ChecklistUpdate,
    ChecklistUpdatePayload,
    PlaybookRunUpdate,
} from 'src/types/websocket_events';

// Helper function to apply incremental updates idempotently
export function applyIncrementalUpdate(currentRun: PlaybookRun, update: PlaybookRunUpdate): PlaybookRun {
    // Clone the current run to create an updated version
    const updatedRun = {...currentRun};

    // Apply the changed fields to the run
    applyChangedFields(updatedRun, update.changed_fields);

    return updatedRun;
}

// Helper function to apply changed fields to a playbook run (moved from websocket_events.ts)
function applyChangedFields(run: PlaybookRun, changedFields: PlaybookRunUpdate['changed_fields']) {
    // Apply simple field changes first
    for (const [field, value] of Object.entries(changedFields)) {
        // Skip special fields that need custom handling
        if (field === 'checklists' || field === 'timeline_events') {
            continue;
        }

        // Apply the change to the run
        (run as any)[field] = value;
    }

    // Handle timeline events specially by merging them with existing events
    if (changedFields.timeline_events) {
        applyTimelineUpdates(run, changedFields.timeline_events);
    }

    // Apply checklist updates if provided by the server
    if (changedFields.checklists) {
        applyChecklistUpdates(run, changedFields.checklists);
    }
}

// Helper function to apply timeline updates (moved from websocket_events.ts)
function applyTimelineUpdates(run: PlaybookRun, timelineEvents: any[]) {
    // If we don't have any existing timeline events, just set them
    if (!run.timeline_events || !Array.isArray(run.timeline_events)) {
        run.timeline_events = timelineEvents;
    } else {
        // Merge new timeline events with existing ones
        // Create a map of existing events by ID for quick lookup
        const existingEventsMap = new Map();
        run.timeline_events.forEach((event) => {
            if (event && event.id) {
                existingEventsMap.set(event.id, event);
            }
        });

        // Process each event from the update
        timelineEvents.forEach((newEvent) => {
            if (newEvent && newEvent.id) {
                // If an event with this ID already exists, replace it
                // Otherwise, it's a new event to add
                existingEventsMap.set(newEvent.id, newEvent);
            }
        });

        // Convert the map back to an array and sort by create_at if available
        run.timeline_events = Array.from(existingEventsMap.values());
        run.timeline_events.sort((a, b) => (a.create_at || 0) - (b.create_at || 0));
    }
}

// Helper function to apply checklist updates (moved from websocket_events.ts)
function applyChecklistUpdates(run: PlaybookRun, updates: ChecklistUpdate[]) {
    for (const update of updates) {
        // Find the checklist to update
        const checklistIndex = run.checklists.findIndex((cl: Checklist) => cl.id === update.id);
        if (checklistIndex === -1) {
            continue;
        }

        // Make a copy of the checklist
        const updatedChecklists = [...run.checklists];
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
                const updatedItem = {
                    ...checklist.items[itemIndex],
                    ...itemUpdate.fields,
                };
                checklist.items[itemIndex] = updatedItem;
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
        updatedChecklists[checklistIndex] = checklist;
        run.checklists = updatedChecklists;
    }
}

// Idempotent checklist update - prevents duplicates and race conditions
export function applyChecklistUpdateIdempotent(currentRun: PlaybookRun, payload: ChecklistUpdatePayload): PlaybookRun {
    const updateData = payload.update;

    // Skip if missing checklist_updated_at field (for backward compatibility)
    if (!updateData.checklist_updated_at) {
        updateData.checklist_updated_at = Date.now();
    }

    // Clone the current run to create an updated version
    const updatedRun = {...currentRun};
    const updatedChecklists = [...updatedRun.checklists];

    // Find the checklist to update
    const checklistIndex = updatedRun.checklists.findIndex((cl: any) => cl.id === updateData.id);
    if (checklistIndex === -1) {
        // Checklist not found - this might be a race condition where the incremental update hasn't been applied yet
        // Return the current run unchanged rather than failing
        return currentRun;
    }

    // Check if this update is newer than what we already have (idempotency check)
    const currentChecklist = updatedRun.checklists[checklistIndex];
    if (currentChecklist.update_at && updateData.checklist_updated_at &&
        currentChecklist.update_at >= updateData.checklist_updated_at) {
        // We already have a newer or equal update, skip this one
        return currentRun;
    }

    // Make a copy of the checklist
    const checklist = {...updatedRun.checklists[checklistIndex]};

    // Apply checklist field updates
    if (updateData.fields) {
        for (const [field, value] of Object.entries(updateData.fields)) {
            (checklist as any)[field] = value;
        }
    }

    // Update the timestamp to reflect this update
    checklist.update_at = updateData.checklist_updated_at;

    // Apply item deletions first to avoid conflicts
    if (updateData.item_deletes && updateData.item_deletes.length > 0) {
        checklist.items = checklist.items.filter((item: any) => {
            return !updateData.item_deletes?.includes(item.id as string);
        });
    }

    // Apply item insertions - check for duplicates
    if (updateData.item_inserts && updateData.item_inserts.length > 0) {
        const existingItemIds = new Set(checklist.items.map((item: any) => item.id));
        const newItems = updateData.item_inserts.filter((item) => !existingItemIds.has(item.id));
        checklist.items = [...checklist.items, ...newItems];
    }

    // Update the checklist in the run
    updatedChecklists[checklistIndex] = checklist;
    updatedRun.checklists = updatedChecklists;

    return updatedRun;
}

// Idempotent checklist item update - prevents duplicates
export function applyChecklistItemUpdateIdempotent(currentRun: PlaybookRun, payload: ChecklistItemUpdatePayload): PlaybookRun {
    const itemData = payload.update;
    const checklistID = payload.checklist_id;

    if (!itemData.id || !checklistID) {
        // Missing required fields, return unchanged
        return currentRun;
    }

    // Clone the current run to create an updated version
    const updatedRun = {...currentRun};
    const updatedChecklists = [...updatedRun.checklists];

    // Find the checklist that contains the item
    const checklist = updatedRun.checklists.find((cl: any) => cl.id === checklistID);
    if (!checklist) {
        // Checklist not found, return unchanged
        return currentRun;
    }

    // Find the item to update
    const itemIndex = checklist.items.findIndex((item: any) => item.id === itemData.id);
    if (itemIndex === -1) {
        // Item not found, return unchanged
        return currentRun;
    }

    // Check if this update is newer (idempotency check)
    const currentItem = checklist.items[itemIndex];
    if (currentItem.update_at && itemData.checklist_item_updated_at &&
        currentItem.update_at >= itemData.checklist_item_updated_at) {
        // We already have a newer or equal update, skip this one
        return currentRun;
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

    // Update the timestamp to reflect this update
    updatedItem.update_at = itemData.checklist_item_updated_at;

    // Update the item in the items array
    itemsCopy[itemIndex] = updatedItem;

    // Update the checklist with the new items array
    const checklistIndex = updatedRun.checklists.findIndex((cl: any) => cl.id === checklistID);
    updatedChecklists[checklistIndex] = {
        ...checklist,
        items: itemsCopy,
    };
    updatedRun.checklists = updatedChecklists;

    return updatedRun;
}