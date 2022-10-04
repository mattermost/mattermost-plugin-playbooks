// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode, useState} from 'react';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';
import {Team} from '@mattermost/types/teams';
import {useIntl} from 'react-intl';

import {DateTime} from 'luxon';

import {ClockOutlineIcon} from '@mattermost/compass-icons/components';

import {TimelineEvent, TimelineEventType} from 'src/types/rhs';
import {isMobile} from 'src/mobile';
import {toggleRHS} from 'src/actions';
import {ChannelNamesMap} from 'src/types/backstage';
import {messageHtmlToComponent, formatText, browserHistory} from 'src/webapp_globals';
import FormattedDuration, {formatDuration} from 'src/components/formatted_duration';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import Tooltip from 'src/components/widgets/tooltip';

const Circle = styled.div`
    position: absolute;
    width: 24px;
    height: 24px;
    color: var(--button-bg);
    background: #EFF1F5;
    border-radius: 50%;
    left: 21px;
    top: 5px;

    > .icon {
        font-size: 14px;
        margin: 5px 0 0 2px;
    }
`;

const TimelineItem = styled.li`
    position: relative;
    margin: 27px 0 0 0;
`;

const TimeContainer = styled.div<{parent: 'rhs'|'retro'}>`
    position: absolute;
    width: 75px;
    line-height: 16px;
    text-align: left;
    left: 4px;
    bottom: ${({parent}) => (parent === 'rhs' ? '-28px' : 'auto')};
`;

const TimeStamp = styled.time`
    font-size: 11px;
    margin: 0px;
    line-height: 1;
    font-weight: 500;
    svg {
        vertical-align: middle;
        margin: 0px 3px;
        position: relative;
        top: -1px;
    }
`;

const TimeSinceStart = styled.span`
    font-size: 11px;
    display: inline-block;
    white-space: nowrap;
    border: 1px solid #EFF1F5;
    padding: 0.1rem .25rem;
    border-radius: 5px;
    margin-left: 1rem;
`;

const TimeBetween = styled.div`
    font-size: 10px;
    position: absolute;
    top: -23px;
    left: -10px;
    white-space: nowrap;
    text-align: right;
    width: 3rem;


    &::after {
        content: '';
        background: #EFF1F5;
        width: 7px;
        height: 7px;
        position: absolute;
        top: 5px;
        right: -12px;
        border-radius: 50%;
    }
`;

const SummaryContainer = styled.div`
    position: relative;
    padding: 0 5px 0 55px;
    line-height: 16px;
    min-height: 36px;
`;

const SummaryTitle = styled.div<{deleted: boolean, postIdExists: boolean}>`
    font-size: 12px;
    font-weight: 600;

    ${({deleted, postIdExists}) => (deleted ? css`
        text-decoration: line-through;
    ` : (postIdExists && css`
        :hover {
            cursor: pointer;
        }
    `))}

`;

const SummaryDeleted = styled.span`
    font-size: 10px;
    margin-top: 3px;
    display: inline-block;
`;

const SummaryDetail = styled.div`
    font-size: 11px;
    margin: 4px 0 0 0;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const StyledHoverMenu = styled(HoverMenu)<{parent: 'rhs'|'retro'}>`
    right: ${({parent}) => (parent === 'rhs' ? '20px' : '0')};
