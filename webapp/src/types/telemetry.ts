// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum GeneralViewTarget {
    TaskInbbox = 'task_inbox',
}

export enum PlaybookViewTarget {
    Usage = 'view_playbook_usage',
    Outline = 'view_playbook_outline',
    Reports = 'view_playbook_reports'
}

export enum PlaybookRunViewTarget {

    // Old tracking approach

    // @deprecated triggered at old run details page
    Overview = 'view_run_overview',

    // @deprecated triggered at old run details
    Retrospective = 'view_run_retrospective',

    ChannelsRHSDetails = 'view_run_channels_rhs_details',

    // New tracking approach
    // They're tracked as "page tracking", that's why they're not prefixed with "view_"

    // StatusUpdate is triggered any time a StatusUpdatePost is shown in a
    // channel, so we track impressions
    StatusUpdate = 'run_status_update',

    // Details is triggered when new RDP is shown
    Details = 'run_details', // old name: "view_run_details"
}

export enum PlaybookRunEventTarget {
    RequestUpdateClick = 'playbookrun_request_update_click',
    GetInvolvedClick = 'playbookrun_get_involved_click',
    GetInvolvedJoin = 'playbookrun_get_involved_join',
}

export type TelemetryViewTarget = GeneralViewTarget | PlaybookViewTarget | PlaybookRunViewTarget;
export type TelemetryEventTarget = PlaybookRunEventTarget;
