// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch, AnyAction} from 'redux';

import {GetStateFunc} from 'mattermost-redux/types/actions';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {rhsState, incidentDetails, clientId} from './selectors';
import {WebSocketMessage} from './types/websocket_events';
import {receivedIncidentUpdate, setRHSState} from './actions';
import {isIncident} from './types/incident';
import {RHSState} from './types/rhs';

// @ts-ignore
const WebappUtils = window.WebappUtils;

export function handleWebsocketIncidentUpdate(dispatch: Dispatch<AnyAction>, getState: GetStateFunc) {
    return (msg: WebSocketMessage) => {
        if (!msg.data.payload) {
            return;
        }
        const incident = JSON.parse(msg.data.payload);
        if (!isIncident(incident)) {
            return;
        }

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

        if (payload.client_id === clientId(getState())) {
            // Navigate to the newly created channel
            const mainChannelId = incident.channel_ids?.[0];
            const currentTeam = getCurrentTeam(getState());

            const url = `/${currentTeam.name}/channels/${mainChannelId}`;
            WebappUtils.browserHistory.push(url);
        }
    };
}
