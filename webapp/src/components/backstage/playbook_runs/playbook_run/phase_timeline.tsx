// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';
import {Duration} from 'luxon';

import {useNow} from 'src/hooks';
import {formatDuration} from 'src/components/formatted_duration';

import {PhaseStatus, RunPhase} from 'src/types/playbook_run';

interface Props {
    id?: string;
    phases: RunPhase[];
}

const PhaseTimeline = ({id, phases}: Props) => {
    const {formatMessage} = useIntl();
    const now = useNow(30000).valueOf();

    if (phases.length === 0) {
        return null;
    }

    // How long the phase has taken: from its start until now, or until it was done.
    const elapsed = (phase: RunPhase) => {
        if (!phase.started_at) {
            return null;
        }
        const millis = (phase.ended_at || now) - phase.started_at;
        return formatDuration(Duration.fromMillis(Math.max(0, millis)), 'narrow');
    };

    // A phase that has not started but is current is the one up next.
    const statusLabel = (phase: RunPhase) => {
        switch (phase.status) {
        case 'done':
            return formatMessage({defaultMessage: 'Done'});
        case 'blocked':
            return formatMessage({defaultMessage: 'Blocked'});
        case 'started':
            return formatMessage({defaultMessage: 'In progress'});
        case 'skipped':
            return formatMessage({defaultMessage: 'Skipped'});
        default:
            return phase.current ? formatMessage({defaultMessage: 'Up next'}) : formatMessage({defaultMessage: 'Not started'});
        }
    };

    const tooltip = (phase: RunPhase) => {
        const label = statusLabel(phase);
        if (phase.tasks_open > 0 && (phase.status === 'started' || phase.status === 'blocked')) {
            return formatMessage({defaultMessage: '{status}, {open} of {total} tasks open'}, {status: label, open: phase.tasks_open, total: phase.tasks_total});
        }
        return label;
    };

    const ariaLabel = (phase: RunPhase) => {
        const label = formatMessage({defaultMessage: '{phase}: {status}'}, {phase: phase.title, status: statusLabel(phase)});
        if (phase.current && phase.status !== 'not_started') {
            return formatMessage({defaultMessage: '{label}, current phase'}, {label});
        }
        return label;
    };

    return (
        <Container
            id={id}
            data-testid='phase-timeline'
        >
            <Steps role='list'>
                {phases.map((phase, i) => (
                    <Step
                        // eslint-disable-next-line react/no-array-index-key
                        key={phase.checklist_id || i}
                        role='listitem'
                        aria-label={ariaLabel(phase)}
                        data-status={phase.status}
                        data-current={phase.current}
                    >
                        {i > 0 && (
                            <Connector $done={phases[i - 1].status === 'done'}/>
                        )}
                        <Marker
                            $status={phase.status}
                            $current={phase.current}
                            title={tooltip(phase)}
                        >
                            {phase.status === 'done' && <CheckIcon/>}
                            {phase.status === 'blocked' && <BangIcon/>}
                            {phase.status === 'skipped' && <SkipIcon/>}
                            {(phase.status === 'started' || phase.status === 'not_started') && phase.current && <Dot/>}
                        </Marker>
                        <Label
                            $status={phase.status}
                            $current={phase.current}
                        >
                            {phase.title}
                        </Label>
                        <Time>{elapsed(phase)}</Time>
                    </Step>
                ))}
            </Steps>
        </Container>
    );
};

const CheckIcon = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 14 14'
        fill='none'
        aria-hidden={true}
    >
        <path
            d='M3 7.5l2.5 2.5L11 4.5'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const BangIcon = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 14 14'
        fill='none'
        aria-hidden={true}
    >
        <path
            d='M7 3v5'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
        />
        <circle
            cx='7'
            cy='10.8'
            r='1.1'
            fill='currentColor'
        />
    </svg>
);

const SkipIcon = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 14 14'
        fill='none'
        aria-hidden={true}
    >
        <path
            d='M4 7h6'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
        />
    </svg>
);

const GREEN = 'var(--online-indicator)';
const BLUE = 'var(--button-bg)';
const RED = 'var(--dnd-indicator)';
const GRAY = 'rgba(var(--center-channel-color-rgb), 0.24)';

const markerColor = (status: PhaseStatus, current: boolean) => {
    switch (status) {
    case 'done':
        return GREEN;
    case 'started':
        return BLUE;
    case 'blocked':
        return RED;
    default:
        return current ? BLUE : GRAY;
    }
};

const Container = styled.div`
    margin: 24px 0;
    padding: 20px 24px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    background: var(--center-channel-bg);
    box-shadow: 0 2px 3px rgba(var(--center-channel-color-rgb), 0.08);
`;

const Steps = styled.div`
    display: flex;
    overflow-x: auto;
`;

const Step = styled.div`
    position: relative;
    display: flex;
    flex: 1 0 96px;
    flex-direction: column;
    align-items: center;
`;

const Connector = styled.div<{$done: boolean}>`
    position: absolute;
    top: 11px;
    right: 50%;
    left: -50%;
    height: 2px;
    background: ${({$done}) => ($done ? GREEN : 'rgba(var(--center-channel-color-rgb), 0.16)')};
`;

const Marker = styled.div<{$status: PhaseStatus, $current: boolean}>`
    position: relative;
    z-index: 1;
    display: flex;
    width: 24px;
    height: 24px;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    border: 2px solid ${({$status, $current}) => markerColor($status, $current)};
    border-radius: 50%;
    background: var(--center-channel-bg);
    color: var(--button-color);

    ${({$status, $current}) => ($status === 'done' || $status === 'blocked') && css`
        background: ${markerColor($status, $current)};
    `}

    /* Started, but the run has moved on: a ring with a faint fill, so it differs by shape and not only hue. */
    ${({$status, $current}) => $status === 'started' && !$current && css`
        background: rgba(var(--button-bg-rgb), 0.16);
    `}

    /* Skipped: a dashed ring, clearly not finished work. */
    ${({$status}) => $status === 'skipped' && css`
        border-style: dashed;
        border-color: rgba(var(--center-channel-color-rgb), 0.4);
        color: rgba(var(--center-channel-color-rgb), 0.56);
    `}
`;

const Dot = styled.div`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${BLUE};
`;

const Label = styled.div<{$status: PhaseStatus, $current: boolean}>`
    margin-top: 8px;
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: ${({$status, $current}) => ($current || $status === 'done' || $status === 'blocked' ? 600 : 400)};
    text-align: center;

    ${({$status, $current}) => $status === 'not_started' && !$current && css`
        color: rgba(var(--center-channel-color-rgb), 0.72);
    `}
    ${({$status}) => $status === 'skipped' && css`
        color: rgba(var(--center-channel-color-rgb), 0.56);
    `}
    ${({$status, $current}) => ($status === 'started' || $status === 'not_started') && $current && css`
        color: ${BLUE};
    `}
    ${({$status}) => $status === 'blocked' && css`
        color: ${RED};
    `}
`;

const Time = styled.div`
    min-height: 16px;
    margin-top: 2px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
`;

export default PhaseTimeline;
