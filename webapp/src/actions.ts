// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Dispatch, AnyAction} from 'redux';

import {RECEIVED_SHOW_RHS_ACTION, RECEIVED_INCIDENTS, ReceivedShowRHSAction, ReceivedIncidents} from './types/actions';
import {Incident} from './types/incident';
import {fetchIncidents} from './client';

export function getIncidents(): (dispatch: Dispatch<AnyAction>) => Promise< {error: any} | {incidents: Incident[]}> {
    return async (dispatch: Dispatch<AnyAction>): Promise< {error: any} | {incidents: Incident[]}> => {
        try {
            const incidents = await fetchIncidents();

            dispatch(recievedIncidents(incidents));

            return {incidents};
        } catch (error) {
            return {error};
        }
    };
}

function recievedIncidents(incidents: Incident[]): ReceivedIncidents {
    return {
        type: RECEIVED_INCIDENTS,
        incidents,
    };
}

/**
 * Stores`showRHSPlugin` action returned by
 * registerRightHandSidebarComponent in plugin initialization.
 */
export function setShowRHSAction(showRHSPluginAction: () => void): ReceivedShowRHSAction {
    return {
        type: RECEIVED_SHOW_RHS_ACTION,
        showRHSPluginAction,
    };
}
