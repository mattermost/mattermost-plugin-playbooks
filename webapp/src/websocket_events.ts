// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch, AnyAction} from 'redux';

import {GetStateFunc} from 'mattermost-redux/types/actions';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {rhsState, incidentDetails} from 'src/selectors';

import {WebSocketMessage} from './types/websocket_events';
import {receivedIncidentUpdate, setRHSState} from './actions';
import {isIncident, RHSState} from './types/incident';
import {getClientId} from './selectors';

// @ts-ignore
const WebappUtils = window.WebappUtils;

export function handleWebsocketIncidentUpdate(dispatch: Dispatch<AnyAction>, getState: GetStateFunc) {
    return (msg: WebSocketMessage) => {
        if (msg.data.payload) {
            const incident = JSON.parse(msg.data.payload);
            if (isIncident(incident)) {
                dispatch(receivedIncidentUpdate(incident));

                // If this is also the incident being viewed, and the incident is closed,
                // then stop viewing that incident
                if (rhsState(getState()) !== RHSState.Details) {
                    return;
                }
                const curId = incidentDetails(getState()).id;
                if (curId === incident.id && !incident.is_active) {
                    dispatch(setRHSState(RHSState.List));
                }
            }
        }
    };
}

export function handleWebsocketIncidentCreated(dispatch: Dispatch<AnyAction>, getState: GetStateFunc) {
    return (msg: WebSocketMessage) => {
        if (!msg.data.payload) {
            return;
        }

        const payload = JSON.parse(msg.data.payload);
        const incident = payload.incident;

        if (!isIncident(incident)) {
            return;
        }

        dispatch(receivedIncidentUpdate(incident));

        if (payload.client_id === getClientId(getState())) {
            // Navigate to the newly created channel
            const mainChannelId = incident.channel_ids?.[0];
            const currentTeam = getCurrentTeam(getState());

            const url = `/${currentTeam.name}/channels/${mainChannelId}`;
            WebappUtils.browserHistory.push(url);
        }
    };
}
