// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Integrations from 'mattermost-redux/action_types/integrations';

import {PlaybookRun, PlaybookRunConnection} from 'src/types/playbook_run';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';
import manifest from 'src/manifest';
import {GlobalSettings} from 'src/types/settings';
import {ChecklistItemsFilter} from 'src/types/playbook';
import {PresetTemplate} from 'src/components/templates/template_data';
import {Condition} from 'src/types/conditions';

export const RECEIVED_TOGGLE_RHS_ACTION = manifest.id + '_toggle_rhs';
export const SET_RHS_OPEN = manifest.id + '_set_rhs_open';
export const SET_CLIENT_ID = manifest.id.id + '_set_client_id';
export const PLAYBOOK_RUN_CREATED = manifest.id + '_playbook_run_created';
export const PLAYBOOK_RUN_UPDATED = manifest.id + '_playbook_run_updated';
export const PLAYBOOK_CREATED = manifest.id + '_playbook_created';
export const PLAYBOOK_ARCHIVED = manifest.id + '_playbook_archived';
export const PLAYBOOK_RESTORED = manifest.id + '_playbook_restored';
export const RECEIVED_PLAYBOOK_RUNS = manifest.id + '_received_playbook_runs';
export const RECEIVED_TEAM_PLAYBOOK_RUNS = manifest.id + '_received_team_playbook_run_channels';
export const RECEIVED_TEAM_PLAYBOOK_RUN_CONNECTIONS = manifest.id + '_received_team_playbook_run_connections';
export const REMOVED_FROM_CHANNEL = manifest.id + '_removed_from_playbook_run_channel';
export const RECEIVED_GLOBAL_SETTINGS = manifest.id + '_received_global_settings';
export const SHOW_POST_MENU_MODAL = manifest.id + '_show_post_menu_modal';
export const HIDE_POST_MENU_MODAL = manifest.id + '_hide_post_menu_modal';
export const SHOW_CHANNEL_ACTIONS_MODAL = manifest.id + '_show_channel_actions_modal';
export const HIDE_CHANNEL_ACTIONS_MODAL = manifest.id + '_hide_channel_actions_modal';
export const SHOW_RUN_ACTIONS_MODAL = manifest.id + '_show_run_actions_modal';
export const HIDE_RUN_ACTIONS_MODAL = manifest.id + '_hide_run_actions_modal';
export const SHOW_PLAYBOOK_ACTIONS_MODAL = manifest.id + '_show_playbook_actions_modal';
export const HIDE_PLAYBOOK_ACTIONS_MODAL = manifest.id + '_hide_playbook_actions_modal';
export const SET_HAS_VIEWED_CHANNEL = manifest.id + '_set_has_viewed';
export const SET_RHS_ABOUT_COLLAPSED_STATE = manifest.id + '_set_rhs_about_collapsed_state';
export const SET_EVERY_CHECKLIST_COLLAPSED_STATE = manifest.id + '_set_every_checklist_collapsed_state';
export const SET_CHECKLIST_COLLAPSED_STATE = manifest.id + '_set_checklist_collapsed_state';
export const SET_ALL_CHECKLISTS_COLLAPSED_STATE = manifest.id + '_set_all_checklists_collapsed_state';
export const SET_CHECKLIST_ITEMS_FILTER = manifest.id + '_set_checklist_items_filter';
export const RECEIVED_PLAYBOOK_CONDITIONS = manifest.id + '_received_playbook_conditions';

// Condition websocket action types
export const CONDITION_CREATED = manifest.id + '_condition_created';
export const CONDITION_UPDATED = manifest.id + '_condition_updated';
export const CONDITION_DELETED = manifest.id + '_condition_deleted';

// Backstage RHS related action types
// Note That this is not the same as channel RHS management
// TODO: make a refactor with some naming change now we have multiple RHS
//       inside playbooks (channels RHS, Run details page RHS, backstage RHS)
export const OPEN_BACKSTAGE_RHS = manifest.id + '_open_backstage_rhs';
export const CLOSE_BACKSTAGE_RHS = manifest.id + '_close_backstage_rhs';

export const WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED = manifest.id + '_ws_run_incremental_update_received';

// This action is meant to be used by mattermost-webapp
// so we respect their naming convention (all caps)
export const PUBLISH_TEMPLATES = (manifest.id + '_PUBLISH_TEMPLATES').toUpperCase();

export type ReceivedToggleRHSAction = {
    type: typeof RECEIVED_TOGGLE_RHS_ACTION;
    toggleRHSPluginAction: () => void;
}

export type SetRHSOpen = {
    type: typeof SET_RHS_OPEN;
    open: boolean;
}

export type SetTriggerId = {
    type: typeof Integrations.RECEIVED_DIALOG_TRIGGER_ID;
    data: string;
}

export type SetClientId = {
    type: typeof SET_CLIENT_ID;
    clientId: string;
}

