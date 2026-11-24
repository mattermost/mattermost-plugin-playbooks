// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

import {
    ReportExport,
    ReportFormat,
    RunReportOptions,
    exportPlaybookReport,
    exportRunReport,
    saveReport,
} from 'src/client';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

import type {SectionFlags} from './export_options_modal';

export type ReportTarget = {kind: 'run' | 'playbook'; id: string};

// useReportExport returns a function that exports a run or playbook report and saves it.
// A truncated transcript and failures are reported in a toast, so the returned promise
// always resolves.
export const useReportExport = () => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;

    return async ({kind, id}: ReportTarget, sections: SectionFlags, format: ReportFormat, runOptions?: RunReportOptions) => {
        try {
            let report: ReportExport;
            if (kind === 'run') {
                report = await exportRunReport(id, format, sections, runOptions);
            } else {
                report = await exportPlaybookReport(id, format, sections);
            }
            if (report.truncated) {
                addToast({
                    content: formatMessage({defaultMessage: 'The transcript was truncated due to size limits.'}),
                    toastStyle: ToastStyle.Success,
                });
            }
            saveReport(report, format);
        } catch (err) {
            const message = err instanceof Error ? err.message : formatMessage({defaultMessage: 'Failed to export.'});
            const requestId = (err as {requestId?: string | null})?.requestId;
            addToast({
                content: requestId ? `${message} (ref: ${requestId})` : message,
                toastStyle: ToastStyle.Failure,
            });
        }
    };
};
