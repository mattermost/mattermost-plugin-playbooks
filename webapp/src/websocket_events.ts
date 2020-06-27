// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WebSocketMessage} from 'mattermost-redux/actions/websocket';

import {isIncident, Incident} from './types/incident';

export const websocketSubscribers = new Set<(incident: Incident) => void>();

export function handleWebsocketIncidentUpdate() {
    return (msg: WebSocketMessage): void => {
        if (!msg.data.payload) {
            return;
        }
        const incident = JSON.parse(msg.data.payload);
        if (!isIncident(incident)) {
            return;
        }

        websocketSubscribers.forEach((fn) => fn(incident));
    };
}
