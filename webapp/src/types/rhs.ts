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
    IncidentEnded = 'incident_ended',
    TaskCompleted = 'task_completed',
    StatusUpdated = 'status_updated',
}

export interface TimelineEvent {
    type: TimelineEventType;
    create_at: number;
    post_id?: string;
    display_name?: string;
    status?: string;
}
