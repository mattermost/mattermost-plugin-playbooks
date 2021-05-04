// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {AnyAction, Dispatch} from 'redux';

import {generateId} from 'mattermost-redux/utils/helpers';

import {IntegrationTypes} from 'mattermost-redux/action_types';

import {GetStateFunc} from 'mattermost-redux/types/actions';

import {selectToggleRHS} from 'src/selectors';
import {Incident} from 'src/types/incident';
import {RHSState, RHSTabState, TimelineEventsFilter} from 'src/types/rhs';

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
    SET_RHS_EVENTS_FILTER,
    SET_RHS_OPEN,
    SET_RHS_STATE,
    SET_RHS_TAB_STATE,
    SetClientId,
    SetRHSEventsFilter,
    SetRHSOpen,
    SetRHSState,
    SetRHSTabState,
    SetTriggerId,
    RECEIVED_TEAM_DISABLED,
    ReceivedTeamDisabled,
    PLAYBOOK_CREATED,
    PlaybookCreated,
    PLAYBOOK_DELETED,
    PlaybookDeleted,
    RECEIVED_TEAM_NUM_PLAYBOOKS,
    ReceivedTeamNumPlaybooks,
    RECEIVED_GLOBAL_SETTINGS,
    ReceivedGlobalSettings,
    SHOW_POST_MENU_MODAL,
    ShowPostMenuModal,
    HIDE_POST_MENU_MODAL,
    HidePostMenuModal,
} from './types/actions';

import {clientExecuteCommand} from './client';
import {GlobalSettings} from './types/settings';

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

export function updateStatus() {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, '/incident update');
    };
}

export function addToTimeline(postId: string) {
    return async (dispatch: Dispatch, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, `/incident add ${postId}`);
    };
}

export function addNewTask(checklist: number) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, `/incident checkadd ${checklist}`);
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

export const playbookCreated = (teamID: string): PlaybookCreated => ({
    type: PLAYBOOK_CREATED,
    teamID,
});

export const playbookDeleted = (teamID: string): PlaybookDeleted => ({
    type: PLAYBOOK_DELETED,
    teamID,
});

export const receivedTeamNumPlaybooks = (teamID: string, numPlaybooks: number): ReceivedTeamNumPlaybooks => ({
    type: RECEIVED_TEAM_NUM_PLAYBOOKS,
    teamID,
    numPlaybooks,
});

export const receivedTeamIncidents = (incidents: Incident[]): ReceivedTeamIncidents => ({
    type: RECEIVED_TEAM_INCIDENTS,
    incidents,
});

export const receivedDisabledOnTeam = (teamId: string): ReceivedTeamDisabled => ({
    type: RECEIVED_TEAM_DISABLED,
    teamId,
});

export const removedFromIncidentChannel = (channelId: string): RemovedFromIncidentChannel => ({
    type: REMOVED_FROM_INCIDENT_CHANNEL,
    channelId,
});

export const setRHSTabState = (channelId: string, nextState: RHSTabState): SetRHSTabState => ({
    type: SET_RHS_TAB_STATE,
    channelId,
    nextState,
});

export const setRHSEventsFilter = (channelId: string, nextState: TimelineEventsFilter): SetRHSEventsFilter => ({
    type: SET_RHS_EVENTS_FILTER,
    channelId,
    nextState,
});

export const actionSetGlobalSettings = (settings: GlobalSettings): ReceivedGlobalSettings => ({
    type: RECEIVED_GLOBAL_SETTINGS,
    settings,
});

export const showPostMenuModal = (): ShowPostMenuModal => ({
    type: SHOW_POST_MENU_MODAL,
});

export const hidePostMenuModal = (): HidePostMenuModal => ({
    type: HIDE_POST_MENU_MODAL,
});
