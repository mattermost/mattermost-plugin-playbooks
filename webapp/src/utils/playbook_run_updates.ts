// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaybookRun} from 'src/types/playbook_run';
import {Checklist, ChecklistItem} from 'src/types/playbook';
import {TimelineEvent} from 'src/types/rhs';
import {
    ChecklistItemUpdatePayload,
    ChecklistUpdate,
    ChecklistUpdatePayload,
    PlaybookRunUpdate,
} from 'src/types/websocket_events';

// Helper function to apply incremental updates idempotently
export function applyIncrementalUpdate(currentRun: PlaybookRun, update: PlaybookRunUpdate): PlaybookRun {
    // Create a new run object with the timestamp update
    let updatedRun = {
        ...currentRun,
        ...(update.playbook_run_updated_at && {update_at: update.playbook_run_updated_at}),
    };

    // Apply checklist deletions first
    if (update.checklist_deletes && update.checklist_deletes.length > 0) {
        const deleteSet = new Set(update.checklist_deletes);
        updatedRun = {
            ...updatedRun,
            checklists: updatedRun.checklists.filter((checklist) => checklist.id && !deleteSet.has(checklist.id)),
        };
    }

    // Apply the changed fields to get a new run
    updatedRun = applyChangedFields(updatedRun, update.changed_fields);

    return updatedRun;
}

// Helper function to apply changed fields to a playbook run
function applyChangedFields(run: PlaybookRun, changedFields: PlaybookRunUpdate['changed_fields']): PlaybookRun {
    // Start with a shallow copy of the run
    let updatedRun = {...run};

    // Apply simple field changes first
    for (const [field, value] of Object.entries(changedFields)) {
        // Skip special fields that need custom handling
        if (field === 'checklists' || field === 'timeline_events') {
            continue;
        }

        // Apply the change to the run using type-safe property assignment
        if (field in updatedRun) {
            updatedRun = {
                ...updatedRun,
                [field]: value,
            };
        }
    }

    // Handle timeline events specially by merging them with existing events
    if (changedFields.timeline_events) {
        updatedRun = applyTimelineUpdates(updatedRun, changedFields.timeline_events);
    }

    // Apply checklist updates if provided by the server
    if (changedFields.checklists) {
        updatedRun = applyChecklistUpdates(updatedRun, changedFields.checklists);
    }

    return updatedRun;
}

// Helper function to apply timeline updates (moved from websocket_events.ts)
function applyTimelineUpdates(run: PlaybookRun, timelineEvents: TimelineEvent[]): PlaybookRun {
    // If we don't have any existing timeline events, just set them
    if (!run.timeline_events || !Array.isArray(run.timeline_events)) {
        return {
            ...run,
            timeline_events: [...timelineEvents],
        };
    }

    // Merge new timeline events with existing ones
    // Create a map of existing events by ID for quick lookup
    const existingEventsMap = new Map<string, TimelineEvent>();
    run.timeline_events.forEach((event) => {
        if (event?.id) {
            existingEventsMap.set(event.id, event);
        }
    });

    // Process each event from the update
    timelineEvents.forEach((newEvent) => {
        if (newEvent?.id) {
            // If an event with this ID already exists, replace it
            // Otherwise, it's a new event to add
            existingEventsMap.set(newEvent.id, newEvent);
        }
    });

    // Convert the map back to an array and sort by create_at
    const updatedEvents = Array.from(existingEventsMap.values());
    updatedEvents.sort((a, b) => a.create_at - b.create_at);

    return {
        ...run,
        timeline_events: updatedEvents,
    };
}

