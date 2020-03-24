// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Dispatch, AnyAction} from 'redux';

import {
    RECEIVED_SHOW_RHS_ACTION,
    RECEIVED_RHS_STATE,
    RECEIVED_INCIDENTS,
    RECEIVED_INCIDENT_DETAILS,
    RECEIVED_ERROR,
    ReceivedShowRHSAction,
    ReceivedIncidents,
    ReceivedIncidentDetails,
    ReceivedError,
    ReceivedRHSState,
} from './types/actions';
import {Incident, RHSState} from './types/incident';
import {fetchIncidents, fetchIncidentDetails} from './client';

export function getIncidentDetails(id: string) {
    return async (dispatch: Dispatch<AnyAction>) => {
        try {
            const incidents = await fetchIncidentDetails(id);

            dispatch(receivedIncidentDetails(incidents));
        } catch (error) {
            dispatch(receivedError(error));
        }
    };
}

export function getIncidents() {
    return async (dispatch: Dispatch<AnyAction>) => {
        try {
            const incidents = await fetchIncidents();

            dispatch(receivedIncidents(incidents));

            // TODO: Fix this unnecessary return given that incidents are stored in the store.
            // Lint rule: consistent-return
            return {incidents};
        } catch (error) {
            return {error};
        }
    };
}

function receivedIncidents(incidents: Incident[]): ReceivedIncidents {
    return {
        type: RECEIVED_INCIDENTS,
        incidents,
    };
}

function receivedIncidentDetails(incidentDetails: Incident): ReceivedIncidentDetails {
    return {
        type: RECEIVED_INCIDENT_DETAILS,
        incidentDetails,
    };
}

function receivedError(error: string): ReceivedError {
    return {
        type: RECEIVED_ERROR,
        error,
    };
}

/**
 * Stores`showRHSPlugin` action returned by
 * registerRightHandSidebarComponent in plugin initialization.
 */
export function setShowRHSAction(showRHSPluginAction: () => void): ReceivedShowRHSAction {
    return {
        type: RECEIVED_SHOW_RHS_ACTION,
        showRHSPluginAction,
    };
}

export function setRHSState(state: RHSState): ReceivedRHSState {
    return {
        type: RECEIVED_RHS_STATE,
        state,
    };
}
