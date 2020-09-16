// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Checklist, isChecklist} from './playbook';

export interface Incident {
    id: string;
    name: string;
    is_active: boolean;
    commander_user_id: string;
    team_id: string;
    channel_id: string;
    create_at: number;
    end_at: number;
    post_id?: string;
    playbook_id: string;
    checklists: Checklist[];
    channel_name: string;
    channel_display_name: string;
    team_name: string;
    num_members: number;
    total_posts: number;
    active_stage: number;
}

export interface FetchIncidentsReturn {
    total_count: number;
    page_count: number;
    has_more: boolean;
    items: Incident[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isIncident(arg: any): arg is Incident {
    const optional = arg.post_id ? typeof arg.post_id === 'string' : true as boolean;
    return arg &&
        arg.id && typeof arg.id === 'string' &&
        arg.name && typeof arg.name === 'string' &&
        typeof arg.is_active === 'boolean' &&
        arg.commander_user_id && typeof arg.commander_user_id === 'string' &&
        arg.team_id && typeof arg.team_id === 'string' &&
        typeof arg.channel_id === 'string' &&
        typeof arg.end_at === 'number' &&
        typeof arg.create_at === 'number' &&
        optional &&
        arg.playbook_id && typeof arg.playbook_id === 'string' &&
        arg.checklists && Array.isArray(arg.checklists) && arg.checklists.every(isChecklist);
}

export interface FetchIncidentsParams {
    team_id?: string;
    page?: number;
    per_page?: number;
    sort?: string;
    order?: string;
    status?: string;
    commander_user_id?: string;
    search_term?: string;
}
