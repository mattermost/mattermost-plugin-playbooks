// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface Incident {
    id: string;
    name: string;
    is_active: boolean;
    commander_user_id: string;
    team_id: string;
    channel_ids: string[];
    created_at: number;
    post_id?: string;
}

export interface Playbook {
    id: string;
    title: string;
    checklists: CheckList[];
}

export interface CheckList {
    title: string;
    items: ChecklistItem[];
}

export interface ChecklistItem {
    title: string;
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
        arg.channel_ids && Array.isArray(arg.channel_ids) &&
        arg.created_at && typeof arg.created_at === 'number' &&
        optional;
}

export enum RHSState {
    List,
    Details,
}