// Helper function to apply checklist updates (moved from websocket_events.ts)
function applyChecklistUpdates(run: PlaybookRun, updates: ChecklistUpdate[]): PlaybookRun {
    let updatedChecklists = [...run.checklists];

    for (const update of updates) {
        // Find the checklist to update
        const checklistIndex = updatedChecklists.findIndex((cl: Checklist) => cl.id === update.id);
        if (checklistIndex === -1) {
            // Checklist not found - this is a new checklist creation
            // Create a new checklist with the provided fields
            const newChecklist: Checklist = {
                id: update.id,
                title: '',
                items: update.item_inserts ? [...update.item_inserts] : [],
                ...update.fields, // Apply the fields (like title)
            } as Checklist;

            // Add the new checklist to the run
            updatedChecklists = [...updatedChecklists, newChecklist];
            continue;
        }

        // Get the current checklist and create an updated version
        let updatedChecklist = {...updatedChecklists[checklistIndex]};

        // Apply checklist field updates
        if (update.fields) {
            for (const [field, value] of Object.entries(update.fields)) {
                if (field in updatedChecklist && field !== 'items') {
                    updatedChecklist = {
                        ...updatedChecklist,
                        [field]: value,
                    };
                }
            }
        }

        // Handle items_order separately from update.fields
        if (update.items_order) {
            updatedChecklist = {
                ...updatedChecklist,
                items_order: update.items_order,
            } as Checklist & { items_order: string[] };
        }

        // Apply item updates
        let updatedItems = [...updatedChecklist.items];
        if (update.item_updates && update.item_updates.length > 0) {
            for (const itemUpdate of update.item_updates) {
                const itemIndex = updatedItems.findIndex((item) => item.id === itemUpdate.id);
                if (itemIndex !== -1) {
                    // Update the item with changed fields
                    updatedItems[itemIndex] = {
                        ...updatedItems[itemIndex],
                        ...itemUpdate.fields,
                    };
                }
            }
        }

        // Apply item deletions using Set for efficient lookup
        if (update.item_deletes && update.item_deletes.length > 0) {
            const deleteSet = new Set(update.item_deletes);
            updatedItems = updatedItems.filter((item) => !item.id || !deleteSet.has(item.id));
        }

        // Apply item insertions with duplicate prevention
        if (update.item_inserts && update.item_inserts.length > 0) {
            // Build a set of existing item IDs to prevent duplicates
            const existingItemIds = new Set(updatedItems.map((item) => item.id).filter(Boolean));
            const newItems = update.item_inserts.filter((item) => item.id && !existingItemIds.has(item.id));
            updatedItems = [...updatedItems, ...newItems];
        }

        // Update the checklist with the new items
        updatedChecklist = {
            ...updatedChecklist,
            items: updatedItems,
        };

        // Update the checklist in the array
        updatedChecklists[checklistIndex] = updatedChecklist;
    }

    return {
        ...run,
        checklists: updatedChecklists,
    };
}

