// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

import {clientFetchPlaybooks, fetchTimingReport} from 'src/client';
import {TimingMetricStatus, TimingReport, TimingReportRow} from 'src/types/timing_metrics';

import TimingReportPage, {rowsToCSV} from './timing_report_page';

jest.mock('src/client', () => ({
    clientFetchPlaybooks: jest.fn(),
    fetchTimingReport: jest.fn(),
}));

jest.mock('src/hooks/redux', () => ({
    useAppSelector: () => 'team1',
}));

jest.mock('src/hooks', () => ({
    useNow: () => Date.now(),
    useRunTiming: () => null,
}));

const MINUTE = 60 * 1000;

const row: TimingReportRow = {
    run_id: 'run1',
    run_name: 'Outage, "east"',
    playbook_id: 'pb1',
    exercise: false,
    run_create_at: 1000,
    run_end_at: 0,
    metric_name: 'Time to acknowledge',
    industry_name: 'MTTA',
    target_millis: 15 * MINUTE,
    value_millis: 10 * MINUTE,
    status: TimingMetricStatus.Met,
};

const report = (overrides: Partial<TimingReport> = {}): TimingReport => ({
    run_count: 3,
    truncated: false,
    metrics: [{
        key: 'mtta',
        name: 'Time to acknowledge',
        industry_name: 'MTTA',
        target_millis: 15 * MINUTE,
        measured_count: 2,
        met_count: 2,
        missed_count: 0,
        in_progress_count: 1,
        unmeasurable_count: 0,
        median_millis: 10 * MINUTE,
        p90_millis: 12 * MINUTE,
        hit_rate: 1,
    }],
    rows: [row],
    steps: [{
        item_id: 'item1',
        title: 'Acknowledge',
        checklist_title: 'Triage',
        finished_runs: 2,
        timed_runs: 2,
        median_millis: 5 * MINUTE,
        blocked_runs: 1,
        block_count: 2,
        median_blocked_millis: 30 * MINUTE,
    }],
    ...overrides,
});

const renderPage = async () => {
    render(
        <IntlProvider locale='en'>
            <TimingReportPage/>
        </IntlProvider>,
    );
    await act(async () => undefined);
};

const lastReportQuery = () => jest.mocked(fetchTimingReport).mock.calls.at(-1)?.[0];
const isDisabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;

