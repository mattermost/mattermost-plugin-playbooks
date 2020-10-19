// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {RHSState} from 'src/types/rhs';

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
const myIncidentsByTeam = (state: Record<string, Record<string, Incident>> = {}, action: IncidentCreated | IncidentUpdated | ReceivedTeamIncidents | RemovedFromIncidentChannel) => {
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
        const teamId = removedFromChannelAction.teamId;
        const newState = {
            ...state,
            [teamId]: {...state[teamId]},
        };
        delete newState[teamId][removedFromChannelAction.channelId];
        return newState;
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
});
