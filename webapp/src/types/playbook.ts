// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface Playbook {
    id?: string;
    title: string;
    description: string;
    team_id: string;
    create_public_incident: boolean;
    checklists: Checklist[];
    member_ids: string[];
    broadcast_channel_id: string;
    reminder_message_template: string;
    reminder_timer_default_seconds: number;
    invited_user_ids: string[];
    invited_group_ids: string[];
    invite_users_enabled: boolean;
    default_commander_id: string;
    default_commander_enabled: boolean;
    announcement_channel_id: string;
    announcement_channel_enabled: boolean;
    webhook_on_creation_url: string;
    webhook_on_creation_enabled: boolean;
}

export interface PlaybookNoChecklist {
    id?: string;
    title: string;
    description: string;
    team_id: string;
    create_public_incident: boolean;
    num_stages: number;
    num_steps: number;
    member_ids: string[];
}

export interface FetchPlaybooksNoChecklistReturn {
    total_count: number;
    page_count: number;
    has_more: boolean;
    items: PlaybookNoChecklist[];
}

export interface FetchIncidentsParams {
    sort?: string;
    direction?: string;
}

export interface FetchPlaybooksCountReturn {
    count: number;
}

export interface Checklist {
    title: string;
    items: ChecklistItem[];
}

export enum ChecklistItemState {
    Open = '',
    InProgress = 'in_progress',
    Closed = 'closed',
}

export interface ChecklistItem {
    title: string;
    description: string;
    state: ChecklistItemState;
    state_modified?: number;
    state_modified_post_id?: string;
    assignee_id?: string;
    assignee_modified?: number;
    assignee_modified_post_id?: string;
    command: string;
    command_last_run: number;
}

export function emptyPlaybook(): Playbook {
    return {
        title: '',
        description: '',
        team_id: '',
        create_public_incident: false,
        checklists: [emptyChecklist()],
        member_ids: [],
        broadcast_channel_id: '',
        reminder_message_template: '',
        reminder_timer_default_seconds: 0,
        invited_user_ids: [],
        invited_group_ids: [],
        invite_users_enabled: false,
        default_commander_id: '',
        default_commander_enabled: false,
        announcement_channel_id: '',
        announcement_channel_enabled: false,
        webhook_on_creation_url: '',
        webhook_on_creation_enabled: false,
    };
}

export function emptyChecklist(): Checklist {
    return {
        title: 'Default Checklist',
        items: [emptyChecklistItem()],
    };
}

export function emptyChecklistItem(): ChecklistItem {
    return {
        title: '',
        state: ChecklistItemState.Open,
        command: '',
        description: '',
        command_last_run: 0,
    };
}

export const newChecklistItem = (title = '', description = '', command = '', state = ChecklistItemState.Open): ChecklistItem => ({
    title,
    description,
    command,
    command_last_run: 0,
    state,
});

// eslint-disable-next-line
export function isPlaybook(arg: any): arg is Playbook {
    return arg &&
        typeof arg.id === 'string' &&
        typeof arg.title === 'string' &&
        typeof arg.team_id === 'string' &&
        typeof arg.create_public_incident === 'boolean' &&
        arg.checklists && Array.isArray(arg.checklists) && arg.checklists.every(isChecklist) &&
        arg.member_ids && Array.isArray(arg.member_ids) && arg.checklists.every((id: any) => typeof id === 'string') &&
        typeof arg.broadcast_channel_id === 'string' &&
        typeof arg.reminder_message_template == 'string' &&
        typeof arg.reminder_timer_default_seconds == 'number' &&
        arg.invited_user_ids && Array.isArray(arg.invited_user_ids) && arg.checklists.every((id: any) => typeof id === 'string') &&
        arg.invited_group_ids && Array.isArray(arg.invited_group_ids) && arg.checklists.every((id: any) => typeof id === 'string') &&
        typeof arg.invite_users_enabled === 'boolean' &&
        typeof arg.default_commander_id === 'string' &&
        typeof arg.default_commander_enabled === 'boolean' &&
        typeof arg.announcement_channel_id === 'string' &&
        typeof arg.announcement_channel_enabled === 'boolean' &&
        typeof arg.webhook_on_creation_url === 'string' &&
        typeof arg.webhook_on_creation_enabled === 'boolean';
}

// eslint-disable-next-line
export function isChecklist(arg: any): arg is Checklist {
    return arg &&
        typeof arg.title === 'string' &&
        arg.items && Array.isArray(arg.items) && arg.items.every(isChecklistItem);
}

// eslint-disable-next-line
export function isChecklistItem(arg: any): arg is ChecklistItem {
    return arg &&
        typeof arg.title === 'string' &&
        typeof arg.state_modified === 'number' &&
        typeof arg.state_modified_post_id === 'string' &&
        typeof arg.assignee_id === 'string' &&
        typeof arg.assignee_modified === 'number' &&
        typeof arg.assignee_modified_post_id === 'string' &&
        typeof arg.state === 'string' &&
        typeof arg.command === 'string' &&
        typeof arg.command_last_run === 'number';
}
