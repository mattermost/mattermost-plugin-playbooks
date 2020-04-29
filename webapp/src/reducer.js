// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {
    RECEIVED_TOGGLE_RHS_ACTION,
    RECEIVED_INCIDENT_HEADERS,
    RECEIVED_INCIDENT_DETAILS,
    RECEIVED_RHS_STATE,
    SET_RHS_OPEN,
    RECEIVED_INCIDENT_UPDATE,
    SET_LOADING,
    SET_CLIENT_ID,
    SET_BACKSTAGE_MODAL_OPEN,
    RECEIVED_PLAYBOOKS,
} from './types/actions';
import {RHSState} from './types/rhs';

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
    case RECEIVED_INCIDENT_HEADERS:
        return action.headers || [];
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
    case RECEIVED_INCIDENT_UPDATE:
        if (state.id === action.incident.id) {
            return action.incident;
        }
        return state;
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

function playbooks(state = [], action) {
    switch (action.type) {
    case RECEIVED_PLAYBOOKS:
        return action.playbooks || [];
    default:
        return state;
    }
}

function backstageModal(state = false, action) {
    switch (action.type) {
    case SET_BACKSTAGE_MODAL_OPEN:
        return {
            open: Boolean(action.open),
            selectedArea: action.selectedArea,
        };
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
    playbooks,
    backstageModal,
});