`;

const DATETIME_FORMAT = {
    ...DateTime.DATE_MED,
    ...DateTime.TIME_24_WITH_SHORT_OFFSET,
};

interface Props {
    event: TimelineEvent;
    prevEventAt?: DateTime;
    parent: 'rhs' | 'retro';
    runCreateAt: DateTime;
    channelNames: ChannelNamesMap;
    team: Team;
    deleteEvent: () => void;
    editable: boolean;
}

const TimelineEventItem = (props: Props) => {
    const dispatch = useDispatch();
    const [showMenu, setShowMenu] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const markdownOptions = {
        atMentions: true,
        team: props.team,
        channelNamesMap: props.channelNames,
    };
    const statusPostDeleted =
        props.event.event_type === TimelineEventType.StatusUpdated &&
        props.event.status_delete_at !== 0;

    const goToPost = (e: React.MouseEvent<Element, MouseEvent>, postId?: string) => {
        e.preventDefault();
        if (!postId) {
            return;
        }

        browserHistory.push(`/${props.team.name}/pl/${postId}`);

        if (isMobile()) {
            dispatch(toggleRHS());
        }
    };
    const {formatMessage} = useIntl();

    let iconClass = '';
    let summaryTitle = '';
    let summary = '';
    let testid = '';

    const eventTime = DateTime.fromMillis(props.event.event_at);
    const diff = DateTime.fromMillis(props.event.event_at).diff(props.runCreateAt);
    let timeSinceStart: ReactNode = formatMessage({defaultMessage: '{duration} after run started'}, {duration: formatDuration(diff)});
    if (diff.toMillis() < 0) {
        timeSinceStart = formatMessage({defaultMessage: '{duration} before run started'}, {duration: formatDuration(diff.negate())});
    }
    const timeSincePrevEvent: ReactNode = props.prevEventAt && (
        <TimeBetween>
            <FormattedDuration
                from={props.prevEventAt}
                to={props.event.event_at}
                truncate={'truncate'}
            />
        </TimeBetween>
    );

    switch (props.event.event_type) {
    case TimelineEventType.RunCreated:
        iconClass = 'icon icon-shield-alert-outline';
        summaryTitle = formatMessage({defaultMessage: 'Run started by {name}'}, {name: props.event.subject_display_name});
        timeSinceStart = null;
        testid = TimelineEventType.RunCreated;
        break;
    case TimelineEventType.RunFinished:
        iconClass = 'icon icon-shield-alert-outline';
        summaryTitle = formatMessage({defaultMessage: 'Run finished by {name}'}, {name: props.event.subject_display_name});
        testid = TimelineEventType.RunFinished;
        break;
    case TimelineEventType.RunRestored:
        iconClass = 'icon icon-shield-alert-outline';
        summaryTitle = formatMessage({defaultMessage: 'Run restored by {name}'}, {name: props.event.subject_display_name});
        testid = TimelineEventType.RunRestored;
        break;
    case TimelineEventType.StatusUpdated:
        iconClass = 'icon icon-flag-outline';
        if (props.event.summary === '') {
            summaryTitle = formatMessage({defaultMessage: '{name} posted a status update'}, {name: props.event.subject_display_name});
        } else {
            summaryTitle = formatMessage({defaultMessage: '{name} changed status from {summary}'}, {name: props.event.subject_display_name, summary: props.event.summary});
        }
        testid = TimelineEventType.StatusUpdated;
        break;
    case TimelineEventType.StatusUpdateSnoozed:
        iconClass = 'icon icon-flag-outline';
        summaryTitle = formatMessage({defaultMessage: '{name} snoozed a status update'}, {name: props.event.subject_display_name});
        testid = TimelineEventType.StatusUpdateSnoozed;
        break;
    case TimelineEventType.StatusUpdateRequested:
        iconClass = 'icon icon-update';
        summaryTitle = props.event.summary;
        testid = TimelineEventType.StatusUpdateRequested;
        break;
    case TimelineEventType.OwnerChanged:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = formatMessage({defaultMessage: 'Owner changed from {summary}'}, {summary: props.event.summary});
        testid = TimelineEventType.OwnerChanged;
        break;
    case TimelineEventType.TaskStateModified:
        iconClass = 'icon icon-format-list-bulleted';
        summaryTitle = props.event.subject_display_name + ' ' + props.event.summary;
        summaryTitle = summaryTitle.replace(/\*\*/g, '"');
        testid = TimelineEventType.TaskStateModified;
        break;
    case TimelineEventType.AssigneeChanged:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = formatMessage({defaultMessage: 'Assignee Changed'});
        summary = props.event.subject_display_name + ' ' + props.event.summary;
        testid = TimelineEventType.AssigneeChanged;
        break;
    case TimelineEventType.RanSlashCommand:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = formatMessage({defaultMessage: 'Slash Command Executed'});
        summary = props.event.subject_display_name + ' ' + props.event.summary;
        testid = TimelineEventType.RanSlashCommand;
        break;
    case TimelineEventType.EventFromPost:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = props.event.summary;
        testid = TimelineEventType.EventFromPost;
        break;
    case TimelineEventType.UserJoinedLeft:
        iconClass = 'icon icon-account-outline';
        summaryTitle = JSON.parse(props.event.details).title;
        summary = props.event.summary;
        testid = TimelineEventType.UserJoinedLeft;
        break;
    case TimelineEventType.PublishedRetrospective:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = formatMessage({defaultMessage: 'Retrospective published by {name}'}, {name: props.event.subject_display_name});
        testid = TimelineEventType.PublishedRetrospective;
        break;
    case TimelineEventType.CanceledRetrospective:
        iconClass = 'icon icon-cancel';
        summaryTitle = formatMessage({defaultMessage: 'Retrospective canceled by {name}'}, {name: props.event.subject_display_name});
        testid = TimelineEventType.CanceledRetrospective;
        break;
    case TimelineEventType.StatusUpdateEnabled:
        iconClass = 'icon icon-flag-outline';
        summaryTitle = formatMessage({defaultMessage: 'Run status updates enabled by {name}'}, {name: props.event.subject_display_name});
        testid = TimelineEventType.StatusUpdateEnabled;
        break;
    case TimelineEventType.StatusUpdateDisabled:
        iconClass = 'icon icon-flag-outline';
        summaryTitle = formatMessage({defaultMessage: 'Run status updates disabled by {name}'}, {name: props.event.subject_display_name});
        testid = TimelineEventType.StatusUpdateDisabled;
        break;
    }

    return (
        <TimelineItem
            data-testid={'timeline-item ' + testid}
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
        >
            {props.parent === 'retro' ? (
                <TimeContainer parent={props.parent}>
                    {timeSincePrevEvent}
                </TimeContainer>
            ) : null}
            <Circle>
                <i className={iconClass}/>
            </Circle>

            <SummaryContainer>
                <TimeStamp dateTime={eventTime.setZone('Etc/UTC').toISO()}>
                    {eventTime.setZone('Etc/UTC').toLocaleString(DATETIME_FORMAT)}
                    <Tooltip
                        id={`timeline-${props.event.id}`}
                        content={(
                            <>
                                {eventTime.toLocaleString(DATETIME_FORMAT)}
                                <br/>
                                {timeSinceStart}
                            </>
                        )}
                    >
                        <ClockOutlineIcon size={12}/>
                    </Tooltip>
                </TimeStamp>
                <SummaryTitle
                    onClick={(e) => props.editable && !statusPostDeleted && goToPost(e, props.event.post_id)}
                    deleted={statusPostDeleted}
                    postIdExists={props.event.post_id !== '' && props.editable}
                >
                    {summaryTitle}
                </SummaryTitle>
                {statusPostDeleted && (
                    <SummaryDeleted>
                        {formatMessage({defaultMessage: 'Deleted: {timestamp}'}, {
                            timestamp: DateTime.fromMillis(props.event.status_delete_at!)
                                .setZone('Etc/UTC')
                                .toLocaleString(DATETIME_FORMAT),
                        })}
                    </SummaryDeleted>
                )}
                <SummaryDetail>{messageHtmlToComponent(formatText(summary, markdownOptions), true, {})}</SummaryDetail>
            </SummaryContainer>
            {showMenu && props.editable &&
                <StyledHoverMenu parent={props.parent}>
                    <HoverMenuButton
                        className={'icon-trash-can-outline icon-16 btn-icon'}
                        onClick={() => {
                            setShowDeleteConfirm(true);
                        }}
                    />
                </StyledHoverMenu>
            }
            <ConfirmModal
                show={showDeleteConfirm}
                title={formatMessage({defaultMessage: 'Confirm Entry Delete'})}
                message={formatMessage({defaultMessage: 'Are you sure you want to delete this event? Deleted events will be permanently removed from the timeline.'})}
                confirmButtonText={formatMessage({defaultMessage: 'Delete Entry'})}
                onConfirm={() => {
                    props.deleteEvent();
                    setShowDeleteConfirm(false);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
            {props.parent === 'rhs' ? (
                <TimeContainer parent={props.parent}>
                    {timeSincePrevEvent}
                </TimeContainer>
            ) : null}
        </TimelineItem>
    );
};

export default TimelineEventItem;
