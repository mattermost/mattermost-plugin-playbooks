// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {AnyAction, Dispatch} from 'redux';

import {generateId} from 'mattermost-redux/utils/helpers';
import {IntegrationTypes} from 'mattermost-redux/action_types';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {addChannelMember} from 'mattermost-redux/actions/channels';
import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {getCurrentChannelId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/common';

import {makeModalDefinition as makePlaybookRunModalDefinition} from 'src/components/modals/run_playbook_modal';
import {makeModalDefinition as makePlaybookRunNewModalDefinition} from 'src/components/modals/new_run_playbook_modal';
import {PlaybookRun} from 'src/types/playbook_run';
import {selectToggleRHS, canIPostUpdateForRun} from 'src/selectors';
import {RHSState} from 'src/types/rhs';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';
import {
    PLAYBOOK_RUN_CREATED,
    PLAYBOOK_RUN_UPDATED,
    PlaybookRunCreated,
    PlaybookRunUpdated,
    RECEIVED_PLAYBOOK_RUNS,
    ReceivedPlaybookRuns,
    RECEIVED_TEAM_PLAYBOOK_RUNS,
    ReceivedTeamPlaybookRuns,
    RECEIVED_TOGGLE_RHS_ACTION,
    ReceivedToggleRHSAction,
    REMOVED_FROM_CHANNEL,
    RemovedFromChannel,
    SET_CLIENT_ID,
    SET_RHS_OPEN,
    SET_RHS_STATE,
    SetClientId,
    SetRHSOpen,
    SetRHSState,
    SetTriggerId,
    PLAYBOOK_CREATED,
    PlaybookCreated,
    PLAYBOOK_ARCHIVED,
    PlaybookArchived,
    PLAYBOOK_RESTORED,
    PlaybookRestored,
    RECEIVED_GLOBAL_SETTINGS,
    ReceivedGlobalSettings,
    SHOW_POST_MENU_MODAL,
    ShowPostMenuModal,
    HIDE_POST_MENU_MODAL,
    HidePostMenuModal,
    SHOW_CHANNEL_ACTIONS_MODAL,
    ShowChannelActionsModal,
    HIDE_CHANNEL_ACTIONS_MODAL,
    HideChannelActionsModal,
    SHOW_RUN_ACTIONS_MODAL,
    ShowRunActionsModal,
    HIDE_RUN_ACTIONS_MODAL,
    HideRunActionsModal,
    SHOW_PLAYBOOK_ACTIONS_MODAL,
    ShowPlaybookActionsModal,
    HIDE_PLAYBOOK_ACTIONS_MODAL,
    HidePlaybookActionsModal,
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
    OPEN_BACKSTAGE_RHS,
    CLOSE_BACKSTAGE_RHS,
    CloseBackstageRHS,
    OpenBackstageRHS,
    SetEveryChecklistCollapsedState,
    SET_EVERY_CHECKLIST_COLLAPSED_STATE,
    PublishTemplates,
    PUBLISH_TEMPLATES,
} from 'src/types/actions';
import {clientExecuteCommand} from 'src/client';
import {GlobalSettings} from 'src/types/settings';
import {ChecklistItemsFilter, TaskAction as TaskActionType} from 'src/types/playbook';
import {modals} from 'src/webapp_globals';
import {makeModalDefinition as makeUpdateRunStatusModalDefinition} from 'src/components/modals/update_run_status_modal';
import {makePlaybookAccessModalDefinition} from 'src/components/backstage/playbook_access_modal';

import {makePlaybookCreateModal, PlaybookCreateModalProps} from 'src/components/create_playbook_modal';
import {makeRhsRunDetailsTourDialog} from 'src/components/rhs/rhs_run_details_tour_dialog';
import {PresetTemplate} from 'src/components/templates/template_data';
import {makeTaskActionsModalDefinition} from 'src/components/checklist_item/task_actions_modal';

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

export function openPlaybookRunModal(playbookId: string, defaultOwnerId: string | null, description: string, teamId: string, teamName: string, refreshLHS?: () => void) {
    return modals.openModal(makePlaybookRunModalDefinition(
        playbookId,
        defaultOwnerId,
        description,
        teamId,
        teamName,
        refreshLHS
    ));
}

type newRunModalProps = {
    playbookId?: string,
    triggerChannelId?: string,
    teamId: string,
    onRunCreated: (runId: string, channelId: string) => void,
};

export function openPlaybookRunNewModal(dialogProps: newRunModalProps) {
    return modals.openModal(makePlaybookRunNewModalDefinition(
        dialogProps.playbookId,
        dialogProps.triggerChannelId,
        dialogProps.teamId,
        dialogProps.onRunCreated,
    ));
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

export function displayEditPlaybookAccessModal(
    playbookId: string,
    refetch?: () => void,
) {
    return async (dispatch: Dispatch<AnyAction>) => {
        dispatch(modals.openModal(makePlaybookAccessModalDefinition({playbookId, refetch})));
    };
}

export function displayPlaybookCreateModal(props: PlaybookCreateModalProps) {
    return async (dispatch: Dispatch<AnyAction>) => {
        dispatch(modals.openModal(makePlaybookCreateModal(props)));
    };
}

export function displayRhsRunDetailsTourDialog(props: Parameters<typeof makeRhsRunDetailsTourDialog>[0]) {
    return async (dispatch: Dispatch<AnyAction>) => {
        dispatch(modals.openModal(makeRhsRunDetailsTourDialog(props)));
    };
}

export function finishRun(teamId: string, playbookRunId: string) {
    return async (dispatch: Dispatch, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, `/playbook finish-by-id ${playbookRunId}`, teamId);
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

export function setRHSViewingParticipants(): SetRHSState {
    return {
        type: SET_RHS_STATE,
        nextState: RHSState.ViewingPlaybookRunParticipants,
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

export const receivedPlaybookRuns = (playbookRuns: PlaybookRun[]): ReceivedPlaybookRuns => ({
    type: RECEIVED_PLAYBOOK_RUNS,
    playbookRuns,
});

export const receivedTeamPlaybookRuns = (playbookRuns: PlaybookRun[]): ReceivedTeamPlaybookRuns => ({
    type: RECEIVED_TEAM_PLAYBOOK_RUNS,
    playbookRuns,
});

export const removedFromPlaybookRunChannel = (channelId: string): RemovedFromChannel => ({
    type: REMOVED_FROM_CHANNEL,
    channelId,
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

export const showChannelActionsModal = (): ShowChannelActionsModal => ({
    type: SHOW_CHANNEL_ACTIONS_MODAL,
});

export const hideChannelActionsModal = (): HideChannelActionsModal => ({
    type: HIDE_CHANNEL_ACTIONS_MODAL,
});

export const showRunActionsModal = (): ShowRunActionsModal => ({
    type: SHOW_RUN_ACTIONS_MODAL,
});

export const hideRunActionsModal = (): HideRunActionsModal => ({
    type: HIDE_RUN_ACTIONS_MODAL,
});

export const showPlaybookActionsModal = (): ShowPlaybookActionsModal => ({
    type: SHOW_PLAYBOOK_ACTIONS_MODAL,
});

export const hidePlaybookActionsModal = (): HidePlaybookActionsModal => ({
    type: HIDE_PLAYBOOK_ACTIONS_MODAL,
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

export const setChecklistCollapsedState = (key: string, checklistIndex: number, collapsed: boolean): SetChecklistCollapsedState => ({
    type: SET_CHECKLIST_COLLAPSED_STATE,
    key,
    checklistIndex,
    collapsed,
});

export const setEveryChecklistCollapsedStateChange = (key: string, state: Record<number, boolean>): SetEveryChecklistCollapsedState => ({
    type: SET_EVERY_CHECKLIST_COLLAPSED_STATE,
    key,
    state,
});

export const setAllChecklistsCollapsedState = (key: string, collapsed: boolean, numOfChecklists: number): SetAllChecklistsCollapsedState => ({
    type: SET_ALL_CHECKLISTS_COLLAPSED_STATE,
    key,
    numOfChecklists,
    collapsed,
});

export const setChecklistItemsFilter = (key: string, nextState: ChecklistItemsFilter): SetChecklistItemsFilter => ({
    type: SET_CHECKLIST_ITEMS_FILTER,
    key,
    nextState,
});

export function openTaskActionsModal(onTaskActionsChange: (newTaskActions: TaskActionType[]) => void, taskActions?: TaskActionType[] | null, playbookRunId?: string) {
    return modals.openModal(makeTaskActionsModalDefinition(onTaskActionsChange, taskActions, playbookRunId));
}

export const closeBackstageRHS = (): CloseBackstageRHS => ({
    type: CLOSE_BACKSTAGE_RHS,
});

export const openBackstageRHS = (section: BackstageRHSSection, viewMode: BackstageRHSViewMode): OpenBackstageRHS => ({
    type: OPEN_BACKSTAGE_RHS,
    section,
    viewMode,
});

export const publishTemplates = (templates: PresetTemplate[]): PublishTemplates => ({
    type: PUBLISH_TEMPLATES,
    templates,
});
