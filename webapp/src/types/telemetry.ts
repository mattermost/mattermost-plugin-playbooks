// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum PlaybookViewTarget {
    Usage = 'view_playbook_usage',
    Outline = 'view_playbook_outline',
    Reports = 'view_playbook_reports'
}

export enum PlaybookRunViewTarget {

    // @deprecated triggered at old run details page
    Overview = 'view_run_overview',

    // @deprecated triggered at old run details
    Retrospective = 'view_run_retrospective',

    Details = 'view_run_details',
    ChannelsRHSDetails = 'view_run_channels_rhs_details',

    // StatusUpdate is triggered any time a StatusUpdatePost is shown in a
    // channel, so we track impressions
    // it's tracked as page tracking, that's why it's not prefixed as view_
    StatusUpdate = 'run_status_update',
}

export enum PlaybookRunEventTarget {
    RequestUpdateClick = 'playbookrun_request_update_click',
    GetInvolvedClick = 'playbookrun_get_involved_click',
    GetInvolvedJoin = 'playbookrun_get_involved_join',
}

export type TelemetryViewTarget = PlaybookViewTarget | PlaybookRunViewTarget;
export type TelemetryEventTarget = PlaybookRunEventTarget;
