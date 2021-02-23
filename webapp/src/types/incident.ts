// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimelineEvent, TimelineEventType} from 'src/types/rhs';

import {Checklist, isChecklist} from './playbook';

export interface Incident {
    id: string;
    name: string;
    description: string;
    commander_user_id: string;
    reporter_user_id: string;
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
    status_posts: StatusPost[];
    reminder_post_id: string;
    broadcast_channel_id: string;
    timeline_events: TimelineEvent[];
}

export interface StatusPost {
    id: string;
    status: IncidentStatus;
    create_at: number;
    delete_at: number;
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

export enum IncidentStatus {
    Reported = 'Reported',
    Active = 'Active',
    Resolved = 'Resolved',
    Archived = 'Archived',
    Old = '',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isIncident(arg: any): arg is Incident {
    return Boolean(arg &&
        arg.id && typeof arg.id === 'string' &&
        arg.name && typeof arg.name === 'string' &&
        typeof arg.description === 'string' &&
        arg.commander_user_id && typeof arg.commander_user_id === 'string' &&
        arg.reporter_user_id && typeof arg.reporter_user_id === 'string' &&
        arg.team_id && typeof arg.team_id === 'string' &&
        arg.channel_id && typeof arg.channel_id === 'string' &&
        typeof arg.create_at === 'number' &&
        typeof arg.end_at === 'number' &&
        typeof arg.delete_at === 'number' &&
        typeof arg.active_stage === 'number' &&
        typeof arg.active_stage_title === 'string' &&
        typeof arg.post_id === 'string' &&
        arg.playbook_id && typeof arg.playbook_id === 'string' &&
        arg.checklists && Array.isArray(arg.checklists) && arg.checklists.every(isChecklist) &&
        arg.status_posts && Array.isArray(arg.status_posts) && arg.status_posts.every(isStatusPost) &&
        typeof arg.reminder_post_id === 'string' &&
        typeof arg.broadcast_channel_id === 'string' &&
        arg.timeline_events && Array.isArray(arg.timeline_events) && arg.timeline_events.every(isTimelineEvent));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isStatusPost(arg: any): arg is StatusPost {
    return Boolean(arg &&
        arg.id && typeof arg.id === 'string' &&
        typeof arg.create_at === 'number' &&
        typeof arg.status === 'string' &&
        typeof arg.delete_at === 'number');
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

export function isTimelineEvent(arg: any): arg is TimelineEvent {
    return Boolean(arg &&
        typeof arg.id === 'string' &&
        typeof arg.incident_id === 'string' &&
        typeof arg.create_at === 'number' &&
        typeof arg.delete_at === 'number' &&
        typeof arg.event_at === 'number' &&
        typeof arg.event_type === 'string' && Object.values(TimelineEventType).includes(arg.event_type) &&
        typeof arg.summary === 'string' &&
        typeof arg.details === 'string' &&
        typeof arg.post_id === 'string' &&
        typeof arg.subject_user_id === 'string' &&
        typeof arg.creator_user_id === 'string');
}

export function incidentCurrentStatusPost(incident: Incident): StatusPost | undefined {
    const sortedPosts = [...incident.status_posts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);

    return sortedPosts[0];
}

export function incidentCurrentStatus(incident: Incident): IncidentStatus {
    let status = IncidentStatus.Reported;

    const currentPost = incidentCurrentStatusPost(incident);

    if (!currentPost || currentPost.status === IncidentStatus.Old) {
        // Backwards compatibility with existing incidents.
        if (incident.end_at === 0) {
            if (currentPost) {
                status = IncidentStatus.Active;
            } else {
                status = IncidentStatus.Reported;
            }
        } else {
            status = IncidentStatus.Resolved;
        }
    } else {
        status = currentPost.status;
    }

    return status;
}

export function incidentIsActive(incident: Incident): boolean {
    const currentStatus = incidentCurrentStatus(incident);
    return currentStatus !== IncidentStatus.Archived;
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

export interface FetchPlaybooksParams {
    team_id?: string;
    page?: number;
    per_page?: number;
    sort?: string;
    direction?: string;
    member_only?: boolean;
}
