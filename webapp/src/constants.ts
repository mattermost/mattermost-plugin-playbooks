// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const OVERLAY_DELAY = 400;

export const MAX_NAME_LENGTH = 64;

export enum ErrorPageTypes {
    INCIDENTS = 'incidents',
    PLAYBOOKS = 'playbooks',
    DEFAULT = 'default',
}

export const TEMPLATE_TITLE_KEY = 'template_title';

export const BACKSTAGE_LIST_PER_PAGE = 15;

export const PROFILE_CHUNK_SIZE = 200;

export enum AdminNotificationType {
    PLAYBOOK = 'playbook',
    VIEW_TIMELINE = 'view_timeline',
    MESSAGE_TO_TIMELINE = 'message_to_timeline',
    PLAYBOOK_GRANULAR_ACCESS = 'playbook_granular_access',
    PLAYBOOK_CREATION_RESTRICTION = 'playbook_creation_restriction',
}
