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
    TaskStateModified = 'task_state_modified',
    StatusUpdated = 'status_updated',
    CommanderChanged = 'commander_changed',
    AssigneeChanged = 'assignee_changed',
    RanSlashCommand = 'ran_slash_command',
}

export interface TimelineEvent {
    id: string;
    incidentID: string;
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
