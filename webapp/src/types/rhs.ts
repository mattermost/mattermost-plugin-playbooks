// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum TimelineEventType {
    RunCreated = 'incident_created',
    StatusUpdated = 'status_updated',
    StatusUpdateRequested = 'status_update_requested',
    StatusUpdateSnoozed = 'status_update_snoozed',
    OwnerChanged = 'owner_changed',
    AssigneeChanged = 'assignee_changed',
    TaskStateModified = 'task_state_modified',
    RanSlashCommand = 'ran_slash_command',
    EventFromPost = 'event_from_post',
    UserJoinedLeft = 'user_joined_left',
    ParticipantsChanged = 'participants_changed',
    PublishedRetrospective = 'published_retrospective',
    CanceledRetrospective = 'canceled_retrospective',
    RunFinished = 'run_finished',
    RunRestored = 'run_restored',
    StatusUpdatesEnabled = 'status_updates_enabled',
    StatusUpdatesDisabled = 'status_updates_disabled',
    RetrospectiveEnabled = 'retrospective_enabled',
    RetrospectiveDisabled = 'retrospective_disabled',
    PropertyChanged = 'property_changed',
    PhaseStarted = 'phase_started',
    PhaseDone = 'phase_done',
    PhaseReopened = 'phase_reopened',
    CurrentPhaseChanged = 'current_phase_changed',
}

// The events that record a run's phases. The phase bar is read from them, so they cannot be deleted.
export const isPhaseEventType = (eventType: string) => [
    TimelineEventType.PhaseStarted,
    TimelineEventType.PhaseDone,
    TimelineEventType.PhaseReopened,
    TimelineEventType.CurrentPhaseChanged,
].includes(eventType as TimelineEventType);

export interface TimelineEvent {
    id: string;
    playbook_run_id: string;
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

    /** @remarks computed client-side */
    status_delete_at?: number;

    /** @remarks computed client-side: how long a phase took, on its phase_done event */
    phase_duration?: number;
}

export interface TimelineEventsFilter {
    all: boolean;
    owner_changed: boolean;
    status_updated: boolean;
    event_from_post: boolean;
    task_state_modified: boolean;
    assignee_changed: boolean;
    ran_slash_command: boolean;
    user_joined_left: boolean;
    phase_started: boolean;
}

export const TimelineEventsFilterDefault = {
    all: true,
    owner_changed: true,
    status_updated: true,
    event_from_post: true,
    task_state_modified: true,
    assignee_changed: false,
    ran_slash_command: false,
    user_joined_left: false,
    phase_started: true,
};

export interface ParticipantsChangedDetails {
    action: string;
    requester: string;
    users: string[];
}

export interface UserJoinedLeftDetails {
    title?: string;
    action: string;
    requester: string;
    users: string[];
}

export interface TaskStateModifiedDetails {
    action: string | 'check' | 'uncheck' | 'skip' | 'restore' | 'requirements_updated' | 'start' | 'block' | 'unblock';
    task: string;
    blocked_reason?: string;
    blocked_by_user_ids?: string[];

    // Stable checklist-item id, added so attribution can join event→item by identity instead of the
    // timestamp+title heuristic. Absent on events created before this field was introduced.
    item_id?: string;
}

export interface PropertyChangedDetails {
    property_field_id: string;
    property_field_name: string;
    old_value: string | string[];
    new_value: string | string[];
    old_value_display: string | null;
    new_value_display: string | null;
}

export interface PhaseEventDetails {
    checklist_id: string;
    title: string;
    source: 'automatic' | 'manual';
}

export interface CurrentPhaseChangedDetails {
    from_checklist_id: string;
    from_title: string;
    to_checklist_id: string;
    to_title: string;
}
