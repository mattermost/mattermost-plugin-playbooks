// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {
    RECEIVED_TOGGLE_RHS_ACTION,
    RECEIVED_INCIDENTS,
    RECEIVED_INCIDENT_DETAILS,
    RECEIVED_RHS_STATE,
    SET_RHS_OPEN,
    RECEIVED_INCIDENT_UPDATE,
    SET_LOADING,
    SET_CLIENT_ID,
} from './types/actions';
import {RHSState} from './types/incident';

function toggleRHSFunction(state = null, action) {
    switch (action.type) {
    case RECEIVED_TOGGLE_RHS_ACTION:
        return action.toggleRHSPluginAction;
    default:
        return state;
    }
}

function rhsState(state = RHSState.List, action) {
    switch (action.type) {
    case RECEIVED_RHS_STATE:
        return action.state;
    default:
        return state;
    }
}

function rhsOpen(state = false, action) {
    switch (action.type) {
    case SET_RHS_OPEN:
        return action.open || false;
    default:
        return state;
    }
}

function incidents(state = [], action) {
    switch (action.type) {
    case RECEIVED_INCIDENTS:
        return action.incidents || [];
    case RECEIVED_INCIDENT_UPDATE: {
        const newState = state.filter((incident) => incident.id !== action.incident.id);
        newState.push(action.incident);
        return newState;
    }
    default:
        return state;
    }
}

function incidentDetails(state = {}, action) {
    switch (action.type) {
    case RECEIVED_INCIDENT_DETAILS:
        return action.incidentDetails || {};
    default:
        return state;
    }
}

function isLoading(state = false, action) {
    switch (action.type) {
    case SET_LOADING:
        return action.isLoading || false;
    default:
        return state;
    }
}

function clientId(state = '', action) {
    switch (action.type) {
    case SET_CLIENT_ID:
        return action.clientId || '';
    default:
        return state;
    }
}

export default combineReducers({
    toggleRHSFunction,
    rhsState,
    incidents,
    incidentDetails,
    isLoading,
    rhsOpen,
    clientId,
});
