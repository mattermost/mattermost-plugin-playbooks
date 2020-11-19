// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Checklist, isChecklist} from './playbook';

export interface Incident {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
    commander_user_id: string;
    team_id: string;
    channel_id: string;
    create_at: number;
    end_at: number;
    delete_at: number;
    active_stage: number;
    active_stage_title: string;
    post_id: string;
    playbook_id: string;
    checklists: Checklist[];
    status_post_ids: string[];
}

export interface Metadata {
    channel_name: string;
    channel_display_name: string;
    team_name: string;
    num_members: number;
    total_posts: number;
}

export interface FetchIncidentsReturn {
    total_count: number;
    page_count: number;
    has_more: boolean;
    items: Incident[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isIncident(arg: any): arg is Incident {
    return Boolean(arg &&
        arg.id && typeof arg.id === 'string' &&
        arg.name && typeof arg.name === 'string' &&
        typeof arg.description === 'string' &&
        typeof arg.is_active === 'boolean' &&
        arg.commander_user_id && typeof arg.commander_user_id === 'string' &&
        arg.team_id && typeof arg.team_id === 'string' &&
        arg.channel_id && typeof arg.channel_id === 'string' &&
        typeof arg.create_at === 'number' &&
        typeof arg.end_at === 'number' &&
        typeof arg.delete_at === 'number' &&
        typeof arg.active_stage === 'number' &&
        typeof arg.active_stage_title === 'string' &&
        typeof arg.post_id === 'string' &&
        arg.playbook_id && typeof arg.playbook_id === 'string' &&
        arg.checklists && Array.isArray(arg.checklists) && arg.checklists.every(isChecklist)) &&
        arg.status_posts_ids && Array.isArray(arg.status_posts_ids);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isMetadata(arg: any): arg is Metadata {
    return Boolean(arg &&
        arg.channel_name && typeof arg.channel_name === 'string' &&
        arg.channel_display_name && typeof arg.channel_display_name === 'string' &&
        arg.team_name && typeof arg.team_name === 'string' &&
        typeof arg.num_members === 'number' &&
        typeof arg.total_posts === 'number');
}

export interface FetchIncidentsParams {
    team_id?: string;
    page?: number;
    per_page?: number;
    sort?: string;
    direction?: string;
    status?: string;
    commander_user_id?: string;
    search_term?: string;
    member_id?: string;
}
