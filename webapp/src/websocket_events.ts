// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch, AnyAction} from 'redux';
import {GetStateFunc} from 'mattermost-redux/types/actions';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {WebSocketMessage} from './types/websocket_events';
import {receivedIncidentUpdate} from './actions';
import {isIncident} from './types/incident';

// @ts-ignore
const WebappUtils = window.WebappUtils;

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

export function handleWebsocketIncidentCreated(dispatch: Dispatch<AnyAction>, getState: GetStateFunc) {
    return (msg: WebSocketMessage) => {
        if (msg.data.payload) {
            const incident = JSON.parse(msg.data.payload);
            if (!isIncident(incident)) {
                return;
            }

            dispatch(receivedIncidentUpdate(incident));

            // Navigate to the newly created channel
            const mainChannelId = incident.channel_ids?.[0];
            const currentTeam = getCurrentTeam(getState());

            const url = `/${currentTeam.name}/channels/${mainChannelId}`;
            WebappUtils.browserHistory.push(url);
        }
    };
}
