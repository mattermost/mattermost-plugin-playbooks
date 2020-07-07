// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {
    RECEIVED_TOGGLE_RHS_ACTION,
    SET_RHS_OPEN,
    SET_CLIENT_ID,
} from './types/actions';

function toggleRHSFunction(state = null, action) {
    switch (action.type) {
    case RECEIVED_TOGGLE_RHS_ACTION:
        return action.toggleRHSPluginAction;
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
    rhsOpen,
    clientId,
});
