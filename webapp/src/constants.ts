// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const OVERLAY_DELAY = 400;

export const MAX_NAME_LENGTH = 64;

export enum ErrorPageTypes {
    PLAYBOOK_RUNS = 'playbook_runs',
    PLAYBOOKS = 'playbooks',
    DEFAULT = 'default',
}

export const TEMPLATE_TITLE_KEY = 'template_title';

export const BACKSTAGE_LIST_PER_PAGE = 15;

export const PROFILE_CHUNK_SIZE = 200;

export enum AdminNotificationType {
    PLAYBOOK = 'start_trial_to_create_playbook',
    VIEW_TIMELINE = 'start_trial_to_view_timeline',
    MESSAGE_TO_TIMELINE = 'start_trial_to_add_message_to_timeline',
    PLAYBOOK_GRANULAR_ACCESS = 'start_trial_to_restrict_playbook_access',
    PLAYBOOK_CREATION_RESTRICTION = 'start_trial_to_restrict_playbook_creation',
}
