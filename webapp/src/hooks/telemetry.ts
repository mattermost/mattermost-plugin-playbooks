import {useEffect} from 'react';

import {telemetryEventForPlaybook, telemetryEventForPlaybookRun, telemetryView} from 'src/client';
import {PlaybookViewTarget, PlaybookRunViewTarget, TelemetryViewTarget} from 'src/types/telemetry';

export const useViewTelemetry = (target: TelemetryViewTarget, trigger?: string, data = {}) => {
    useEffect(() => {
        if (trigger) {
            telemetryView(target, data);
        }
    }, [trigger]);
};

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
