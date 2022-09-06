
export enum PlaybookViewTarget {
    Usage = 'view_playbook_usage',
    Outline = 'view_playbook_outline',
    Reports = 'view_playbook_reports'
}

export enum PlaybookRunViewTarget {

    // @deprecated triggered at old run details
    Overview = 'view_run_overview',

    // @deprecated triggered at old run details
    Retrospective = 'view_run_retrospective',
    Details = 'view_run_details',
    ChannelsRHSDetails = 'view_run_channels_rhs_details',
    PostStatusUpdate = 'view_run_post_status_update',
}

export enum PlaybookRunEventTarget {
    RequestUpdateClick = 'playbookrun_request_update_click',
    GetInvolvedClick = 'playbookrun_get_involved_click',
    GetInvolvedJoin = 'playbookrun_get_involved_join',
}

export type TelemetryViewTarget = PlaybookViewTarget | PlaybookRunViewTarget;