export type PlaybookRunCreated = {
    type: typeof PLAYBOOK_RUN_CREATED;
    playbookRun: PlaybookRun;
}

export type PlaybookRunUpdated = {
    type: typeof PLAYBOOK_RUN_UPDATED;
    playbookRun: PlaybookRun;
}

export type PlaybookCreated = {
    type: typeof PLAYBOOK_CREATED;
    teamID: string;
}

export type PlaybookArchived = {
    type: typeof PLAYBOOK_ARCHIVED;
    teamID: string;
}

export type PlaybookRestored = {
    type: typeof PLAYBOOK_RESTORED;
    teamID: string;
}

export type ReceivedPlaybookRuns = {
    type: typeof RECEIVED_PLAYBOOK_RUNS;
    playbookRuns: PlaybookRun[];
}

export type ReceivedTeamPlaybookRuns = {
    type: typeof RECEIVED_TEAM_PLAYBOOK_RUNS;
    playbookRuns: PlaybookRun[];
}

export type ReceivedTeamPlaybookRunConnections = {
    type: typeof RECEIVED_TEAM_PLAYBOOK_RUN_CONNECTIONS;
    playbookRuns: PlaybookRunConnection[];
}

export type ReceivedPlaybookConditions = {
    type: typeof RECEIVED_PLAYBOOK_CONDITIONS;
    playbookId: string;
    conditions: Condition[];
}

export type ConditionCreated = {
    type: typeof CONDITION_CREATED;
    condition: Condition;
}

export type ConditionUpdated = {
    type: typeof CONDITION_UPDATED;
    condition: Condition;
}

export type ConditionDeleted = {
    type: typeof CONDITION_DELETED;
    conditionId: string;
    playbookId: string;
}

export type RemovedFromChannel = {
    type: typeof REMOVED_FROM_CHANNEL;
    channelId: string;
}

export type ReceivedGlobalSettings = {
    type: typeof RECEIVED_GLOBAL_SETTINGS;
    settings: GlobalSettings;
}

export type ShowPostMenuModal = {
    type: typeof SHOW_POST_MENU_MODAL;
}

export type HidePostMenuModal = {
    type: typeof HIDE_POST_MENU_MODAL;
}

export type ShowChannelActionsModal = {
    type: typeof SHOW_CHANNEL_ACTIONS_MODAL;
}

export type HideChannelActionsModal = {
    type: typeof HIDE_CHANNEL_ACTIONS_MODAL;
}

export type ShowRunActionsModal = {
    type: typeof SHOW_RUN_ACTIONS_MODAL;
}

export type HideRunActionsModal = {
    type: typeof HIDE_RUN_ACTIONS_MODAL;
}

export type ShowPlaybookActionsModal = {
    type: typeof SHOW_PLAYBOOK_ACTIONS_MODAL;
}

export type HidePlaybookActionsModal = {
    type: typeof HIDE_PLAYBOOK_ACTIONS_MODAL;
}

export type SetHasViewedChannel = {
    type: typeof SET_HAS_VIEWED_CHANNEL;
    channelId: string;
    hasViewed: boolean;
}

export type SetRHSAboutCollapsedState = {
    type: typeof SET_RHS_ABOUT_COLLAPSED_STATE;
    channelId: string;
    collapsed: boolean;
}

export type SetChecklistCollapsedState = {
    type: typeof SET_CHECKLIST_COLLAPSED_STATE;
    key: string;
    checklistIndex: number;
    collapsed: boolean;
}

export type SetEveryChecklistCollapsedState = {
    type: typeof SET_EVERY_CHECKLIST_COLLAPSED_STATE;
    key: string;
    state: Record<number, boolean>;
}

export type SetAllChecklistsCollapsedState = {
    type: typeof SET_ALL_CHECKLISTS_COLLAPSED_STATE;
    key: string;
    numOfChecklists: number;
    collapsed: boolean;
}

export type SetChecklistItemsFilter = {
    type: typeof SET_CHECKLIST_ITEMS_FILTER;
    key: string;
    nextState: ChecklistItemsFilter;
}

// Backstage RHS related action types
// Note That this is not the same as channel RHS management
// TODO: make a refactor with some naming change now we have multiple RHS
//       inside playbooks (channels RHS, Run details page RHS, backstage RHS)
export type OpenBackstageRHS = {
    type: typeof OPEN_BACKSTAGE_RHS;
    section: BackstageRHSSection;
    viewMode: BackstageRHSViewMode;
}

export type CloseBackstageRHS = {
    type: typeof CLOSE_BACKSTAGE_RHS;
}

export type WebsocketPlaybookRunIncrementalUpdateReceived = {
    type: typeof WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED;
    data: import('./websocket_events').PlaybookRunUpdate;
}

export type PublishTemplates = {
    type: typeof PUBLISH_TEMPLATES;
    templates: PresetTemplate[];
}
