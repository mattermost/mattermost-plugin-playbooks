// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {Duration} from 'luxon';

import {useEnsureProfiles, useFormattedUsernames, useNow} from 'src/hooks';
import {formatDuration} from 'src/components/formatted_duration';
import {ChecklistItemState, ChecklistItem as ChecklistItemType} from 'src/types/playbook';

import {liveMillis, useRunTimingContext} from './run_timing_context';

interface Props {
    item: ChecklistItemType;
}

const humanize = (millis: number) => formatDuration(Duration.fromMillis(millis), 'narrow', 'truncate');

const NO_USERS: string[] = [];

const TaskTiming = ({item}: Props) => {
    const {formatMessage} = useIntl();
    const now = useNow(30000).valueOf();
    const context = useRunTimingContext();
    const isBlocked = item.state === ChecklistItemState.Blocked;
    const isInProgress = item.state === ChecklistItemState.InProgress;
    const timing = item.id ? context?.itemsByID.get(item.id) : undefined;
    const blockedByIds = (isBlocked && item.blocked_by_user_ids) || NO_USERS;
    useEnsureProfiles(blockedByIds);
    const blockedByNames = useFormattedUsernames(blockedByIds);

    if (!isBlocked && !isInProgress && !timing) {
        return null;
    }

    let blockedLabel = formatMessage({defaultMessage: 'Blocked'});
    if (blockedByNames.length > 0) {
        blockedLabel = formatMessage({defaultMessage: 'Blocked by {names}'}, {names: blockedByNames.map((name) => '@' + name).join(', ')});
    }
    if (item.blocked_reason) {
        blockedLabel = formatMessage({defaultMessage: '{label}: {reason}'}, {label: blockedLabel, reason: item.blocked_reason});
    }

    const parts: string[] = [];
    if (timing && context) {
        const stillRunning = !context.runEnded;
        if (timing.started_at && timing.finished_at) {
            parts.push(formatMessage({defaultMessage: 'Took {duration}'}, {duration: humanize(timing.finished_at - timing.started_at)}));
        } else if (timing.started_at && !timing.finished_at && stillRunning) {
            parts.push(formatMessage({defaultMessage: 'Started {duration} ago'}, {duration: humanize(now - timing.started_at)}));
        }

        const blockedMillis = liveMillis(timing.blocked_millis, Boolean(timing.blocked_since) && stillRunning, context.timing.computed_at, now);
        if (blockedMillis > 0) {
            parts.push(formatMessage(
                {defaultMessage: 'Blocked {count, plural, one {once} other {# times}}, {duration} in total'},
                {count: timing.block_count || 1, duration: humanize(blockedMillis)},
            ));
        }
        if (timing.reopened) {
            parts.push(formatMessage({defaultMessage: 'Reopened'}));
        }
    }

    return (
        <Container data-testid='task-timing'>
            {isInProgress && (
                <InProgressBadge data-testid='task-in-progress'>
                    <i className='icon-play-outline icon-12'/>
                    <span>{formatMessage({defaultMessage: 'In progress'})}</span>
                </InProgressBadge>
            )}
            {isBlocked && (
                <BlockedBadge data-testid='task-blocked-reason'>
                    <i className='icon-alert-outline icon-12'/>
                    <span>{blockedLabel}</span>
                </BlockedBadge>
            )}
            {parts.length > 0 && <Meta>{parts.join(' · ')}</Meta>}
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 4px 0 0 36px;
`;

const BlockedBadge = styled.div`
    display: inline-flex;
    align-self: flex-start;
    align-items: flex-start;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(var(--dnd-indicator-rgb), 0.12);
    color: var(--center-channel-color);
    font-size: 12px;
    line-height: 16px;
    overflow-wrap: anywhere;

    i {
        color: var(--dnd-indicator);
    }
`;

const InProgressBadge = styled(BlockedBadge)`
    background: rgba(var(--button-bg-rgb), 0.08);

    i {
        color: var(--button-bg);
    }
`;

const Meta = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    line-height: 16px;
`;

export default TaskTiming;
