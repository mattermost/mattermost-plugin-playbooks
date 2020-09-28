// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Integrations from 'mattermost-redux/action_types/integrations';

import {RHSState} from 'src/types/rhs';
import {Incident} from 'src/types/incident';
import {pluginId} from 'src/manifest';

export const RECEIVED_TOGGLE_RHS_ACTION = pluginId + '_toggle_rhs';
export const SET_RHS_OPEN = pluginId + '_set_rhs_open';
export const SET_CLIENT_ID = pluginId + '_set_client_id';
export const INCIDENT_CREATED = pluginId + '_incident_created';
export const RECEIVED_TEAM_INCIDENT_CHANNELS = pluginId + '_received_team_incident_channels';
export const SET_RHS_STATE = pluginId + '_set_rhs_state';

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

export interface ReceivedTeamIncidentChannels {
    type: typeof RECEIVED_TEAM_INCIDENT_CHANNELS;
    channelIds: string[];
}

export interface SetRHSState {
    type: typeof SET_RHS_STATE;
    nextState: RHSState;
}
