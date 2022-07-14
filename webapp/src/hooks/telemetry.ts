import {useEffect} from 'react';

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
    useEffect(() => {
        if (playbookRunID) {
            telemetryEventForPlaybookRun(playbookRunID, target);
        }
    }, [playbookRunID]);
};
