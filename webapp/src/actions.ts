// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {AnyAction, Dispatch} from 'redux';

import {generateId} from 'mattermost-redux/utils/helpers';
import {IntegrationTypes} from 'mattermost-redux/action_types';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {addChannelMember} from 'mattermost-redux/actions/channels';
import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import {getCurrentChannelId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/common';

import {PlaybookRun} from 'src/types/playbook_run';
import {selectToggleRHS, canIPostUpdateForRun} from 'src/selectors';
import {RHSState, TimelineEventsFilter} from 'src/types/rhs';
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
    SetClientId,
    SetRHSEventsFilter,
    SetRHSOpen,
    SetRHSState,
    SetTriggerId,
    PLAYBOOK_CREATED,
    PlaybookCreated,
    PLAYBOOK_ARCHIVED,
    PlaybookArchived,
    PLAYBOOK_RESTORED,
    PlaybookRestored,
    RECEIVED_TEAM_NUM_PLAYBOOKS,
    ReceivedTeamNumPlaybooks,
    RECEIVED_GLOBAL_SETTINGS,
    ReceivedGlobalSettings,
    SHOW_POST_MENU_MODAL,
    ShowPostMenuModal,
    HIDE_POST_MENU_MODAL,
    HidePostMenuModal,
    SetHasViewedChannel,
    SET_HAS_VIEWED_CHANNEL,
    SetRHSAboutCollapsedState,
    SET_RHS_ABOUT_COLLAPSED_STATE,
    SET_CHECKLIST_COLLAPSED_STATE,
    SetChecklistCollapsedState,
    SetAllChecklistsCollapsedState,
    SET_ALL_CHECKLISTS_COLLAPSED_STATE,
    SET_CHECKLIST_ITEMS_FILTER,
    SetChecklistItemsFilter,
    SetEachChecklistCollapsedState,
    SET_EACH_CHECKLIST_COLLAPSED_STATE,
} from 'src/types/actions';
import {clientExecuteCommand} from 'src/client';
import {GlobalSettings} from 'src/types/settings';
import {ChecklistItemsFilter} from 'src/types/playbook';
import {modals} from 'src/webapp_globals';
import {makeModalDefinition as makeUpdateRunStatusModalDefinition} from 'src/components/modals/update_run_status_modal';

export function startPlaybookRun(teamId: string, postId?: string) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        // Add unique id
        const clientId = generateId();
        dispatch(setClientId(clientId));

        let command = `/playbook run ${clientId}`;
        if (postId) {
            command = `${command} ${postId}`;
        }

        await clientExecuteCommand(dispatch, getState, command, teamId);
    };
}

export function startPlaybookRunById(teamId: string, playbookId: string, timeout = 0) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        // Add unique id
        const clientId = generateId();
        dispatch(setClientId(clientId));

        const command = `/playbook run-playbook ${playbookId} ${clientId}`;

        // When dispatching from the playbooks product, the switch to channels resets the websocket
        // connection, losing the event that opens this dialog. Allow the caller to specify a
        // timeout as a gross workaround.
        await new Promise((resolve) => setTimeout(() => {
            clientExecuteCommand(dispatch, getState, command, teamId);
            // eslint-disable-next-line no-undefined
            resolve(undefined);
        }, timeout));
    };
}

export function promptUpdateStatus(
    teamId: string,
    playbookRunId: string,
    channelId: string,
) {
    return async (dispatch: Dispatch, getState: GetStateFunc) => {
        const state = getState();
        const hasPermission = canIPostUpdateForRun(state, channelId, teamId);
        dispatch(openUpdateRunStatusModal(playbookRunId, channelId, hasPermission));
    };
}

export function openUpdateRunStatusModal(
    playbookRunId: string,
    channelId: string,
    hasPermission: boolean,
    message?: string,
    reminderInSeconds?: number,
    finishRunChecked?: boolean
) {
    return modals.openModal(makeUpdateRunStatusModalDefinition({
        playbookRunId,
        channelId,
        hasPermission,
        message,
        reminderInSeconds,
        finishRunChecked,
    }));
}

export function finishRun(teamId: string) {
    return async (dispatch: Dispatch, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, '/playbook finish', teamId);
    };
}

export function addToTimeline(postId: string) {
    return async (dispatch: Dispatch, getState: GetStateFunc) => {
        const currentTeamId = getCurrentTeamId(getState());

        await clientExecuteCommand(dispatch, getState, `/playbook add ${postId}`, currentTeamId);
    };
}

export function addNewTask(checklist: number) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        const currentTeamId = getCurrentTeamId(getState());

        await clientExecuteCommand(dispatch, getState, `/playbook checkadd ${checklist}`, currentTeamId);
    };
}

export function addToCurrentChannel(userId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const currentChannelId = getCurrentChannelId(getState());

        dispatch(addChannelMember(currentChannelId, userId));
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

export const playbookArchived = (teamID: string): PlaybookArchived => ({
    type: PLAYBOOK_ARCHIVED,
    teamID,
});

export const playbookRestored = (teamID: string): PlaybookRestored => ({
    type: PLAYBOOK_RESTORED,
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

export const removedFromPlaybookRunChannel = (channelId: string): RemovedFromChannel => ({
    type: REMOVED_FROM_CHANNEL,
    channelId,
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

export const setRHSAboutCollapsedState = (channelId: string, collapsed: boolean): SetRHSAboutCollapsedState => ({
    type: SET_RHS_ABOUT_COLLAPSED_STATE,
    channelId,
    collapsed,
});

export const setChecklistCollapsedState = (channelId: string, checklistIndex: number, collapsed: boolean): SetChecklistCollapsedState => ({
    type: SET_CHECKLIST_COLLAPSED_STATE,
    channelId,
    checklistIndex,
    collapsed,
});

export const setEachChecklistCollapsedState = (channelId: string, state: Record<number, boolean>): SetEachChecklistCollapsedState => ({
    type: SET_EACH_CHECKLIST_COLLAPSED_STATE,
    channelId,
    state,
});

export const setAllChecklistsCollapsedState = (channelId: string, collapsed: boolean, numOfChecklists: number): SetAllChecklistsCollapsedState => ({
    type: SET_ALL_CHECKLISTS_COLLAPSED_STATE,
    channelId,
    numOfChecklists,
    collapsed,
});

export const setChecklistItemsFilter = (channelId: string, nextState: ChecklistItemsFilter): SetChecklistItemsFilter => ({
    type: SET_CHECKLIST_ITEMS_FILTER,
    channelId,
    nextState,
});
