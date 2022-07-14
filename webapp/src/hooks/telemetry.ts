import {useEffect} from 'react';
import {useLocation} from 'react-use';

import {telemetryEventForPlaybook, telemetryEventForPlaybookRun} from 'src/client';
import {PlaybookViewTarget, PlaybookRunViewTarget} from 'src/types/telemetry';

export const usePlaybookViewTelemetry = (target: PlaybookViewTarget, playbookID?: string) => {
    useEffect(() => {
        if (playbookID) {
            telemetryEventForPlaybook(playbookID, target);
        }
    }, [playbookID]);
};

export const usePlaybookRunViewTelemetry = (target: PlaybookRunViewTarget, playbookRunID?: string) => {
    const {pathname} = useLocation();
    useEffect(() => {
        // Needed until we remove the old run details
        if (pathname?.includes('/playbooks/run_details/') && target === PlaybookRunViewTarget.Retrospective) {
            return;
        }
        if (playbookRunID) {
            telemetryEventForPlaybookRun(playbookRunID, target);
        }
    }, [playbookRunID]);
};