// Checklist update - prevents duplicates and race conditions
export function applyChecklistUpdate(currentRun: PlaybookRun, payload: ChecklistUpdatePayload): PlaybookRun {
    const updateData = payload.update;

    // Require server timestamp - reject updates without proper timestamps
    if (!updateData.checklist_updated_at) {
        return currentRun;
    }

    // Clone the current run to create an updated version
    const updatedRun = {...currentRun};
    const updatedChecklists = [...updatedRun.checklists];

    // Find the checklist to update
    const checklistIndex = updatedRun.checklists.findIndex((cl) => cl.id === updateData.id);
    if (checklistIndex === -1) {
        // Checklist not found - this is a new checklist creation
        // Create a new checklist with the provided fields
        const newChecklist = {
            id: updateData.id,
            title: '',
            items: [] as ChecklistItem[],
            update_at: updateData.checklist_updated_at,
            ...updateData.fields, // Apply the fields (like title)
        } as Checklist;

        // Apply item insertions if provided
        if (updateData.item_inserts && updateData.item_inserts.length > 0) {
            newChecklist.items = [...updateData.item_inserts];
        }

        // Add the new checklist to the run
        updatedRun.checklists = [...updatedRun.checklists, newChecklist];
        return updatedRun;
    }

    // Enhanced idempotency check - consider both timestamp and content
    const currentChecklist = updatedRun.checklists[checklistIndex];

    // First check: timestamp-based idempotency (traditional approach)
    if (currentChecklist.update_at && updateData.checklist_updated_at &&
        currentChecklist.update_at >= updateData.checklist_updated_at) {
        // We already have a newer or equal update, skip this one
        return currentRun;
    }

    // Second check: content-based idempotency for item insertions
    if (updateData.item_inserts && updateData.item_inserts.length > 0) {
        const existingItemIds = new Set(currentChecklist.items.map((item) => item.id).filter(Boolean));
        const alreadyExistingItems = updateData.item_inserts.filter((item) => item.id && existingItemIds.has(item.id));

        // If all items to be inserted already exist, this might be a duplicate event
        if (alreadyExistingItems.length === updateData.item_inserts.length) {
            // Check if this is likely a duplicate by comparing timestamps of existing items
            const hasNewerItems = alreadyExistingItems.every((insertItem) => {
                const existingItem = currentChecklist.items.find((item) => item.id === insertItem.id);
                return existingItem && existingItem.update_at && insertItem.update_at &&
                       existingItem.update_at >= insertItem.update_at;
            });

            if (hasNewerItems) {
                // All items already exist with newer or equal timestamps, skip this update
                return currentRun;
            }
        }
    }

    // Make a copy of the checklist
    const checklist = {...updatedRun.checklists[checklistIndex]};

    // Apply checklist field updates
    if (updateData.fields) {
        const validFields = Object.fromEntries(
            Object.entries(updateData.fields).filter(([field]) => field in checklist && field !== 'items')
        );
        Object.assign(checklist, validFields);
    }

    // Handle items_order separately
    if (updateData.items_order) {
        checklist.items_order = updateData.items_order;
    }

    // Update the timestamp to reflect this update
    checklist.update_at = updateData.checklist_updated_at;

    // Apply item deletions first to avoid conflicts using Set for efficient lookup
    if (updateData.item_deletes && updateData.item_deletes.length > 0) {
        const deleteSet = new Set(updateData.item_deletes);
        checklist.items = checklist.items.filter((item) => {
            return !item.id || !deleteSet.has(item.id);
        });
    }

    // Apply item insertions with improved duplicate prevention
    if (updateData.item_inserts && updateData.item_inserts.length > 0) {
        // First, check for duplicates within the current checklist only
        const existingItemIds = new Set(checklist.items.map((item) => item.id).filter(Boolean));
        const newItems = updateData.item_inserts.filter((item) => item.id && !existingItemIds.has(item.id));

        if (newItems.length > 0) {
            checklist.items = [...checklist.items, ...newItems];
        }
    }

    // Update the checklist in the run
    updatedChecklists[checklistIndex] = checklist;
    updatedRun.checklists = updatedChecklists;

    return updatedRun;
}

// Checklist item update - prevents duplicates
export function applyChecklistItemUpdate(currentRun: PlaybookRun, payload: ChecklistItemUpdatePayload): PlaybookRun {
    const itemData = payload.update;
    const checklistID = payload.checklist_id;

    if (!itemData.id || !checklistID) {
        // Missing required fields, return unchanged
        return currentRun;
    }

    // Require server timestamp - reject updates without proper timestamps
    if (!itemData.checklist_item_updated_at) {
        return currentRun;
    }

    // Clone the current run to create an updated version
    const updatedRun = {...currentRun};
    const updatedChecklists = [...updatedRun.checklists];

    // Find the checklist that contains the item
    const checklist = updatedRun.checklists.find((cl) => cl.id === checklistID);
    if (!checklist) {
        // Checklist not found, return unchanged
        return currentRun;
    }

    // Find the item to update
    const itemIndex = checklist.items.findIndex((item) => item.id === itemData.id);
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
        const validFields = Object.fromEntries(
            Object.entries(itemData.fields).filter(([key]) => key in updatedItem)
        );
        Object.assign(updatedItem, validFields);
    }

    // Update the timestamp to reflect this update
    updatedItem.update_at = itemData.checklist_item_updated_at;

    // Update the item in the items array
    itemsCopy[itemIndex] = updatedItem;

    // Update the checklist with the new items array
    const checklistIndex = updatedRun.checklists.findIndex((cl) => cl.id === checklistID);
    updatedChecklists[checklistIndex] = {
        ...checklist,
        items: itemsCopy,
    };
    updatedRun.checklists = updatedChecklists;

    return updatedRun;
}