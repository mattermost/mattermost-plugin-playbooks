// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {getUser as getUserAction} from 'mattermost-redux/actions/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {useNow} from 'src/hooks';
import {useAppDispatch, useAppSelector} from 'src/hooks/redux';
import {formatRoundedDuration} from 'src/components/formatted_duration';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {PrimaryButton} from 'src/components/assets/buttons';

import {PhaseOverride, PhaseStatus, RunPhase} from 'src/types/playbook_run';

interface Props {
    id?: string;
    phases: RunPhase[];

    /** Set once a person took over the current phase. */
    override?: PhaseOverride;

    /** Present when the viewer may take over the current phase. */
    onSetPhase?: (checklistId: string) => void;
}

const ONE_MINUTE = 60 * 1000;

const PhaseTimeline = ({id, phases, override, onSetPhase}: Props) => {
    const {formatMessage, formatTime} = useIntl();
    const dispatch = useAppDispatch();

    // Only a time that is still running changes. Under a minute it ticks in seconds, so refresh every
    // second; beyond that it changes by the minute and every few seconds is plenty. With nothing
    // running, such as a finished run, there is nothing to refresh.
    const wallNow = Date.now();
    const running = phases.filter((phase) => phase.started_at && !phase.ended_at);
    const underAMinute = running.some((phase) => wallNow - phase.started_at < ONE_MINUTE) || Boolean(override && wallNow - override.set_at < ONE_MINUTE);
    let refreshInterval: number | null = null;
    if (running.length > 0) {
        refreshInterval = underAMinute ? 1000 : 5000;
    }
    const now = useNow(refreshInterval).valueOf();
    const [pending, setPending] = useState<RunPhase | null>(null);
    const setBy = useAppSelector((state) => (override ? getUser(state, override.set_by) : undefined));

    useEffect(() => {
        if (override?.set_by && !setBy) {
            dispatch(getUserAction(override.set_by));
        }
    }, [dispatch, override?.set_by, setBy]);

    if (phases.length === 0) {
        return null;
    }

    // How long the phase has taken: from its start until now, or until it was done.
    const elapsed = (phase: RunPhase) => {
        if (phase.status === 'skipped' || !phase.started_at || phase.ended_at === phase.started_at) {
            return null;
        }
        return formatRoundedDuration((phase.ended_at || now) - phase.started_at);
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

    const currentIndex = phases.findIndex((phase) => phase.current);
    const current = currentIndex >= 0 ? phases[currentIndex] : undefined;
    const next = currentIndex >= 0 ? phases[currentIndex + 1] : undefined;

    // The first takeover is permanent, so it is confirmed; moving a phase that is already manual is not.
    const moveToNext = () => {
        if (!onSetPhase || !next) {
            return;
        }
        if (override) {
            onSetPhase(next.checklist_id);
            return;
        }
        setPending(next);
    };

    // How long the current phase has been going and, once a person took over, who set it and when.
    const currentDetail = () => {
        if (!current) {
            return '';
        }

        const duration = elapsed(current);
        const name = setBy ? `@${setBy.username}` : '';
        const time = override ? formatTime(override.set_at) : '';
        if (duration && override) {
            return formatMessage({defaultMessage: 'for {duration}, set by {name} at {time}'}, {duration, name, time});
        }
        if (override) {
            return formatMessage({defaultMessage: 'set by {name} at {time}'}, {name, time});
        }
        if (!duration) {
            return '';
        }
        if (currentIndex === 0) {
            return formatMessage({defaultMessage: 'for {duration}, started with the run'}, {duration});
        }
        return formatMessage({defaultMessage: 'for {duration}, moved automatically'}, {duration});
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
            {current && (
                <Header>
                    <Summary>
                        <HeaderLabel>{formatMessage({defaultMessage: 'Phase'})}</HeaderLabel>
                        <Chip data-testid='phase-timeline-current'>{current.title}</Chip>
                        <Detail data-testid='phase-timeline-detail'>{currentDetail()}</Detail>
                    </Summary>
                    {onSetPhase && next && (
                        <PrimaryButton
                            size='sm'
                            onClick={moveToNext}
                            data-testid='phase-timeline-next'
                        >
                            {formatMessage({defaultMessage: 'Move to {phase}'}, {phase: next.title})}
                            <i className='icon icon-arrow-right'/>
                        </PrimaryButton>
                    )}
                </Header>
            )}
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
                            <Connector $color={connectorColor(phases[i - 1])}/>
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
            <ConfirmModal
                show={pending !== null}
                title={formatMessage({defaultMessage: 'Set the current phase manually?'})}
                message={formatMessage(
                    {defaultMessage: 'Phases will no longer move on their own for this run. From now on, only the run owner or a playbook admin can move it to another phase. Set the current phase to "{phase}"?'},
                    {phase: pending?.title ?? ''},
                )}
                confirmButtonText={formatMessage({defaultMessage: 'Set current phase'})}
                onConfirm={() => {
                    if (pending) {
                        onSetPhase?.(pending.checklist_id);
                    }
                    setPending(null);
                }}
                onCancel={() => setPending(null)}
            />
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
const GRAY_LINE = 'rgba(var(--center-channel-color-rgb), 0.16)';

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

const connectorColor = (previous: RunPhase) => {
    if (previous.status === 'done') {
        return GREEN;
    }

    // Started but the run moved on: the line carries the ring's color.
    if (previous.status === 'started' && !previous.current) {
        return BLUE;
    }
    return GRAY_LINE;
};

const Connector = styled.div<{$color: string}>`
    position: absolute;
    top: 11px;
    right: 50%;
    left: -50%;
    height: 2px;
    background: ${({$color}) => $color};
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
        background: linear-gradient(rgba(var(--button-bg-rgb), 0.16), rgba(var(--button-bg-rgb), 0.16)), var(--center-channel-bg);
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

const Header = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    gap: 12px;
`;

const Summary = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
`;

const HeaderLabel = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
`;

const Chip = styled.span`
    padding: 4px 12px;
    border: 1px solid rgba(var(--button-bg-rgb), 0.24);
    border-radius: 4px;
    background: rgba(var(--button-bg-rgb), 0.08);
    color: var(--button-bg);
    font-size: 14px;
    font-weight: 600;
`;

const Detail = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
`;

const Time = styled.div`
    min-height: 16px;
    margin-top: 2px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
`;

export default PhaseTimeline;
