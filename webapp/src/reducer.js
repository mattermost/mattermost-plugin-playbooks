import {combineReducers} from 'redux';

import {RECEIVED_SHOW_RHS_ACTION, RECEIVED_INCIDENTS} from './types/actions';

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

export default combineReducers({
    rhsPluginAction,
    incidents,
});
