// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {
    RECEIVED_TOGGLE_RHS_ACTION,
    RECEIVED_INCIDENTS,
    RECEIVED_INCIDENT_DETAILS,
    RECEIVED_RHS_STATE,
    RECEIVED_RHS_OPEN,
} from './types/actions';
import {RHSState} from './types/incident';

function rhsPluginAction(state = null, action) {
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
    case RECEIVED_RHS_OPEN:
        return action.open || false;
    default:
        return state;
    }
}

function incidents(state = null, action) {
    switch (action.type) {
    case RECEIVED_INCIDENTS:
        return action.incidents || [];
    default:
        return state;
    }
}

function incidentDetails(state = null, action) {
    switch (action.type) {
    case RECEIVED_INCIDENT_DETAILS:
        return action.incidentDetails || {};
    default:
        return state;
    }
}

export default combineReducers({
    rhsPluginAction,
    rhsState,
    incidents,
    incidentDetails,
    rhsOpen,
});
