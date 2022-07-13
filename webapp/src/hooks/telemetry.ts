import {useEffect} from 'react';

import {telemetryEventForPlaybook, telemetryEventForPlaybookRun} from 'src/client';

export enum PlaybookTarget {
    Usage = 'view_playbook_usage',
    Outline = 'view_playbook_outline',
    Reports = 'view_playbook_reports'
}

export enum PlaybookRunTarget {

    // @deprecated triggered at old run details
    Overview = 'view_run_overview',

    // @deprecated triggered at old run details
    Retrospective = 'view_run_retrospective',
    Details = 'view_run_details',
    ChannelsRHSDetails = 'view_run_channels_rhs_details',
}

export const usePlaybookViewTelemetry = (target: PlaybookTarget, playbookID?: string) => {
    useEffect(() => {
        if (playbookID) {
            telemetryEventForPlaybook(playbookID, target);
        }
    }, [playbookID]);
};

export const usePlaybookRunViewTelemetry = (target: PlaybookRunTarget, playbookRunID?: string) => {
    useEffect(() => {
        if (playbookRunID) {
            telemetryEventForPlaybookRun(playbookRunID, target);
        }
    }, [playbookRunID]);
};
