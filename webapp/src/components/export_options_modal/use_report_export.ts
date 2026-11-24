// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

import {
    ReportFormat,
    RunReportOptions,
    exportRunReport,
    saveReport,
} from 'src/client';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

import type {SectionFlags} from './export_options_modal';

// useReportExport returns a function that exports a run report and saves it.
// A truncated transcript and failures are reported in a toast, so the returned promise
// always resolves.
export const useReportExport = () => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;

    return async (runID: string, sections: SectionFlags, format: ReportFormat, options: RunReportOptions) => {
        try {
            const report = await exportRunReport(runID, format, sections, options);
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
