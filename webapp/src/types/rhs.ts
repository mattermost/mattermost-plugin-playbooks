// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum RHSState {
    ViewingList,
    ViewingIncident,
}

export enum RHSTabState {
    ViewingAbout,
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
    UserJoinedLeft = 'user_joined_left',
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
    commander_changed: boolean;
    status_updated: boolean;
    event_from_post: boolean;
    task_state_modified: boolean;
    assignee_changed: boolean;
    ran_slash_command: boolean;
    user_joined_left: boolean;
}

export const TimelineEventsFilterDefault = {
    all: false,
    commander_changed: true,
    status_updated: true,
    event_from_post: true,
    task_state_modified: false,
    assignee_changed: false,
    ran_slash_command: false,
    user_joined_left: false,
};
