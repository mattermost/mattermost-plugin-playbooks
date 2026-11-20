// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {Duration} from 'luxon';

import {Section, SectionHeader} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_styles';
import {formatDuration} from 'src/components/formatted_duration';
import {liveMillis} from 'src/components/checklist_item/run_timing_context';
import {useNow, useRunTiming} from 'src/hooks';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {TimingMetricResult, TimingMetricStatus} from 'src/types/timing_metrics';

interface Props {
    run: PlaybookRun;
}

const MINUTE = 60 * 1000;

export const humanizeMillis = (millis: number) => {
    const rounded = millis >= MINUTE ? Math.round(millis / MINUTE) * MINUTE : millis;
    return formatDuration(Duration.fromMillis(rounded), 'narrow');
};

const NO_VALUE = '—';
const RHSInfoWaitingTime = ({run}: Props) => {
    const {formatMessage} = useIntl();
    const enabled = run.type !== PlaybookRunType.ChannelChecklist;
    const [timing] = useRunTiming(enabled ? run.id : undefined, [run.checklists, run.end_at]);
    const now = useNow(30000).valueOf();

    if (!enabled || !timing) {
        return null;
    }

    const active = run.current_status !== PlaybookRunStatus.Finished;
    const duration = liveMillis(timing.duration_millis, active, timing.computed_at, now);
    const waiting = liveMillis(timing.waiting_millis, active && timing.blocked_items > 0, timing.computed_at, now);
    const waitingShare = duration > 0 ? Math.round((waiting / duration) * 100) : 0;
    const metrics = timing.metrics ?? [];

    return (
        <>
            {metrics.length > 0 && (
                <Section data-testid='rhs-info-timing-metrics'>
                    <SectionHeader title={formatMessage({defaultMessage: 'Timing metrics'})}/>
                    <Rows>
                        {metrics.map((metric) => (
                            <MetricRow
                                key={metric.metric_id}
                                metric={metric}
                                now={now}
                                computedAt={timing.computed_at}
                            />
                        ))}
                    </Rows>
                </Section>
            )}
            <Section data-testid='rhs-info-waiting-time'>
                <SectionHeader title={formatMessage({defaultMessage: 'Waiting time'})}/>
                <Rows>
                    <Row>
                        <Name>{formatMessage({defaultMessage: 'Waiting on blockers'})}</Name>
                        <Value data-testid='waiting-time-value'>
                            {waiting > 0 ? formatMessage({defaultMessage: '{duration} ({percent}% of run)'}, {duration: humanizeMillis(waiting), percent: waitingShare}) : formatMessage({defaultMessage: 'None'})}
                        </Value>
                    </Row>
                    <Row>
                        <Name>{formatMessage({defaultMessage: 'Blocked tasks now'})}</Name>
                        <Value data-testid='blocked-tasks-value'>{timing.blocked_items}</Value>
                    </Row>
                    <Row>
                        <Name>{formatMessage({defaultMessage: 'Run duration'})}</Name>
                        <Value>{humanizeMillis(duration)}</Value>
                    </Row>
                </Rows>
            </Section>
        </>
    );
};

interface MetricRowProps {
    metric: TimingMetricResult;
    now: number;
    computedAt: number;
}

const MetricRow = ({metric, now, computedAt}: MetricRowProps) => {
    const {formatMessage} = useIntl();
    const running = metric.status === TimingMetricStatus.Running;
    const value = liveMillis(metric.value_millis, running, computedAt, now);
    const overTarget = metric.target_millis > 0 && value > metric.target_millis;

    let status: React.ReactNode;
    switch (metric.status) {
    case TimingMetricStatus.Met:
        status = <Pill $tone='good'>{formatMessage({defaultMessage: 'Met'})}</Pill>;
        break;
    case TimingMetricStatus.Missed:
        status = <Pill $tone='bad'>{formatMessage({defaultMessage: 'Missed'})}</Pill>;
        break;
    case TimingMetricStatus.Running:
        status = <Pill $tone={overTarget ? 'bad' : 'neutral'}>{overTarget ? formatMessage({defaultMessage: 'Over target'}) : formatMessage({defaultMessage: 'Running'})}</Pill>;
        break;
    case TimingMetricStatus.Pending:
        status = <Pill $tone='neutral'>{formatMessage({defaultMessage: 'Not started'})}</Pill>;
        break;
    case TimingMetricStatus.Unmeasurable:
    case TimingMetricStatus.NotReached:
        status = <Pill $tone='neutral'>{formatMessage({defaultMessage: "Can't be measured"})}</Pill>;
        break;
    default:
        status = null;
    }

    const hasValue = running || metric.status === TimingMetricStatus.Met || metric.status === TimingMetricStatus.Missed || metric.status === TimingMetricStatus.Done;

    return (
        <Row data-testid='timing-metric-row'>
            <Name>
                {metric.name}
                {metric.industry_name && <Badge>{metric.industry_name}</Badge>}
            </Name>
            <MetricValue>
                <span>
                    {hasValue ? humanizeMillis(value) : NO_VALUE}
                    {metric.target_millis > 0 && (
                        <Target>{formatMessage({defaultMessage: '/ target {target}'}, {target: humanizeMillis(metric.target_millis)})}</Target>
                    )}
                </span>
                {status}
            </MetricValue>
        </Row>
    );
};

const Rows = styled.div`
    display: flex;
    flex-direction: column;
`;

const Row = styled.div`
    display: flex;
    justify-content: space-between;
    padding: 8px 24px;
    gap: 12px;
`;

const Name = styled.div`
    display: flex;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    gap: 6px;
`;

const Value = styled.div`
    color: var(--center-channel-color);
    font-size: 14px;
    text-align: right;
`;

const MetricValue = styled(Value)`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
`;

const Target = styled.span`
    margin-left: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

export const Badge = styled.span`
    padding: 0 4px;
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
`;

export const Pill = styled.span<{$tone: 'good' | 'bad' | 'neutral'}>`
    padding: 0 6px;
    border-radius: 10px;
    background: ${({$tone}) => {
        if ($tone === 'good') {
            return 'rgba(var(--online-indicator-rgb), 0.16)';
        }
        if ($tone === 'bad') {
            return 'rgba(var(--dnd-indicator-rgb), 0.16)';
        }
        return 'rgba(var(--center-channel-color-rgb), 0.08)';
    }};
    color: var(--center-channel-color);
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
`;

export default RHSInfoWaitingTime;
