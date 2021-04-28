// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {pluginId} from 'src/manifest';

export const WEBSOCKET_INCIDENT_UPDATED = `custom_${pluginId}_incident_updated`;
export const WEBSOCKET_INCIDENT_CREATED = `custom_${pluginId}_incident_created`;
export const WEBSOCKET_PLAYBOOK_CREATED = `custom_${pluginId}_playbook_created`;
export const WEBSOCKET_PLAYBOOK_DELETED = `custom_${pluginId}_playbook_deleted`;
