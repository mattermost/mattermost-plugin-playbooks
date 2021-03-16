// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum RHSState {
    ViewingList,
    ViewingIncident,
}

export enum RHSTabState {
    ViewingSummary,
    ViewingTasks,
    ViewingTimeline,
}

export enum TimelineEventType {
    IncidentCreated = 'incident_created',
    StatusUpdated = 'status_updated',
    CommanderChanged = 'commander_changed',
    AssigneeChanged = 'assignee_changed',
    TaskStateModified = 'task_state_modified',
    RanSlashCommand = 'ran_slash_command',
    EventFromPost = 'event_from_post',
}

export interface TimelineEvent {
    id: string;
    incident_id: string;
    create_at: number;
    delete_at: number;
    event_at: number;
    event_type: TimelineEventType;
    summary: string;
    details: string;
    post_id: string;
    subject_user_id: string;
    creator_user_id: string;
    subject_display_name?: string;
}

export interface TimelineEventsFilter {
    all: boolean;
    incident_created: boolean;
    status_updated: boolean;
    commander_changed: boolean;
    assignee_changed: boolean;
    task_state_modified: boolean;
    ran_slash_command: boolean;
    event_from_post: boolean;
}

export const TimelineEventsFilterDefault = {
    all: false,
    incident_created: true,
    status_updated: true,
    commander_changed: true,
    assignee_changed: false,
    task_state_modified: false,
    ran_slash_command: false,
    event_from_post: true,
};

export const TimelineEventsFilterAll = {
    all: true,
    incident_created: false,
    status_updated: false,
    commander_changed: false,
    assignee_changed: false,
    task_state_modified: false,
    ran_slash_command: false,
    event_from_post: false,
};
