// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RECEIVED_DIALOG_TRIGGER_ID} from 'mattermost-redux/action_types/integrations';

import {pluginId} from 'src/manifest';

import {Incident, RHSState} from './incident';

export const RECEIVED_TOGGLE_RHS_ACTION = pluginId + '_toggle_rhs';
export const SET_RHS_OPEN = pluginId + '_set_rhs_open';
export const RECEIVED_RHS_STATE = pluginId + '_rhs_state';
export const RECEIVED_INCIDENTS = pluginId + '_received_incidents';
export const RECEIVED_INCIDENT_DETAILS = pluginId + '_received_incident_details';
export const RECEIVED_INCIDENT_UPDATE = pluginId + '_received_incident_update';
export const RECEIVED_ERROR = pluginId + '_received_error';

export interface ReceivedToggleRHSAction {
    type: typeof RECEIVED_TOGGLE_RHS_ACTION;
    toggleRHSPluginAction: () => void;
}

export interface SetRHSOpen {
    type: typeof SET_RHS_OPEN;
    open: boolean;
}

export interface ReceivedRHSState {
    type: typeof RECEIVED_RHS_STATE;
    state: RHSState;
}

export interface ReceivedIncidents {
    type: typeof RECEIVED_INCIDENTS;
    incidents: Incident[];
}

export interface ReceivedIncidentDetails {
    type: typeof RECEIVED_INCIDENT_DETAILS;
    incidentDetails: Incident;
}

export interface ReceivedIncidentUpdate {
    type: typeof RECEIVED_INCIDENT_UPDATE;
    incident: Incident;
}

export interface ReceivedError {
    type: typeof RECEIVED_ERROR;
    error: string;
}

export interface SetTriggerId {
    type: typeof RECEIVED_DIALOG_TRIGGER_ID;
    data: string;
}
