// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch, AnyAction} from 'redux';

import {GetStateFunc} from 'mattermost-redux/types/actions';

import {WebSocketMessage} from './types/websocket_events';
import {isIncident, Incident} from './types/incident';

export const websocketSubscribers = new Set<(incident: Incident) => void>();

export function handleWebsocketIncidentUpdate(dispatch: Dispatch<AnyAction>, getState: GetStateFunc) {
    return (msg: WebSocketMessage) => {
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
