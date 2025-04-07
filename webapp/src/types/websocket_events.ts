// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from 'src/manifest';

export const WEBSOCKET_PLAYBOOK_RUN_UPDATED = `custom_${manifest.id}_playbook_run_updated`;
export const WEBSOCKET_PLAYBOOK_RUN_CREATED = `custom_${manifest.id}_playbook_run_created`;
export const WEBSOCKET_PLAYBOOK_CREATED = `custom_${manifest.id}_playbook_created`;
export const WEBSOCKET_PLAYBOOK_ARCHIVED = `custom_${manifest.id}_playbook_archived`;
export const WEBSOCKET_PLAYBOOK_RESTORED = `custom_${manifest.id}_playbook_restored`;

// New WebSocket events for incremental updates
export const WEBSOCKET_PLAYBOOK_RUN_UPDATED_INCREMENTAL = `custom_${manifest.id}_playbook_run_updated_incremental`;
export const WEBSOCKET_PLAYBOOK_CHECKLIST_UPDATED = `custom_${manifest.id}_playbook_checklist_updated`;
export const WEBSOCKET_PLAYBOOK_CHECKLIST_ITEM_UPDATED = `custom_${manifest.id}_playbook_checklist_item_updated`;

// Interfaces for incremental updates
export interface PlaybookRunUpdate {
    id: string;
    updated_at: number;
    changed_fields: Record<string, any>;
}

export interface ChecklistUpdate {
    id: string;
    index: number;
    updated_at: number;
    fields?: Record<string, any>;
    item_updates?: ChecklistItemUpdate[];
    item_deletes?: string[];
    item_inserts?: any[];
}

export interface ChecklistItemUpdate {
    id: string;
    index: number;
    updated_at: number;
    fields: Record<string, any>;
}
