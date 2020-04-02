// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch, AnyAction} from 'redux';

import {WebSocketMessage} from './types/websocket_events';
import {receivedIncidentUpdate} from './actions';
import {isIncident} from './types/incident';

export function handleWebsocketIncidentUpdate(dispatch: Dispatch<AnyAction>) {
    return (msg: WebSocketMessage) => {
        if (msg.data.payload) {
            const incident = JSON.parse(msg.data.payload);
            if (isIncident(incident)) {
                dispatch(receivedIncidentUpdate(incident));
            }
        }
    };
}
