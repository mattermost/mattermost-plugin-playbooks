// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Dispatch, AnyAction} from 'redux';

import {getUser as fetchUser} from 'mattermost-redux/actions/users';
import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {getTeam as fetchTeam} from 'mattermost-redux/actions/teams';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {Channel} from 'mattermost-redux/types/channels';

import {GetStateFunc} from 'types/actions';

import {
    RECEIVED_SHOW_RHS_ACTION,
    RECEIVED_RHS_STATE,
    RECEIVED_INCIDENTS,
    RECEIVED_INCIDENT_DETAILS,
    RECEIVED_ERROR,
    ReceivedShowRHSAction,
    ReceivedIncidents,
    ReceivedIncidentDetails,
    ReceivedError,
    ReceivedRHSState,
} from './types/actions';
import {Incident, RHSState} from './types/incident';
import {fetchIncidents, fetchIncidentDetails} from './client';

export function getIncidentDetails(id: string) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        try {
            // Fetch incident
            const incident = await fetchIncidentDetails(id) as Incident;

            // Fetch commander
            if (!getUser(getState(), incident.commander_user_id)) {
                dispatch(fetchUser(incident.commander_user_id));
            }

            // Fetch channel and team data
            for (const channelId of incident.channel_ids) {
                let c = getChannel(getState(), channelId) as Channel;
                if (!c) {
                    // Must wait to fetch channel data before fetching its team data
                    /* eslint-disable no-await-in-loop */
                    await dispatch(fetchChannel(channelId));
                    c = getChannel(getState(), channelId) as Channel;
                }
                if (!getTeam(getState(), c.team_id)) {
                    dispatch(fetchTeam(c.team_id));
                }
            }

            dispatch(receivedIncidentDetails(incident));
        } catch (error) {
            dispatch(receivedError(error));
        }
    };
}

export function getIncidents() {
    return async (dispatch: Dispatch<AnyAction>) => {
        try {
            const incidents = await fetchIncidents();

            dispatch(receivedIncidents(incidents));

            // TODO: Fix this unnecessary return given that incidents are stored in the store.
            // Lint rule: consistent-return
            return {incidents};
        } catch (error) {
            return {error};
        }
    };
}

function receivedIncidents(incidents: Incident[]): ReceivedIncidents {
    return {
        type: RECEIVED_INCIDENTS,
        incidents,
    };
}

function receivedIncidentDetails(incidentDetails: Incident): ReceivedIncidentDetails {
    return {
        type: RECEIVED_INCIDENT_DETAILS,
        incidentDetails,
    };
}

function receivedError(error: string): ReceivedError {
    return {
        type: RECEIVED_ERROR,
        error,
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

export function setRHSState(state: RHSState): ReceivedRHSState {
    return {
        type: RECEIVED_RHS_STATE,
        state,
    };
}
