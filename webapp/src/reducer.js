// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {RECEIVED_SHOW_RHS_ACTION, RECEIVED_INCIDENTS, RECEIVED_INCIDENT_DETAILS} from './types/actions';

function rhsPluginAction(state = null, action) {
    switch (action.type) {
    case RECEIVED_SHOW_RHS_ACTION:
        return action.showRHSPluginAction;
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
    incidents,
    incidentDetails,
});
