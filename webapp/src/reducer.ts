// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {PlaybookRun} from 'src/types/playbook_run';

import {RHSState, RHSTabState, TimelineEventsFilter} from 'src/types/rhs';

import {
    RECEIVED_TOGGLE_RHS_ACTION,
    ReceivedToggleRHSAction,
    SET_RHS_OPEN,
    SetRHSOpen,
    SET_CLIENT_ID,
    SetClientId,
    PLAYBOOK_RUN_CREATED,
    PlaybookRunCreated,
    RECEIVED_TEAM_PLAYBOOK_RUNS,
    ReceivedTeamPlaybookRuns,
    SetRHSState,
    SET_RHS_STATE,
    RemovedFromChannel,
    PlaybookRunUpdated,
    PLAYBOOK_RUN_UPDATED,
    REMOVED_FROM_CHANNEL,
    SetRHSTabState,
    SET_RHS_TAB_STATE,
    SetRHSEventsFilter,
    SET_RHS_EVENTS_FILTER,
    ReceivedTeamDisabled,
    RECEIVED_TEAM_DISABLED,
    PLAYBOOK_CREATED,
    PlaybookCreated,
    PLAYBOOK_DELETED,
    PlaybookDeleted,
    ReceivedTeamNumPlaybooks,
    RECEIVED_TEAM_NUM_PLAYBOOKS,
    ReceivedGlobalSettings, RECEIVED_GLOBAL_SETTINGS,
    ShowPostMenuModal, HidePostMenuModal,
    SHOW_POST_MENU_MODAL, HIDE_POST_MENU_MODAL,
    SetHasViewedChannel, SET_HAS_VIEWED_CHANNEL,
} from 'src/types/actions';

import {GlobalSettings} from './types/settings';

function toggleRHSFunction(state = null, action: ReceivedToggleRHSAction) {
    switch (action.type) {
    case RECEIVED_TOGGLE_RHS_ACTION:
        return action.toggleRHSPluginAction;
    default:
        return state;
    }
}

function rhsOpen(state = false, action: SetRHSOpen) {
    switch (action.type) {
    case SET_RHS_OPEN:
        return action.open || false;
    default:
        return state;
    }
}

function clientId(state = '', action: SetClientId) {
    switch (action.type) {
    case SET_CLIENT_ID:
        return action.clientId || '';
    default:
        return state;
    }
}

function rhsState(state = RHSState.ViewingPlaybookRun, action: SetRHSState) {
    switch (action.type) {
    case SET_RHS_STATE:
        return action.nextState;
    default:
        return state;
    }
}

// myPlaybookRunsByTeam is a map of teamId->{channelId->playbookRuns} for which the current user is an playbook run member. Note
// that it is lazy loaded on team change, but will also track incremental updates as provided by
// websocket events.
// Aditnally it handles the plugin being disabled on the team
const myPlaybookRunsByTeam = (
    state: Record<string, Record<string, PlaybookRun>> = {},
    action: PlaybookRunCreated | PlaybookRunUpdated | ReceivedTeamPlaybookRuns | RemovedFromChannel | ReceivedTeamDisabled,
) => {
    switch (action.type) {
    case PLAYBOOK_RUN_CREATED: {
        const playbookRunCreatedAction = action as PlaybookRunCreated;
        const playbookRun = playbookRunCreatedAction.playbookRun;
        const teamId = playbookRun.team_id;
        return {
            ...state,
            [teamId]: {
                ...state[teamId],
                [playbookRun.channel_id]: playbookRun,
            },
        };
    }
    case PLAYBOOK_RUN_UPDATED: {
        const playbookRunUpdated = action as PlaybookRunUpdated;
        const playbookRun = playbookRunUpdated.playbookRun;
        const teamId = playbookRun.team_id;
        return {
            ...state,
            [teamId]: {
                ...state[teamId],
                [playbookRun.channel_id]: playbookRun,
            },
        };
    }
    case RECEIVED_TEAM_PLAYBOOK_RUNS: {
        const receivedTeamPlaybookRunsAction = action as ReceivedTeamPlaybookRuns;
        const playbookRuns = receivedTeamPlaybookRunsAction.playbookRuns;
        if (playbookRuns.length === 0) {
            return state;
        }
        const teamId = playbookRuns[0].team_id;
        const newState = {
            ...state,
            [teamId]: {
                ...state[teamId],
            },
        };

        for (const playbookRun of playbookRuns) {
            newState[teamId][playbookRun.channel_id] = playbookRun;
        }

        return newState;
    }
    case REMOVED_FROM_CHANNEL: {
        const removedFromChannelAction = action as RemovedFromChannel;
        const channelId = removedFromChannelAction.channelId;
        const teamId = Object.keys(state).find((t) => Boolean(state[t][channelId]));
        if (!teamId) {
            return state;
        }

        const newState = {
            ...state,
            [teamId]: {...state[teamId]},
        };
        delete newState[teamId][channelId];
        return newState;
    }
    case RECEIVED_TEAM_DISABLED: {
        const teamDisabledAction = action as ReceivedTeamDisabled;
        return {
            ...state,
            [teamDisabledAction.teamId]: false,
        };
    }
    default:
        return state;
    }
};

