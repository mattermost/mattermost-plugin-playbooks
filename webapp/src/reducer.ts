// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {RHSState, RHSTabState, TimelineEventsFilter} from 'src/types/rhs';

import {
    RECEIVED_TOGGLE_RHS_ACTION,
    ReceivedToggleRHSAction,
    SET_RHS_OPEN,
    SetRHSOpen,
    SET_CLIENT_ID,
    SetClientId,
    INCIDENT_CREATED,
    IncidentCreated,
    RECEIVED_TEAM_INCIDENTS,
    ReceivedTeamIncidents,
    SetRHSState,
    SET_RHS_STATE,
    RemovedFromIncidentChannel,
    IncidentUpdated,
    INCIDENT_UPDATED,
    REMOVED_FROM_INCIDENT_CHANNEL,
    SetRHSTabState,
    SET_RHS_TAB_STATE, SetRHSEventsFilter, SET_RHS_EVENTS_FILTER, ReceivedTeamDisabled, RECEIVED_TEAM_DISABLED,
    PLAYBOOK_CREATED,
    PlaybookCreated,
    PLAYBOOK_DELETED,
    PlaybookDeleted,
    ReceivedTeamNumPlaybooks,
    RECEIVED_TEAM_NUM_PLAYBOOKS,
} from 'src/types/actions';
import {Incident} from 'src/types/incident';

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

function rhsState(state = RHSState.ViewingIncident, action: SetRHSState) {
    switch (action.type) {
    case SET_RHS_STATE:
        return action.nextState;
    default:
        return state;
    }
}

// myIncidentsByTeam is a map of teamId->{channelId->incidents} for which the current user is an incident member. Note
// that it is lazy loaded on team change, but will also track incremental updates as provided by
// websocket events.
// Aditnally it handles the plugin being disabled on the team
const myIncidentsByTeam = (
    state: Record<string, Record<string, Incident>> = {},
    action: IncidentCreated | IncidentUpdated | ReceivedTeamIncidents | RemovedFromIncidentChannel | ReceivedTeamDisabled,
) => {
    switch (action.type) {
    case INCIDENT_CREATED: {
        const incidentCreatedAction = action as IncidentCreated;
        const incident = incidentCreatedAction.incident;
        const teamId = incident.team_id;
        return {
            ...state,
            [teamId]: {
                ...state[teamId],
                [incident.channel_id]: incident,
            },
        };
    }
    case INCIDENT_UPDATED: {
        const incidentUpdated = action as IncidentUpdated;
        const incident = incidentUpdated.incident;
        const teamId = incident.team_id;
        return {
            ...state,
            [teamId]: {
                ...state[teamId],
                [incident.channel_id]: incident,
            },
        };
    }
    case RECEIVED_TEAM_INCIDENTS: {
        const receivedTeamIncidentsAction = action as ReceivedTeamIncidents;
        const incidents = receivedTeamIncidentsAction.incidents;
        if (incidents.length === 0) {
            return state;
        }
        const teamId = incidents[0].team_id;
        const newState = {
            ...state,
            [teamId]: {
                ...state[teamId],
            },
        };

        for (const incident of incidents) {
            newState[teamId][incident.channel_id] = incident;
        }

        return newState;
    }
    case REMOVED_FROM_INCIDENT_CHANNEL: {
        const removedFromChannelAction = action as RemovedFromIncidentChannel;
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

export default combineReducers({
    toggleRHSFunction,
    rhsOpen,
    clientId,
    myIncidentsByTeam,
    rhsState,
    tabStateByChannel,
    eventsFilterByChannel,
    numPlaybooksByTeam,
});
