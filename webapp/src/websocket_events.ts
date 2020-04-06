// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch, AnyAction} from 'redux';

import {GetStateFunc} from 'mattermost-redux/types/actions';

import {rhsState, incidentDetails} from 'src/selectors';

import {WebSocketMessage} from './types/websocket_events';
import {receivedIncidentUpdate, setRHSState} from './actions';
import {isIncident, RHSState} from './types/incident';

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
