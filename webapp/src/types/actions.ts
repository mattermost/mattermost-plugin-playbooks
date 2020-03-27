// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RECEIVED_DIALOG_TRIGGER_ID} from 'mattermost-redux/action_types/integrations';

import {id as pluginId} from '../manifest';

import {Incident, RHSState} from './incident';

export const RECEIVED_SHOW_RHS_ACTION = pluginId + '_show_rhs';
export const RECEIVED_RHS_STATE = pluginId + '_rhs_state';
export const RECEIVED_INCIDENTS = pluginId + '_received_incidents';
export const RECEIVED_INCIDENT_DETAILS = pluginId + '_received_incident_details';
export const RECEIVED_ERROR = pluginId + '_received_error';

export interface ReceivedShowRHSAction {
    type: typeof RECEIVED_SHOW_RHS_ACTION;
    showRHSPluginAction: () => void;
}

export interface ReceivedRHSState {
    type: typeof RECEIVED_RHS_STATE;
    state: RHSState;
}

export interface ReceivedIncidents {
    type: typeof RECEIVED_INCIDENTS;
    incidents: Incident [];
}

export interface ReceivedIncidentDetails {
    type: typeof RECEIVED_INCIDENT_DETAILS;
    incidentDetails: Incident;
}

export interface ReceivedError {
    type: typeof RECEIVED_ERROR;
    error: string;
}

export interface SetTriggerId {
    type: typeof RECEIVED_DIALOG_TRIGGER_ID;
    data: string;
}
