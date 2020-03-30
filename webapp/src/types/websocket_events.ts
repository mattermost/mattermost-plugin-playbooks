// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {pluginId} from '../manifest';

import {Incident} from './incident';

export const WEBSOCKET_INCIDENT_UPDATE = `custom_${pluginId}_incident_update`;

export interface WebsocketEvent {
    event: string;
    data: {
        payload: string;
    };
    broadcast: {
        omit_users: {
            [userId: string]: boolean;
        };
        user_id: string;
        channel_id: string;
        team_id: string;
    };
    seq: number;
}

