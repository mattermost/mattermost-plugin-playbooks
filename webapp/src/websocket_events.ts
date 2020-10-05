// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {GetStateFunc} from 'mattermost-redux/types/actions';
import {WebSocketMessage} from 'mattermost-redux/actions/websocket';
import {getCurrentTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {navigateToUrl} from 'src/browser_routing';
import {incidentCreated, receivedTeamIncidentChannels} from 'src/actions';
import {fetchIncidentChannels} from 'src/client';
import {clientId} from 'src/selectors';
import {Incident, isIncident} from 'src/types/incident';
import {UserAdded, UserRemoved} from 'src/types/websocket_events';

export const websocketSubscribersToIncidentUpdate = new Set<(incident: Incident) => void>();
export const websocketSubscribersToIncidentCreate = new Set<(incident: Incident) => void>();
export const websocketSubscribersToUserRemoved = new Set<(userRemoved: UserRemoved) => void>();
export const websocketSubscribersToUserAdded = new Set<(userAdded: UserAdded) => void>();

export function handleReconnect(getState: GetStateFunc, dispatch: Dispatch) {
    return async (): Promise<void> => {
        const currentTeam = getCurrentTeam(getState());
        const currentUserId = getCurrentUserId(getState());
        dispatch(receivedTeamIncidentChannels(await fetchIncidentChannels(currentTeam.id, currentUserId)));
    };
}

export function handleWebsocketIncidentUpdated() {
    return (msg: WebSocketMessage): void => {
        if (!msg.data.payload) {
            return;
        }
        const data = JSON.parse(msg.data.payload);

        // eslint-disable-next-line no-process-env
        if (process.env.NODE_ENV !== 'production') {
            if (!isIncident(data)) {
                // eslint-disable-next-line no-console
                console.error('received a websocket data payload that was not an incident in handleWebsocketIncidentUpdate:', data);
            }
        }
        const incident = data as Incident;

        websocketSubscribersToIncidentUpdate.forEach((fn) => fn(incident));
    };
}

export function handleWebsocketIncidentCreated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage): void => {
        if (!msg.data.payload) {
            return;
        }
        const payload = JSON.parse(msg.data.payload);
        const data = payload.incident;

        // eslint-disable-next-line no-process-env
        if (process.env.NODE_ENV !== 'production') {
            if (!isIncident(data)) {
                // eslint-disable-next-line no-console
                console.error('received a websocket data payload that was not an incident in handleWebsocketIncidentCreate:', data);
            }
        }
        const incident = data as Incident;

        dispatch(incidentCreated(incident));

        websocketSubscribersToIncidentCreate.forEach((fn) => fn(incident));

        if (payload.client_id !== clientId(getState())) {
            return;
        }

        const currentTeam = getCurrentTeam(getState());

        // Navigate to the newly created channel
        const url = `/${currentTeam.name}/channels/${incident.channel_id}`;
        navigateToUrl(url);
    };
}

export function handleWebsocketUserAdded(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage): void => {
        const userAdded: UserAdded = {
            user_id: msg.data.user_id,
            team_id: msg.data.team_id,
            channel_id: msg.broadcast.channel_id,
        };

        const currentUserId = getCurrentUserId(getState());
        const currentTeamId = getCurrentTeamId(getState());
        if (currentUserId === msg.data.user_id && currentTeamId === msg.data.team_id) {
            dispatch(receivedTeamIncidentChannels([msg.broadcast.channel_id]));
        }

        websocketSubscribersToUserAdded.forEach((fn) => fn(userAdded));
    };
}

export function handleWebsocketUserRemoved(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage): void => {
        const userRemoved: UserRemoved = {
            user_id: msg.data.user_id,
            channel_id: msg.broadcast.channel_id,
        };

        websocketSubscribersToUserRemoved.forEach((fn) => fn(userRemoved));
    };
}
