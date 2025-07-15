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
    // Check if this update is older than the current state
    if (currentRun.update_at && update.playbook_run_updated_at &&
        update.playbook_run_updated_at > 0 &&
        currentRun.update_at >= update.playbook_run_updated_at) {
        // We already have a newer or equal update, skip this one
        return currentRun;
    }

    // Create a new run object with the timestamp update
    // If update timestamp is 0 or missing, preserve original timestamp
    let updatedRun = {
        ...currentRun,
        update_at: update.playbook_run_updated_at && update.playbook_run_updated_at > 0 ?
            update.playbook_run_updated_at :
            currentRun.update_at,
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
    const {timeline_events, checklists, ...basicFields} = changedFields;

    // Apply only valid basic fields with type safety
    const validBasicFields = Object.fromEntries(
        Object.entries(basicFields).filter(([field]) => field in run)
    );

    let updatedRun = {...run, ...validBasicFields};

    // Handle timeline events specially by merging them with existing events
    if (timeline_events) {
        updatedRun = applyTimelineUpdates(updatedRun, timeline_events);
    }

    // Apply checklist updates if provided by the server
    if (checklists) {
        updatedRun = applyChecklistUpdates(updatedRun, checklists);
    }

    return updatedRun;
}

// Helper function to apply timeline updates
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

// Utility to create a Map from an array of objects with IDs
const mapFromChecklists = (checklists: Checklist[]) => {
    return new Map(checklists.map((checklist) => [checklist.id, checklist]));
};

// Helper to create a new checklist from an update
function createNewChecklist(update: ChecklistUpdate): Checklist {
    const baseChecklist: Checklist = {
        id: update.id,
        title: '',
        items: update.item_inserts ? [...update.item_inserts] : [],
    };

    // Apply field updates if provided (excluding items which are handled separately)
    if (update.fields) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {items: _, ...otherFields} = update.fields;
        return {
            ...baseChecklist,
            ...otherFields,
        };
    }

    return baseChecklist;
}

// Helper to apply item-level updates to a checklist
function applyItemUpdates(items: ChecklistItem[], update: ChecklistUpdate): ChecklistItem[] {
    let updatedItems = [...items];

    // Apply item updates
    if (update.item_updates && update.item_updates.length > 0) {
        for (const itemUpdate of update.item_updates) {
            const itemIndex = updatedItems.findIndex((item) => item.id === itemUpdate.id);
            if (itemIndex !== -1) {
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
        const existingItemIds = new Set(updatedItems.map((item) => item.id).filter(Boolean));

        // Deduplicate within the payload itself and filter out existing items
        const uniqueNewItems = update.item_inserts.filter((item, index, array) =>
            item.id && !existingItemIds.has(item.id) &&
            array.findIndex((i) => i.id === item.id) === index
        );

        updatedItems = [...updatedItems, ...uniqueNewItems];
    }

    return updatedItems;
}

// Helper to apply field updates to an existing checklist
function applyUpdateToChecklist(checklist: Checklist, update: ChecklistUpdate): Checklist {
    let updatedChecklist = {...checklist};

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

    // Apply item-level updates
    const updatedItems = applyItemUpdates(updatedChecklist.items, update);

    return {
        ...updatedChecklist,
        items: updatedItems,
    };
}

// Helper function to apply checklist updates
function applyChecklistUpdates(run: PlaybookRun, updates: ChecklistUpdate[]): PlaybookRun {
    const checklistsMap = mapFromChecklists(run.checklists);
    const newChecklistIds: string[] = [];

    for (const update of updates) {
        const existingChecklist = checklistsMap.get(update.id);

        if (existingChecklist) {
            // Existing checklist found - apply updates
            const updatedChecklist = applyUpdateToChecklist(existingChecklist, update);
            checklistsMap.set(update.id, updatedChecklist);
        } else {
            // Checklist not found - create new one
            const newChecklist = createNewChecklist(update);
            checklistsMap.set(update.id, newChecklist);
            newChecklistIds.push(update.id);
        }
    }

    // Preserve original order + append new checklists at the end
    const orderedChecklists: Checklist[] = [];

    // Add existing checklists in their original order
    for (const originalChecklist of run.checklists) {
        const updated = checklistsMap.get(originalChecklist.id);
        if (updated) {
            orderedChecklists.push(updated);
        }
    }

    // Add new checklists at the end
    for (const newId of newChecklistIds) {
        const newChecklist = checklistsMap.get(newId);
        if (newChecklist) {
            orderedChecklists.push(newChecklist);
        }
    }

    return {
        ...run,
        checklists: orderedChecklists,
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

        // Deduplicate within the payload itself and filter out existing items
        const uniqueNewItems = updateData.item_inserts.filter((item, index, array) =>
            item.id && !existingItemIds.has(item.id) &&
            array.findIndex((i) => i.id === item.id) === index
        );

        if (uniqueNewItems.length > 0) {
            checklist.items = [...checklist.items, ...uniqueNewItems];
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