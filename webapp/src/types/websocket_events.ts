// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from 'src/manifest';

import {PlaybookRun, RunMetricData, StatusPost} from './playbook_run';
import {Checklist, ChecklistItem} from './playbook';
import {PropertyField, PropertyValue} from './properties';
import {TimelineEvent} from './rhs';

export const WEBSOCKET_PLAYBOOK_RUN_UPDATED = `custom_${manifest.id}_playbook_run_updated`;
export const WEBSOCKET_PLAYBOOK_RUN_CREATED = `custom_${manifest.id}_playbook_run_created`;
export const WEBSOCKET_PLAYBOOK_CREATED = `custom_${manifest.id}_playbook_created`;
export const WEBSOCKET_PLAYBOOK_ARCHIVED = `custom_${manifest.id}_playbook_archived`;
export const WEBSOCKET_PLAYBOOK_RESTORED = `custom_${manifest.id}_playbook_restored`;
export const WEBSOCKET_PLAYBOOK_UPDATED = `custom_${manifest.id}_playbook_updated`;

// Fires when a run is incrementally updated (e.g. a checklist item state change, owner
// reassignment, or other partial field update). Payload is a `PlaybookRunUpdate` object
// containing only the changed fields, checklist diffs, and a server-side update timestamp.
export const WEBSOCKET_PLAYBOOK_RUN_UPDATED_INCREMENTAL = `custom_${manifest.id}_playbook_run_updated_incremental`;

// Fires when the global plugin settings are changed by a system admin. Payload is a JSON
// object with the shape `{ enable_experimental_features: bool }` — only the keys that
// changed are guaranteed to be present.
export const WEBSOCKET_SETTINGS_CHANGED = `custom_${manifest.id}_playbook_settings_changed`;

// Open run modal event (triggered by /playbook run slash command)
export const WEBSOCKET_PLAYBOOK_OPEN_RUN_MODAL = `custom_${manifest.id}_playbook_open_run_modal`;

// Interfaces for incremental updates
export interface PlaybookRunUpdate {
    id: string;
    playbook_run_updated_at: number;
    changed_fields: Omit<Partial<PlaybookRun>, 'checklists' | 'timeline_events' | 'status_posts' | 'metrics_data' | 'property_fields' | 'property_values'> & {
        checklists?: ChecklistUpdate[];
        timeline_events?: TimelineEvent[];
        status_posts?: StatusPost[];
        metrics_data?: RunMetricData[];
        property_fields?: PropertyField[];
        property_values?: PropertyValue[];
    };
    checklist_deletes?: string[];
    timeline_event_deletes?: string[];
    status_post_deletes?: string[];
}

export interface ChecklistUpdate {
    id: string;
    checklist_updated_at?: number;
    fields?: Omit<Partial<Checklist>, 'items'>;
    item_updates?: ChecklistItemUpdate[];
    item_deletes?: string[];
    item_inserts?: ChecklistItem[];
    items_order?: string[];
}

export interface ChecklistItemUpdate {
    id: string;
    checklist_item_updated_at?: number;
    fields: Partial<ChecklistItem>;
}

export interface PlaybookUpdatedPayload {
    teamID: string;
    playbookID: string;
}

export interface PlaybookRunOpenModalPayload {
    team_id: string;
    trigger_channel_id: string;
}
