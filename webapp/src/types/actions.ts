// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Integrations from 'mattermost-redux/action_types/integrations';

import {RHSState, RHSTabState, TimelineEventsFilter} from 'src/types/rhs';
import {Incident} from 'src/types/incident';
import {Playbook} from 'src/types/playbook';
import {pluginId} from 'src/manifest';

import {GlobalSettings} from './settings';

export const RECEIVED_TOGGLE_RHS_ACTION = pluginId + '_toggle_rhs';
export const SET_RHS_OPEN = pluginId + '_set_rhs_open';
export const SET_CLIENT_ID = pluginId + '_set_client_id';
export const INCIDENT_CREATED = pluginId + '_incident_created';
export const INCIDENT_UPDATED = pluginId + '_incident_updated';
export const PLAYBOOK_CREATED = pluginId + '_playbook_created';
export const PLAYBOOK_DELETED = pluginId + '_playbook_deleted';
export const RECEIVED_TEAM_NUM_PLAYBOOKS = pluginId + '_received_team_num_playbooks';
export const RECEIVED_TEAM_INCIDENTS = pluginId + '_received_team_incident_channels';
export const RECEIVED_TEAM_DISABLED = pluginId + '_received_team_disabled';
export const REMOVED_FROM_INCIDENT_CHANNEL = pluginId + '_removed_from_incident_channel';
export const SET_RHS_STATE = pluginId + '_set_rhs_state';
export const SET_RHS_TAB_STATE = pluginId + '_set_rhs_tab_state';
export const SET_RHS_EVENTS_FILTER = pluginId + '_set_rhs_events_filter';
export const RECEIVED_GLOBAL_SETTINGS = pluginId + '_received_global_settings';

export interface ReceivedToggleRHSAction {
    type: typeof RECEIVED_TOGGLE_RHS_ACTION;
    toggleRHSPluginAction: () => void;
}

export interface SetRHSOpen {
    type: typeof SET_RHS_OPEN;
    open: boolean;
}

export interface SetTriggerId {
    type: typeof Integrations.RECEIVED_DIALOG_TRIGGER_ID;
    data: string;
}

export interface SetClientId {
    type: typeof SET_CLIENT_ID;
    clientId: string;
}

export interface IncidentCreated {
    type: typeof INCIDENT_CREATED;
    incident: Incident;
}

export interface IncidentUpdated {
    type: typeof INCIDENT_UPDATED;
    incident: Incident;
}

export interface PlaybookCreated {
    type: typeof PLAYBOOK_CREATED;
    teamID: string;
}

export interface PlaybookDeleted {
    type: typeof PLAYBOOK_DELETED;
    teamID: string;
}

export interface ReceivedTeamNumPlaybooks {
    type: typeof RECEIVED_TEAM_NUM_PLAYBOOKS;
    teamID: string;
    numPlaybooks: number;
}

export interface ReceivedTeamIncidents {
    type: typeof RECEIVED_TEAM_INCIDENTS;
    incidents: Incident[];
}

export interface ReceivedTeamDisabled {
    type: typeof RECEIVED_TEAM_DISABLED;
    teamId: string
}

export interface RemovedFromIncidentChannel {
    type: typeof REMOVED_FROM_INCIDENT_CHANNEL;
    channelId: string;
}

export interface SetRHSState {
    type: typeof SET_RHS_STATE;
    nextState: RHSState;
}

export interface SetRHSTabState {
    type: typeof SET_RHS_TAB_STATE;
    channelId: string;
    nextState: RHSTabState;
}

export interface SetRHSEventsFilter {
    type: typeof SET_RHS_EVENTS_FILTER;
    channelId: string;
    nextState: TimelineEventsFilter;
}

export interface ReceivedGlobalSettings {
    type: typeof RECEIVED_GLOBAL_SETTINGS;
    settings: GlobalSettings;
}
