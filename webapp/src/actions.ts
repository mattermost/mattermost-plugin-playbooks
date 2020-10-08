// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {AnyAction, Dispatch} from 'redux';

import {generateId} from 'mattermost-redux/utils/helpers';

import {IntegrationTypes} from 'mattermost-redux/action_types';

import {GetStateFunc} from 'mattermost-redux/types/actions';

import {selectToggleRHS} from 'src/selectors';
import {Incident} from 'src/types/incident';
import {RHSState} from 'src/types/rhs';

import {
    INCIDENT_CREATED,
    INCIDENT_UPDATED,
    IncidentCreated,
    IncidentUpdated,
    RECEIVED_TEAM_INCIDENTS,
    RECEIVED_TOGGLE_RHS_ACTION,
    ReceivedTeamIncidents,
    ReceivedToggleRHSAction,
    REMOVED_FROM_INCIDENT_CHANNEL,
    RemovedFromIncidentChannel,
    SET_CLIENT_ID,
    SET_RHS_OPEN,
    SET_RHS_STATE,
    SetClientId,
    SetRHSOpen,
    SetRHSState,
    SetTriggerId,
} from './types/actions';

import {clientExecuteCommand} from './client';

export function startIncident(postId?: string) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        // Add unique id
        const clientId = generateId();
        dispatch(setClientId(clientId));

        let command = `/incident start ${clientId}`;
        if (postId) {
            command = `${command} ${postId}`;
        }

        await clientExecuteCommand(dispatch, getState, command);
    };
}

export function endIncident() {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, '/incident end');
    };
}

export function restartIncident() {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, '/incident restart');
    };
}

export function setRHSOpen(open: boolean): SetRHSOpen {
    return {
        type: SET_RHS_OPEN,
        open,
    };
}

export function setRHSViewingIncident(): SetRHSState {
    return {
        type: SET_RHS_STATE,
        nextState: RHSState.ViewingIncident,
    };
}

export function setRHSViewingList(): SetRHSState {
    return {
        type: SET_RHS_STATE,
        nextState: RHSState.ViewingList,
    };
}

/**
 * Stores`showRHSPlugin` action returned by
 * registerRightHandSidebarComponent in plugin initialization.
 */
export function setToggleRHSAction(toggleRHSPluginAction: () => void): ReceivedToggleRHSAction {
    return {
        type: RECEIVED_TOGGLE_RHS_ACTION,
        toggleRHSPluginAction,
    };
}

export function toggleRHS() {
    return (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        selectToggleRHS(getState())();
    };
}

export function setTriggerId(triggerId: string): SetTriggerId {
    return {
        type: IntegrationTypes.RECEIVED_DIALOG_TRIGGER_ID,
        data: triggerId,
    };
}

export function setClientId(clientId: string): SetClientId {
    return {
        type: SET_CLIENT_ID,
        clientId,
    };
}

export const incidentCreated = (incident: Incident): IncidentCreated => ({
    type: INCIDENT_CREATED,
    incident,
});

export const incidentUpdated = (incident: Incident): IncidentUpdated => ({
    type: INCIDENT_UPDATED,
    incident,
});

export const receivedTeamIncidents = (incidents: Incident[]): ReceivedTeamIncidents => ({
    type: RECEIVED_TEAM_INCIDENTS,
    incidents,
});

export const removedFromIncidentChannel = (channelId: string): RemovedFromIncidentChannel => ({
    type: REMOVED_FROM_INCIDENT_CHANNEL,
    channelId,
});
