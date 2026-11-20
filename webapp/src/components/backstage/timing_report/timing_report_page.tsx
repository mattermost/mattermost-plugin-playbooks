// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {useAppSelector} from 'src/hooks/redux';
import {clientFetchPlaybooks, fetchTimingReport} from 'src/client';
import {Playbook} from 'src/types/playbook';
import {TimingReport, TimingReportRow} from 'src/types/timing_metrics';
import {Badge, humanizeMillis} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_waiting_time';
import {SecondaryButton} from 'src/components/assets/buttons';

const DAY = 24 * 60 * 60 * 1000;
const NONE = '—';

const RANGES = [
    {days: 30, label: 'Last 30 days'},
    {days: 90, label: 'Last 90 days'},
    {days: 0, label: 'All time'},
];

const ROW_COLUMNS: Array<keyof TimingReportRow> = [
    'run_id', 'run_name', 'playbook_id', 'exercise', 'run_create_at', 'run_end_at',
    'metric_name', 'industry_name', 'target_millis', 'value_millis', 'status',
];

const csvCell = (value: unknown) => {
    const text = String(value ?? '');
    return (/[",\n]/).test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const rowsToCSV = (rows: TimingReportRow[]) => [
    ROW_COLUMNS.join(','),
    ...rows.map((row) => ROW_COLUMNS.map((column) => csvCell(row[column])).join(',')),
].join('\n');

const download = (filename: string, type: string, content: string) => {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const TimingReportPage = () => {
    const {formatMessage} = useIntl();
    const teamId = useAppSelector(getCurrentTeamId);
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [playbookId, setPlaybookId] = useState('');
    const [rangeDays, setRangeDays] = useState(90);
    const [includeExercises, setIncludeExercises] = useState(false);
    const [report, setReport] = useState<{playbookId: string; data: TimingReport} | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        clientFetchPlaybooks(teamId, {sort: 'title', direction: 'asc', per_page: 200} as any).then((result) => {
            setPlaybooks(result?.items ?? []);
        }).catch(() => setPlaybooks([]));
    }, [teamId]);

    const startedGTE = useMemo(() => (rangeDays ? Date.now() - (rangeDays * DAY) : undefined), [rangeDays]);

    useEffect(() => {
        let cancelled = false;
        setError(false);
        fetchTimingReport({
            team_id: teamId,
            playbook_id: playbookId || undefined,
            include_exercises: includeExercises || undefined,
            started_gte: startedGTE,
        }).then((result) => {
            if (!cancelled) {
                setReport(result ? {playbookId, data: result} : null);
            }
        }).catch(() => {
            if (!cancelled) {
                setError(true);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [teamId, playbookId, includeExercises, startedGTE]);

    const playbookTitles = useMemo(() => new Map(playbooks.map((pb) => [pb.id, pb.title])), [playbooks]);
    const data = report?.data;
    const steps = report?.playbookId ? data?.steps : undefined;

    return (
        <Page data-testid='timing-report-page'>
            <Header>
                <div>
                    <Title>{formatMessage({defaultMessage: 'Timing report'})}</Title>
                    <Subtitle>{formatMessage({defaultMessage: 'How long runs take between the points each playbook measures, compared to target.'})}</Subtitle>
                </div>
                <Exports>
                    <SecondaryButton
                        data-testid='timing-report-export-csv'
                        disabled={!data}
                        onClick={() => data && download('timing-report.csv', 'text/csv', rowsToCSV(data.rows))}
                    >
                        {formatMessage({defaultMessage: 'Export CSV'})}
                    </SecondaryButton>
                    <SecondaryButton
                        data-testid='timing-report-export-json'
                        disabled={!data}
                        onClick={() => data && download('timing-report.json', 'application/json', JSON.stringify(data, null, 2))}
                    >
                        {formatMessage({defaultMessage: 'Export JSON'})}
                    </SecondaryButton>
                </Exports>
            </Header>

            <Filters>
                <select
                    data-testid='timing-report-playbook'
                    value={playbookId}
                    onChange={(e) => setPlaybookId(e.target.value)}
                >
                    <option value=''>{formatMessage({defaultMessage: 'All playbooks'})}</option>
                    {playbooks.map((pb) => (
                        <option
                            key={pb.id}
                            value={pb.id}
                        >
                            {pb.title}
                        </option>
                    ))}
                </select>
                <select
                    data-testid='timing-report-range'
                    value={rangeDays}
                    onChange={(e) => setRangeDays(Number(e.target.value))}
                >
                    {RANGES.map((range) => (
                        <option
                            key={range.days}
                            value={range.days}
                        >
                            {range.label}
                        </option>
                    ))}
                </select>
                <CheckboxLabel>
                    <input
                        data-testid='timing-report-include-exercises'
                        type='checkbox'
                        checked={includeExercises}
                        onChange={(e) => setIncludeExercises(e.target.checked)}
                    />
                    {formatMessage({defaultMessage: 'Include exercise runs'})}
                </CheckboxLabel>
                {data && (
                    <RunCount>
                        {formatMessage({defaultMessage: '{count, plural, one {# run} other {# runs}}'}, {count: data.run_count})}
                        {data.truncated && formatMessage({defaultMessage: ' (latest only)'})}
                    </RunCount>
                )}
            </Filters>

            {error && <Empty>{formatMessage({defaultMessage: 'Unable to load the timing report.'})}</Empty>}

            {data && data.metrics.length === 0 && (
                <Empty>{formatMessage({defaultMessage: 'No runs with timing metrics yet. Add timing metrics in a playbook\'s Timing section.'})}</Empty>
            )}

            {data && data.metrics.length > 0 && (
                <Card>
                    <CardTitle>{formatMessage({defaultMessage: 'Metrics'})}</CardTitle>
                    <Table data-testid='timing-report-metrics'>
                        <thead>
                            <tr>
                                <th>{formatMessage({defaultMessage: 'Metric'})}</th>
                                <th>{formatMessage({defaultMessage: 'Measured runs'})}</th>
                                <th>{formatMessage({defaultMessage: 'Median'})}</th>
                                <th>{formatMessage({defaultMessage: 'p90'})}</th>
                                <th>{formatMessage({defaultMessage: 'Target'})}</th>
                                <th>{formatMessage({defaultMessage: 'Hit rate'})}</th>
                                <th>{formatMessage({defaultMessage: 'In progress'})}</th>
                                <th>{formatMessage({defaultMessage: "Can't be measured"})}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.metrics.map((metric) => (
                                <tr key={metric.key}>
                                    <td>
                                        <NameCell>
                                            {metric.industry_name ? <Badge>{metric.industry_name}</Badge> : null}
                                            {metric.name}
                                        </NameCell>
                                    </td>
                                    <td>{metric.measured_count}</td>
                                    <td>{metric.measured_count ? humanizeMillis(metric.median_millis) : NONE}</td>
                                    <td>{metric.measured_count ? humanizeMillis(metric.p90_millis) : NONE}</td>
                                    <td>{metric.target_millis ? humanizeMillis(metric.target_millis) : formatMessage({defaultMessage: 'Mixed or none'})}</td>
                                    <td>
                                        {metric.hit_rate < 0 ? NONE : (
                                            <HitRate $good={metric.hit_rate >= 0.8}>
                                                {formatMessage({defaultMessage: '{rate, number, percent}'}, {rate: metric.hit_rate})}
                                            </HitRate>
                                        )}
                                    </td>
                                    <td>{metric.in_progress_count}</td>
                                    <td>{metric.unmeasurable_count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card>
            )}

            {steps && (
                <Card>
                    <CardTitle>
                        {formatMessage({defaultMessage: 'Steps in {playbook}'}, {playbook: playbookTitles.get(report?.playbookId ?? '') ?? ''})}
                    </CardTitle>
                    <Table data-testid='timing-report-steps'>
                        <thead>
                            <tr>
                                <th>{formatMessage({defaultMessage: 'Task'})}</th>
                                <th>{formatMessage({defaultMessage: 'Section'})}</th>
                                <th>{formatMessage({defaultMessage: 'Finished in'})}</th>
                                <th>{formatMessage({defaultMessage: 'Median start to finish'})}</th>
                                <th>{formatMessage({defaultMessage: 'Times blocked'})}</th>
                                <th>{formatMessage({defaultMessage: 'Median time blocked'})}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {steps.map((step) => (
                                <tr key={step.item_id}>
                                    <td>{step.title}</td>
                                    <td>{step.checklist_title}</td>
                                    <td>{formatMessage({defaultMessage: '{count, plural, one {# run} other {# runs}}'}, {count: step.finished_runs})}</td>
                                    <td>{step.timed_runs ? humanizeMillis(step.median_millis) : NONE}</td>
                                    <td>
                                        {step.block_count ? formatMessage({defaultMessage: '{count} in {runs, plural, one {# run} other {# runs}}'}, {count: step.block_count, runs: step.blocked_runs}) : NONE}
                                    </td>
                                    <td>{step.blocked_runs ? humanizeMillis(step.median_blocked_millis) : NONE}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card>
            )}
        </Page>
    );
};

const Page = styled.div`
    display: flex;
    flex-direction: column;
    padding: 32px 40px;
    color: var(--center-channel-color);
    gap: 20px;

    select {
        height: 32px;
        padding: 0 8px;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
        border-radius: 4px;
        background: var(--center-channel-bg);
        color: var(--center-channel-color);
    }
`;

const Header = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
`;

const Title = styled.h1`
    margin: 0;
    font-family: Metropolis, sans-serif;
    font-size: 22px;
    font-weight: 600;
`;

const Subtitle = styled.div`
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
`;

const Exports = styled.div`
    display: flex;
    gap: 8px;
`;

const Filters = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const CheckboxLabel = styled.label`
    display: flex;
    align-items: center;
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    gap: 6px;
`;

const RunCount = styled.div`
    margin-left: auto;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
`;

const Card = styled.div`
    padding: 16px 20px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
    background: var(--center-channel-bg);
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.08);
`;

const CardTitle = styled.div`
    margin-bottom: 12px;
    font-size: 16px;
    font-weight: 600;
`;

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;

    th {
        padding: 8px;
        border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.64);
        font-size: 12px;
        font-weight: 600;
        text-align: left;
        text-transform: uppercase;
    }

    td {
        padding: 10px 8px;
        border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

const NameCell = styled.div`
    display: flex;
    align-items: center;
    font-weight: 600;
    gap: 6px;
`;

const HitRate = styled.span<{$good: boolean}>`
    color: ${({$good}) => ($good ? 'var(--online-indicator)' : 'var(--dnd-indicator)')};
    font-weight: 600;
`;

const Empty = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
`;

export default TimingReportPage;
