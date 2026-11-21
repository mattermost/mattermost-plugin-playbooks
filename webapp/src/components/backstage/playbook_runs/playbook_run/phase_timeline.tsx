// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {PhaseStatus, RunPhase} from 'src/types/playbook_run';

interface Props {
    id?: string;
    phases: RunPhase[];
}

const PhaseTimeline = ({id, phases}: Props) => {
    const {formatMessage, formatTime} = useIntl();

    if (phases.length === 0) {
        return null;
    }

    const statusLabel = (status: PhaseStatus) => {
        switch (status) {
        case 'done':
            return formatMessage({defaultMessage: 'Done'});
        case 'blocked':
            return formatMessage({defaultMessage: 'Blocked'});
        case 'started':
            return formatMessage({defaultMessage: 'In progress'});
        default:
            return formatMessage({defaultMessage: 'Not started'});
        }
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
                        key={i}
                        role='listitem'
                        aria-label={formatMessage({defaultMessage: '{phase}: {status}'}, {phase: phase.title, status: statusLabel(phase.status)})}
                        data-status={phase.status}
                    >
                        {i > 0 && (
                            <Connector $done={phases[i - 1].status === 'done'}/>
                        )}
                        <Marker
                            $status={phase.status}
                            title={statusLabel(phase.status)}
                        >
                            {phase.status === 'done' && <CheckIcon/>}
                            {phase.status === 'started' && <Dot/>}
                            {phase.status === 'blocked' && <BangIcon/>}
                        </Marker>
                        <Label $status={phase.status}>{phase.title}</Label>
                        <Time>{phase.timestamp ? formatTime(phase.timestamp, {hour: '2-digit', minute: '2-digit'}) : null}</Time>
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
            stroke='#fff'
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
            stroke='#fff'
            strokeWidth='2'
            strokeLinecap='round'
        />
        <circle
            cx='7'
            cy='10.8'
            r='1.1'
            fill='#fff'
        />
    </svg>
);

const GREEN = 'var(--online-indicator, #06d6a0)';
const BLUE = 'var(--button-bg, #1c58d9)';
const RED = 'var(--dnd-indicator, #d24b4e)';
const GRAY = 'rgba(var(--center-channel-color-rgb), 0.24)';

const markerColor = (status: PhaseStatus) => {
    switch (status) {
    case 'done':
        return GREEN;
    case 'started':
        return BLUE;
    case 'blocked':
        return RED;
    default:
        return GRAY;
    }
};

const Container = styled.div`
    margin: 24px 0;
    padding: 20px 24px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    background: var(--center-channel-bg);
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.08);
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

const Marker = styled.div<{$status: PhaseStatus}>`
    position: relative;
    z-index: 1;
    display: flex;
    width: 24px;
    height: 24px;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    border: 2px solid ${({$status}) => markerColor($status)};
    border-radius: 50%;
    background: var(--center-channel-bg);

    ${({$status}) => ($status === 'done' || $status === 'blocked') && css`
        background: ${markerColor($status)};
    `}
`;

const Dot = styled.div`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${BLUE};
`;

const Label = styled.div<{$status: PhaseStatus}>`
    margin-top: 8px;
    color: ${({$status}) => ($status === 'not_started' ? 'rgba(var(--center-channel-color-rgb), 0.72)' : 'var(--center-channel-color)')};
    font-size: 14px;
    font-weight: ${({$status}) => ($status === 'not_started' ? 400 : 600)};
    text-align: center;

    ${({$status}) => $status === 'blocked' && css`
        color: ${RED};
    `}
    ${({$status}) => $status === 'started' && css`
        color: ${BLUE};
    `}
`;

const Time = styled.div`
    min-height: 16px;
    margin-top: 2px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
`;

export default PhaseTimeline;
