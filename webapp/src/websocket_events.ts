// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {GetStateFunc} from 'mattermost-redux/types/actions';
import {Post} from 'mattermost-redux/types/posts';
import {WebSocketMessage} from 'mattermost-redux/types/websocket';
import {getCurrentTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {navigateToUrl} from 'src/browser_routing';
import {
    incidentCreated, incidentUpdated,
    removedFromIncidentChannel,
    receivedTeamIncidents,
    playbookCreated,
    playbookDeleted,
} from 'src/actions';
import {fetchIncidentByChannel, fetchIncidents} from 'src/client';
import {clientId, myIncidentsMap} from 'src/selectors';
import {Incident, isIncident, StatusPost} from 'src/types/incident';
import {Playbook} from 'src/types/playbook';

export const websocketSubscribersToIncidentUpdate = new Set<(incident: Incident) => void>();

export function handleReconnect(getState: GetStateFunc, dispatch: Dispatch) {
    return async (): Promise<void> => {
        const currentTeam = getCurrentTeam(getState());
        const currentUserId = getCurrentUserId(getState());
        const fetched = await fetchIncidents({
            team_id: currentTeam.id,
            member_id: currentUserId,
        });
        dispatch(receivedTeamIncidents(fetched.items));
    };
}

export function handleWebsocketIncidentUpdated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{payload: string}>): void => {
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
    return (msg: WebSocketMessage<{payload:string}>): void => {
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

export function handleWebsocketPlaybookCreated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        const payload = JSON.parse(msg.data.payload);

        dispatch(playbookCreated(payload.teamID));
    };
}

export function handleWebsocketPlaybookDeleted(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        const payload = JSON.parse(msg.data.payload);

        dispatch(playbookDeleted(payload.teamID));
    };
}

export function handleWebsocketUserAdded(getState: GetStateFunc, dispatch: Dispatch) {
    return async (msg: WebSocketMessage<{team_id: string, user_id: string}>) => {
        const currentUserId = getCurrentUserId(getState());
        const currentTeamId = getCurrentTeamId(getState());
        if (currentUserId === msg.data.user_id && currentTeamId === msg.data.team_id) {
            try {
                const incident = await fetchIncidentByChannel(msg.broadcast.channel_id);
                dispatch(receivedTeamIncidents([incident]));
            } catch (error) {
                if (error.status_code !== 404) {
                    throw error;
                }
            }
        }
    };
}

export function handleWebsocketUserRemoved(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{channel_id: string, user_id: string}>) => {
        const currentUserId = getCurrentUserId(getState());
        if (currentUserId === msg.broadcast.user_id) {
            dispatch(removedFromIncidentChannel(msg.data.channel_id));
        }
    };
}

async function getIncidentFromStatusUpdate(post: Post): Promise<Incident | null> {
    let incident: Incident;
    try {
        incident = await fetchIncidentByChannel(post.channel_id);
    } catch (err) {
        return null;
    }

    if (incident.status_posts.find((value: StatusPost) => post.id === value.id)) {
        return incident;
    }

    return null;
}

export const handleWebsocketPostEditedOrDeleted = (getState: GetStateFunc, dispatch: Dispatch) => {
    return async (msg: WebSocketMessage<{post: string}>) => {
        const activeIncidents = myIncidentsMap(getState());
        if (activeIncidents[msg.broadcast.channel_id]) {
            const incident = await getIncidentFromStatusUpdate(JSON.parse(msg.data.post));
            if (incident) {
                dispatch(incidentUpdated(incident));
                websocketSubscribersToIncidentUpdate.forEach((fn) => fn(incident));
            }
        }
    };
};

export const handleWebsocketChannelUpdated = (getState: GetStateFunc, dispatch: Dispatch) => {
    return async (msg: WebSocketMessage<{channel: string}>) => {
        const channel = JSON.parse(msg.data.channel);

        // Ignore updates to non-incident channels.
        const activeIncidents = myIncidentsMap(getState());
        if (!activeIncidents[channel.id]) {
            return;
        }

        // Fetch the updated incident, since some metadata (like incident name) comes directly
        // from the channel, and the plugin cannot detect channel update events for itself.
        const incident = await fetchIncidentByChannel(channel.id);
        if (incident) {
            dispatch(incidentUpdated(incident));
        }
    };
};
