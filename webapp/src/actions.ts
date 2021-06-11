// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {AnyAction, Dispatch} from 'redux';

import {generateId} from 'mattermost-redux/utils/helpers';

import {IntegrationTypes} from 'mattermost-redux/action_types';

import {GetStateFunc} from 'mattermost-redux/types/actions';

import {PlaybookRun} from 'src/types/playbook_run';

import {selectToggleRHS} from 'src/selectors';
import {RHSState, RHSTabState, TimelineEventsFilter} from 'src/types/rhs';

import {
    PLAYBOOK_RUN_CREATED,
    PLAYBOOK_RUN_UPDATED,
    PlaybookRunCreated,
    PlaybookRunUpdated,
    RECEIVED_TEAM_PLAYBOOK_RUNS,
    RECEIVED_TOGGLE_RHS_ACTION,
    ReceivedTeamPlaybookRuns,
    ReceivedToggleRHSAction,
    REMOVED_FROM_CHANNEL,
    RemovedFromChannel,
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
    SetHasViewedChannel, SET_HAS_VIEWED_CHANNEL,
} from './types/actions';

import {clientExecuteCommand} from './client';
import {GlobalSettings} from './types/settings';

export function startPlaybookRun(postId?: string) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        // Add unique id
        const clientId = generateId();
        dispatch(setClientId(clientId));

        let command = `/playbook start ${clientId}`;
        if (postId) {
            command = `${command} ${postId}`;
        }

        await clientExecuteCommand(dispatch, getState, command);
    };
}

export function endPlaybookRun() {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, '/playbook end');
    };
}

export function restartPlaybookRun() {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, '/playbook restart');
    };
}

export function updateStatus() {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, '/playbook update');
    };
}

export function addToTimeline(postId: string) {
    return async (dispatch: Dispatch, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, `/playbook add ${postId}`);
    };
}

export function addNewTask(checklist: number) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, `/playbook checkadd ${checklist}`);
    };
}

export function setRHSOpen(open: boolean): SetRHSOpen {
    return {
        type: SET_RHS_OPEN,
        open,
    };
}

export function setRHSViewingPlaybookRun(): SetRHSState {
    return {
        type: SET_RHS_STATE,
        nextState: RHSState.ViewingPlaybookRun,
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

export const playbookRunCreated = (playbookRun: PlaybookRun): PlaybookRunCreated => ({
    type: PLAYBOOK_RUN_CREATED,
    playbookRun,
});

export const playbookRunUpdated = (playbookRun: PlaybookRun): PlaybookRunUpdated => ({
    type: PLAYBOOK_RUN_UPDATED,
    playbookRun,
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

export const receivedTeamPlaybookRuns = (playbookRuns: PlaybookRun[]): ReceivedTeamPlaybookRuns => ({
    type: RECEIVED_TEAM_PLAYBOOK_RUNS,
    playbookRuns,
});

export const receivedDisabledOnTeam = (teamId: string): ReceivedTeamDisabled => ({
    type: RECEIVED_TEAM_DISABLED,
    teamId,
});

export const removedFromPlaybookRunChannel = (channelId: string): RemovedFromChannel => ({
    type: REMOVED_FROM_CHANNEL,
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

export const setHasViewedChannel = (channelId: string): SetHasViewedChannel => ({
    type: SET_HAS_VIEWED_CHANNEL,
    channelId,
    hasViewed: true,
});
