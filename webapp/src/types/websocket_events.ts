// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {pluginId} from 'src/manifest';

export const WEBSOCKET_INCIDENT_UPDATE = `custom_${pluginId}_incident_update`;
export const WEBSOCKET_INCIDENT_CREATED = `custom_${pluginId}_incident_created`;

export {WebSocketMessage} from 'mattermost-redux/actions/websocket';