describe('TimingReportPage', () => {
    beforeEach(() => {
        jest.mocked(clientFetchPlaybooks).mockResolvedValue({items: [{id: 'pb1', title: 'Outage response'}]} as any);
        jest.mocked(fetchTimingReport).mockReset();
    });

    it('disables exports while the report loads', async () => {
        jest.mocked(fetchTimingReport).mockReturnValue(new Promise(() => undefined));
        await renderPage();

        expect(isDisabled(screen.getByTestId('timing-report-export-csv'))).toBe(true);
        expect(isDisabled(screen.getByTestId('timing-report-export-json'))).toBe(true);
        expect(screen.queryByTestId('timing-report-metrics')).toBeNull();
    });

    it('explains how to get data when no runs have metrics', async () => {
        jest.mocked(fetchTimingReport).mockResolvedValue(report({run_count: 0, metrics: [], rows: [], steps: []}));
        await renderPage();

        expect(screen.getByText(/No runs with timing metrics yet/)).toBeTruthy();
        expect(screen.queryByTestId('timing-report-metrics')).toBeNull();
    });

    it('shows an error when the report fails to load', async () => {
        jest.mocked(fetchTimingReport).mockRejectedValue(new Error('nope'));
        await renderPage();

        expect(screen.getByText('Unable to load the timing report.')).toBeTruthy();
    });

    it('shows metric results for the last 90 days of operational runs by default', async () => {
        jest.mocked(fetchTimingReport).mockResolvedValue(report({truncated: true}));
        const before = Date.now();
        await renderPage();

        const query = lastReportQuery();
        expect(query).toMatchObject({team_id: 'team1', playbook_id: undefined, include_exercises: undefined});
        expect(query?.started_gte).toBeGreaterThanOrEqual(before - (90 * 24 * 60 * MINUTE));

        const metrics = screen.getByTestId('timing-report-metrics');
        expect(metrics.textContent).toContain('Time to acknowledge');
        expect(metrics.textContent).toContain('MTTA');
        expect(metrics.textContent).toContain('100%');
        expect(screen.getByText(/3 runs/).textContent).toContain('(latest only)');
        expect(screen.queryByTestId('timing-report-steps')).toBeNull();
    });

    it('shows per-task steps once a playbook is picked', async () => {
        jest.mocked(fetchTimingReport).mockResolvedValue(report());
        await renderPage();

        fireEvent.change(screen.getByTestId('timing-report-playbook'), {target: {value: 'pb1'}});
        await waitFor(() => expect(lastReportQuery()?.playbook_id).toBe('pb1'));

        const steps = await screen.findByTestId('timing-report-steps');
        expect(screen.getByText('Steps in Outage response')).toBeTruthy();
        expect(steps.textContent).toContain('Acknowledge');
        expect(steps.textContent).toContain('2 in 1 run');
    });

    it('refetches when the range or exercise filter changes', async () => {
        jest.mocked(fetchTimingReport).mockResolvedValue(report());
        await renderPage();

        fireEvent.change(screen.getByTestId('timing-report-range'), {target: {value: '0'}});
        await waitFor(() => expect(lastReportQuery()?.started_gte).toBeUndefined());

        fireEvent.click(screen.getByTestId('timing-report-include-exercises'));
        await waitFor(() => expect(lastReportQuery()?.include_exercises).toBe(true));
    });

    describe('exports', () => {
        let blobs: Blob[];
        let downloads: string[];

        beforeEach(() => {
            blobs = [];
            downloads = [];
            URL.createObjectURL = jest.fn((blob: Blob) => {
                blobs.push(blob);
                return 'blob:report';
            });
            URL.revokeObjectURL = jest.fn();
            jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordDownload(this: HTMLAnchorElement) {
                downloads.push(this.download);
            });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('downloads the rows as CSV', async () => {
            jest.mocked(fetchTimingReport).mockResolvedValue(report());
            await renderPage();

            fireEvent.click(screen.getByTestId('timing-report-export-csv'));

            expect(downloads).toEqual(['timing-report.csv']);
            expect(blobs[0].type).toBe('text/csv');
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
        });

        it('downloads the whole report as JSON', async () => {
            jest.mocked(fetchTimingReport).mockResolvedValue(report());
            await renderPage();

            fireEvent.click(screen.getByTestId('timing-report-export-json'));

            expect(downloads).toEqual(['timing-report.json']);
            expect(blobs[0].type).toBe('application/json');
        });
    });
});

describe('rowsToCSV', () => {
    it('writes a header and quotes cells containing commas or quotes', () => {
        const [header, line] = rowsToCSV([row]).split('\n');

        expect(header).toBe('run_id,run_name,playbook_id,exercise,run_create_at,run_end_at,metric_name,industry_name,target_millis,value_millis,status');
        expect(line).toBe(`run1,"Outage, ""east""",pb1,false,1000,0,Time to acknowledge,MTTA,${15 * MINUTE},${10 * MINUTE},met`);
    });

    it('keeps text that looks like a formula from being evaluated, but leaves numbers alone', () => {
        const [, line] = rowsToCSV([{...row, run_name: '=HYPERLINK("http://x")', metric_name: '@SUM(A1)', value_millis: -1}]).split('\n');

        expect(line).toBe(`run1,"'=HYPERLINK(""http://x"")",pb1,false,1000,0,'@SUM(A1),MTTA,${15 * MINUTE},-1,met`);
    });
});
