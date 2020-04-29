// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {pluginId} from 'src/manifest';

export const WEBSOCKET_INCIDENT_UPDATE = `custom_${pluginId}_incident_update`;
export const WEBSOCKET_INCIDENT_CREATED = `custom_${pluginId}_incident_created`;
export const WEBSOCKET_PLAYBOOK_CREATED = `custom_${pluginId}_playbook_created`;
export const WEBSOCKET_PLAYBOOK_UPDATE = `custom_${pluginId}_playbook_update`;
export const WEBSOCKET_PLAYBOOK_DELETE = `custom_${pluginId}_playbook_delete`;

export {WebSocketMessage} from 'mattermost-redux/actions/websocket';
