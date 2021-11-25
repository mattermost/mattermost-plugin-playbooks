// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';
import {Team} from 'mattermost-redux/types/teams';
import {useIntl} from 'react-intl';

import {DateTime} from 'luxon';

import {TimelineEvent, TimelineEventType} from 'src/types/rhs';
import {isMobile} from 'src/mobile';
import {toggleRHS} from 'src/actions';
import {ChannelNamesMap} from 'src/types/backstage';
import {messageHtmlToComponent, formatText, browserHistory, Timestamp} from 'src/webapp_globals';
import {formatDuration} from 'src/components/formatted_duration';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';

const Circle = styled.div`
    position: absolute;
    width: 24px;
    height: 24px;
    color: var(--button-bg);
    background: #EFF1F5;
    border-radius: 50%;
    left: 86px;

    > .icon {
        font-size: 14px;
        margin: 5px 0 0 2px;
    }
`;

const TimelineItem = styled.li`
    position: relative;
    margin: 20px 0 0 0;
`;

const TimeContainer = styled.div`
    position: absolute;
    width: 75px;
    line-height: 16px;
    text-align: right;
    left: 4px;
`;

const TimeHours = styled.div`
    font-size: 12px;
    font-weight: 600;
    margin: 0 0 4px 0;
`;

const TimeDay = styled.div`
    font-size: 10px;
`;

const SummaryContainer = styled.div`
    position: relative;
    margin: 0 0 0 120px;
    padding: 0 5px 0 0;
    line-height: 16px;
    min-height: 36px;
`;

const SummaryTitle = styled.div<{deleted: boolean}>`
    font-size: 12px;
    font-weight: 600;

    ${({deleted}) => (deleted ? css`
        text-decoration: line-through;
    ` : css`
        :hover {
            cursor: pointer;
        }
    `)}

`;

const SummaryDeleted = styled.span`
    font-size: 10px;
    margin-top: 3px;
    display: inline-block;
`;

const SummaryDetail = styled.div`
    font-size: 11px;
    margin: 4px 0 0 0;
    color: rgba(var(--center-channel-color-rgb), 0.64)
`;

interface Props {
    event: TimelineEvent;
    reportedAt: DateTime;
    channelNames: ChannelNamesMap;
    team: Team;
    deleteEvent: () => void;
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
    const diff = DateTime.fromMillis(props.event.event_at).diff(props.reportedAt);
    let stamp = formatDuration(diff);
    if (diff.toMillis() < 0) {
        stamp = '-' + formatDuration(diff.negate());
    }
    let timeSince: JSX.Element | null = <TimeDay>{formatMessage({defaultMessage: 'Time: {time}'}, {time: stamp})}</TimeDay>;

    switch (props.event.event_type) {
    case TimelineEventType.RunCreated:
        iconClass = 'icon icon-shield-alert-outline';
        summaryTitle = formatMessage({defaultMessage: 'Run started by {name}'}, {name: props.event.subject_display_name});
        timeSince = null;
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
    }

    return (
        <TimelineItem
            data-testid={'timeline-item ' + testid}
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
        >
            <TimeContainer>
                <TimeHours>
                    <Timestamp
                        value={props.event.event_at}
                        month='short'
                    />
                </TimeHours>
                {timeSince}
            </TimeContainer>
            <Circle>
                <i className={iconClass}/>
            </Circle>
            <SummaryContainer>
                <SummaryTitle
                    onClick={(e) => !statusPostDeleted && goToPost(e, props.event.post_id)}
                    deleted={statusPostDeleted}
                >
                    {summaryTitle}
                </SummaryTitle>
                {statusPostDeleted && (
                    <SummaryDeleted>
                        {formatMessage({defaultMessage: 'Status post deleted: '})}
                        <Timestamp
                            value={props.event.status_delete_at}
                            // eslint-disable-next-line no-undefined
                            useDate={{...DateTime.DATE_MED, year: undefined}}
                            useTime={DateTime.TIME_24_SIMPLE}
                        />
                    </SummaryDeleted>
                )}
                <SummaryDetail>{messageHtmlToComponent(formatText(summary, markdownOptions), true, {})}</SummaryDetail>
            </SummaryContainer>
            {showMenu &&
            <HoverMenu>
                <HoverMenuButton
                    className={'icon-trash-can-outline icon-16 btn-icon'}
                    onClick={() => {
                        setShowDeleteConfirm(true);
                    }}
                />
            </HoverMenu>
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
        </TimelineItem>
    );
};

export default TimelineEventItem;
