// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Dispatch, AnyAction} from 'redux';

import {generateId} from 'mattermost-redux/utils/helpers';

import {IntegrationTypes} from 'mattermost-redux/action_types';

import {GetStateFunc} from 'mattermost-redux/types/actions';

import {selectToggleRHS} from 'src/selectors';

import {
    RECEIVED_TOGGLE_RHS_ACTION,
    SET_RHS_OPEN,
    SET_CLIENT_ID,
    ReceivedToggleRHSAction,
    SetRHSOpen,
    SetTriggerId,
    SetClientId,
} from './types/actions';

import {
    clientExecuteCommand,
} from './client';

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
