// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from 'src/manifest';

export const WEBSOCKET_PLAYBOOK_RUN_UPDATED = `custom_${manifest.id}_playbook_run_updated`;
export const WEBSOCKET_PLAYBOOK_RUN_CREATED = `custom_${manifest.id}_playbook_run_created`;
export const WEBSOCKET_PLAYBOOK_CREATED = `custom_${manifest.id}_playbook_created`;
export const WEBSOCKET_PLAYBOOK_ARCHIVED = `custom_${manifest.id}_playbook_archived`;
export const WEBSOCKET_PLAYBOOK_RESTORED = `custom_${manifest.id}_playbook_restored`;
export const WEBSOCKET_MATTERMOST_AI_POSTUPDATE = `custom_mattermost-ai_postupdate`;
