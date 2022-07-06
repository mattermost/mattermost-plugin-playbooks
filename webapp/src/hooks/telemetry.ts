import {useEffect} from 'react';

import {telemetryEventForPlaybook, telemetryEventForPlaybookRun} from 'src/client';

export const usePlaybookNavigationTelemetry = (target: string, playbookID?: string) => {
    useEffect(() => {
        if (playbookID) {
            telemetryEventForPlaybook(playbookID, `navigate_playbook_${target}`);
        }
    }, [playbookID]);
};

export const usePlaybookRunNavigationTelemetry = (target: string, playbookRunID?: string) => {
    useEffect(() => {
        if (playbookRunID) {
            telemetryEventForPlaybookRun(playbookRunID, `navigate_run_${target}`);
        }
    }, [playbookRunID]);
};
