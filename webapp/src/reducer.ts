// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {
    RECEIVED_TOGGLE_RHS_ACTION,
    ReceivedToggleRHSAction,
    SET_RHS_OPEN,
    SetRHSOpen,
    SET_CLIENT_ID,
    SetClientId,
    INCIDENT_CREATED,
    IncidentCreated,
    RECEIVED_TEAM_INCIDENT_CHANNELS,
    ReceivedTeamIncidentChannels,
} from './types/actions';

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

// myIncidentChannelIds is a set of incident channel ids for which the current user is an incident
// member. Note that it is lazy loaded on team change, but will also track incremental updates
// as provided by websocket events.
const myIncidentChannelIds = (state: Set<string> = new Set(), action: IncidentCreated | ReceivedTeamIncidentChannels) => {
    switch (action.type) {
    case INCIDENT_CREATED: {
        const incidentCreatedAction = action as IncidentCreated;
        const incident = incidentCreatedAction.incident;
        const newState = new Set(state);

        newState.add(incident.channel_id);
        return newState;
    }
    case RECEIVED_TEAM_INCIDENT_CHANNELS: {
        const receivedTeamIncidentChannelsAction = action as ReceivedTeamIncidentChannels;
        const newState = new Set(state);

        for (const channelId of receivedTeamIncidentChannelsAction.channelIds) {
            newState.add(channelId);
        }

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
    myIncidentChannelIds,
});