const tabStateByChannel = (state: Record<string, RHSTabState> = {}, action: SetRHSTabState) => {
    switch (action.type) {
    case SET_RHS_TAB_STATE:
        return {
            ...state,
            [action.channelId]: action.nextState,
        };
    default:
        return state;
    }
};

const eventsFilterByChannel = (state: Record<string, TimelineEventsFilter> = {}, action: SetRHSEventsFilter) => {
    switch (action.type) {
    case SET_RHS_EVENTS_FILTER:
        return {
            ...state,
            [action.channelId]: action.nextState,
        };
    default:
        return state;
    }
};

const numPlaybooksByTeam = (state: Record<string, number> = {}, action: PlaybookCreated | PlaybookDeleted | ReceivedTeamNumPlaybooks) => {
    switch (action.type) {
    case PLAYBOOK_CREATED: {
        const playbookCreatedAction = action as PlaybookCreated;
        const teamID = playbookCreatedAction.teamID;
        const prevCount = state[teamID] || 0;

        return {
            ...state,
            [teamID]: prevCount + 1,
        };
    }
    case PLAYBOOK_DELETED: {
        const playbookDeletedAction = action as PlaybookCreated;
        const teamID = playbookDeletedAction.teamID;
        const prevCount = state[teamID] || 0;

        return {
            ...state,
            [teamID]: prevCount - 1,
        };
    }
    case RECEIVED_TEAM_NUM_PLAYBOOKS: {
        const receivedNumPlaybooksAction = action as ReceivedTeamNumPlaybooks;
        const numPlaybooks = receivedNumPlaybooksAction.numPlaybooks;
        const teamID = receivedNumPlaybooksAction.teamID;
        const prevCount = state[teamID] || 0;

        if (prevCount === numPlaybooks) {
            return state;
        }

        return {
            ...state,
            [teamID]: numPlaybooks,
        };
    }
    default:
        return state;
    }
};

const globalSettings = (state: GlobalSettings | null = null, action: ReceivedGlobalSettings) => {
    switch (action.type) {
    case RECEIVED_GLOBAL_SETTINGS:
        return action.settings;
    default:
        return state;
    }
};

const postMenuModalVisibility = (state = false, action: ShowPostMenuModal | HidePostMenuModal) => {
    switch (action.type) {
    case SHOW_POST_MENU_MODAL:
        return true;
    case HIDE_POST_MENU_MODAL:
        return false;
    default:
        return state;
    }
};

const hasViewedByChannel = (state: Record<string, boolean> = {}, action: SetHasViewedChannel) => {
    switch (action.type) {
    case SET_HAS_VIEWED_CHANNEL:
        return {
            ...state,
            [action.channelId]: action.hasViewed,
        };
    default:
        return state;
    }
};

export default combineReducers({
    toggleRHSFunction,
    rhsOpen,
    clientId,
    myPlaybookRunsByTeam,
    rhsState,
    tabStateByChannel,
    eventsFilterByChannel,
    numPlaybooksByTeam,
    globalSettings,
    postMenuModalVisibility,
    hasViewedByChannel,
});
