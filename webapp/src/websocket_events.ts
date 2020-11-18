// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {GetStateFunc} from 'mattermost-redux/types/actions';
import {Post} from 'mattermost-redux/types/posts';
import {WebSocketMessage} from 'mattermost-redux/actions/websocket';
import {getCurrentTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getChannel, getCurrentChannel, getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {navigateToUrl} from 'src/browser_routing';
import {
    incidentCreated, incidentUpdated,
    removedFromIncidentChannel,
    receivedTeamIncidents,
} from 'src/actions';
import {fetchIncidentByChannel, fetchIncidentChannels} from 'src/client';
import {clientId} from 'src/selectors';
import {Incident, isIncident} from 'src/types/incident';

export const websocketSubscribersToIncidentUpdate = new Set<(incident: Incident) => void>();

export function handleReconnect(getState: GetStateFunc, dispatch: Dispatch) {
    return async (): Promise<void> => {
        const currentTeam = getCurrentTeam(getState());
        const currentUserId = getCurrentUserId(getState());
        dispatch(receivedTeamIncidents(await fetchIncidentChannels(currentTeam.id, currentUserId)));
    };
}

export function handleWebsocketIncidentUpdated(getState: GetStateFunc, dispatch: Dispatch) {
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

        dispatch(incidentUpdated(incident));

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
    return async (msg: WebSocketMessage) => {
        const currentUserId = getCurrentUserId(getState());
        const currentTeamId = getCurrentTeamId(getState());
        if (currentUserId === msg.data.user_id && currentTeamId === msg.data.team_id) {
            const incident = await fetchIncidentByChannel(msg.broadcast.channel_id);
            dispatch(receivedTeamIncidents([incident]));
        }
    };
}

export function handleWebsocketUserRemoved(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage) => {
        const currentUserId = getCurrentUserId(getState());
        if (currentUserId === msg.broadcast.user_id) {
            const channel = getChannel(getState(), msg.data.channel_id);
            dispatch(removedFromIncidentChannel(channel.team_id, channel.id));
        }
    };
}

async function getIncidentFromStatusUpdate(post: Post) : Promise<Incident | null> {
    let incident : Incident;
    try {
        incident = await fetchIncidentByChannel(post.channel_id);
    } catch (err) {
        return null;
    }

    if (incident.status_posts_ids.includes(post.id)) {
        return incident;
    }

    return null;
}

export function handleWebsocketPostDeleted(getState: GetStateFunc, dispatch: Dispatch) {
    return async (msg: WebSocketMessage) => {
        if (getCurrentChannelId(getState()) === msg.broadcast.channel_id) {
            getIncidentFromStatusUpdate(JSON.parse(msg.data.post)).then((incident) => {
                if (incident !== null) {
                    dispatch(incidentUpdated(incident));
                    websocketSubscribersToIncidentUpdate.forEach((fn) => fn(incident));
                }
            });
        }
    };
}

export function handleWebsocketPostEdited(getState: GetStateFunc, dispatch: Dispatch) {
    return async (msg: WebSocketMessage) => {
        if (getCurrentChannelId(getState()) === msg.broadcast.channel_id) {
            getIncidentFromStatusUpdate(JSON.parse(msg.data.post)).then((incident) => {
                if (incident !== null) {
                    dispatch(incidentUpdated(incident));
                    websocketSubscribersToIncidentUpdate.forEach((fn) => fn(incident));
                }
            });
        }
    };
}
