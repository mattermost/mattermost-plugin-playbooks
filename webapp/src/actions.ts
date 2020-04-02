// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Dispatch, AnyAction} from 'redux';

import {Client4} from 'mattermost-redux/client';

import {getUser as fetchUser} from 'mattermost-redux/actions/users';
import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {getTeam as fetchTeam} from 'mattermost-redux/actions/teams';
import {getChannel, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {Channel} from 'mattermost-redux/types/channels';
import {IntegrationTypes} from 'mattermost-redux/action_types';

import {GetStateFunc} from 'mattermost-redux/types/actions';

import {
    RECEIVED_TOGGLE_RHS_ACTION,
    RECEIVED_RHS_STATE,
    SET_RHS_OPEN,
    RECEIVED_INCIDENTS,
    RECEIVED_INCIDENT_DETAILS,
    RECEIVED_INCIDENT_UPDATE,
    RECEIVED_ERROR,
    ReceivedToggleRHSAction,
    SetRHSOpen,
    ReceivedIncidents,
    ReceivedIncidentDetails,
    ReceivedError,
    ReceivedRHSState,
    SetTriggerId,
    ReceivedIncidentUpdate,
} from './types/actions';

import {Incident, RHSState} from './types/incident';
import {fetchIncidents, fetchIncidentDetails, endIncident as stopIncident} from './client';

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
                    c = await dispatch(fetchChannel(channelId)) as Channel;
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

export function getIncidentsForCurrentTeam() {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        dispatch(getIncidents(getCurrentTeamId(getState())));
    };
}

/**
 * Fetches incidents.
 * @param teamId Gets all incidents if teamId is null.
 */
export function getIncidents(teamId?: string) {
    return async (dispatch: Dispatch<AnyAction>) => {
        try {
            const incidents = await fetchIncidents(teamId);

            dispatch(receivedIncidents(incidents));
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function startIncident(postId? : string) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        const currentChanel = getCurrentChannel(getState());

        const args = {channel_id: currentChanel?.id};

        let command = '/incident start';
        if (!postId) {
            command = `${command} ${postId}`;
        }

        try {
            const data = await Client4.executeCommand(command, args);

            dispatch(setTriggerId(data?.trigger_id));
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function endIncident(incidentId: string) {
    return async (dispatch: Dispatch<AnyAction>) => {
        try {
            await stopIncident(incidentId);

            dispatch(setRHSState(RHSState.List));
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function setRHSOpen(open: boolean): SetRHSOpen {
    return {
        type: SET_RHS_OPEN,
        open,
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

export function receivedIncidentUpdate(incident: Incident): ReceivedIncidentUpdate {
    return {
        type: RECEIVED_INCIDENT_UPDATE,
        incident,
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
export function setToggleRHSAction(toggleRHSPluginAction: () => void): ReceivedToggleRHSAction {
    return {
        type: RECEIVED_TOGGLE_RHS_ACTION,
        toggleRHSPluginAction,
    };
}

export function setRHSState(state: RHSState): ReceivedRHSState {
    return {
        type: RECEIVED_RHS_STATE,
        state,
    };
}

export function setTriggerId(triggerId: string): SetTriggerId {
    return {
        type: IntegrationTypes.RECEIVED_DIALOG_TRIGGER_ID,
        data: triggerId,
    };
}
