// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode, useState} from 'react';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';
import {Team} from 'mattermost-redux/types/teams';
import {useIntl, FormattedMessage} from 'react-intl';

import {DateTime} from 'luxon';

import {TimelineEvent, TimelineEventType} from 'src/types/rhs';
import {isMobile} from 'src/mobile';
import {useNow} from 'src/hooks';
import {toggleRHS} from 'src/actions';
import {messageHtmlToComponent, formatText, browserHistory} from 'src/webapp_globals';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {ChannelNamesMap} from 'src/types/backstage';

const DATETIME_FORMAT = {
    ...DateTime.DATE_MED,
    ...DateTime.TIME_24_WITH_SHORT_OFFSET,
};

const useEvent = (event: TimelineEvent) => {
    let iconClass: string;
    let title: ReactNode;
    let subtitle: ReactNode;
    let testid: string;
    switch (event.event_type) {
    case TimelineEventType.RunCreated:
        iconClass = 'icon icon-shield-alert-outline';
        title = <FormattedMessage defaultMessage={'Run started'}/>;
        subtitle = (
            <FormattedMessage
                defaultMessage={'{name} started a run'}
                values={{name: event.subject_display_name}}
            />
        );
        testid = TimelineEventType.RunCreated;
        break;
    case TimelineEventType.RunFinished:
        iconClass = 'icon icon-shield-alert-outline';
        title = (
            <FormattedMessage
                defaultMessage={'Run finished by {name}'}
                values={{name: event.subject_display_name}}
            />
        );
        testid = TimelineEventType.RunFinished;
        break;
    case TimelineEventType.RunRestored:
        iconClass = 'icon icon-shield-alert-outline';
        title = (
            <FormattedMessage
                defaultMessage={'Run restored by {name}'}
                values={{name: event.subject_display_name}}
            />
        );
        testid = TimelineEventType.RunRestored;
        break;
    case TimelineEventType.StatusUpdated:
        iconClass = 'icon icon-flag-outline';
        if (event.summary === '') {
            title = (
                <FormattedMessage
                    defaultMessage={'{name} posted a status update'}
                    values={{name: event.subject_display_name}}
                />
            );
        } else {
            title = (
                <FormattedMessage
                    defaultMessage={'{name} changed status from {summary}'}
                    values={{name: event.subject_display_name, summary: event.summary}}
                />
            );
        }
        testid = TimelineEventType.StatusUpdated;
        break;
    case TimelineEventType.OwnerChanged:
        iconClass = 'icon icon-pencil-outline';
        title = (
            <FormattedMessage
                defaultMessage={'Owner changed from {summary}'}
                values={{summary: event.summary}}
            />
        );
        testid = TimelineEventType.OwnerChanged;
        break;
    case TimelineEventType.TaskStateModified:
        iconClass = 'icon icon-format-list-bulleted';
        title = (event.subject_display_name + ' ' + event.summary); //TODO .replace(/\*\*/g, '"');
        testid = TimelineEventType.TaskStateModified;
        break;
    case TimelineEventType.AssigneeChanged:
        iconClass = 'icon icon-pencil-outline';
        title = <FormattedMessage defaultMessage={'Assignee Changed'}/>;
        subtitle = event.subject_display_name + ' ' + event.summary;
        testid = TimelineEventType.AssigneeChanged;
        break;
    case TimelineEventType.RanSlashCommand:
        iconClass = 'icon icon-pencil-outline';
        title = <FormattedMessage defaultMessage={'Slash Command Executed'}/>;
        subtitle = event.subject_display_name + ' ' + event.summary;
        testid = TimelineEventType.RanSlashCommand;
        break;
    case TimelineEventType.EventFromPost:
        iconClass = 'icon icon-pencil-outline';
        title = event.summary;
        testid = TimelineEventType.EventFromPost;
        break;
    case TimelineEventType.UserJoinedLeft:
        iconClass = 'icon icon-account-outline';
        title = JSON.parse(event.details).title;
        subtitle = event.summary;
        testid = TimelineEventType.UserJoinedLeft;
        break;
    case TimelineEventType.PublishedRetrospective:
        iconClass = 'icon icon-pencil-outline';
        title = (
            <FormattedMessage
                defaultMessage={'Retrospective published by {name}'}
                values={{name: event.subject_display_name}}
            />
        );
        testid = TimelineEventType.PublishedRetrospective;
        break;
    case TimelineEventType.CanceledRetrospective:
        iconClass = 'icon icon-cancel';
        title = (
            <FormattedMessage
                defaultMessage={'Retrospective canceled by {name}'}
                values={{name: event.subject_display_name}}
            />
        );
        testid = TimelineEventType.CanceledRetrospective;
        break;
    }
    return {iconClass, title, subtitle, testid};
};

interface Props {
    event: TimelineEvent;
    channelNames: ChannelNamesMap;
    team: Team;
    deleteEvent: () => void;
}

const TimelineEventItem = ({event, team, deleteEvent, channelNames}: Props) => {
    const dispatch = useDispatch();
    const [showMenu, setShowMenu] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const markdownOptions = {
        team,
        atMentions: true,
        channelNamesMap: channelNames,
    };
    const statusPostDeleted =
        event.event_type === TimelineEventType.StatusUpdated &&
        event.status_delete_at !== 0;

    const goToPost = (e: React.MouseEvent<Element, MouseEvent>, postId?: string) => {
        e.preventDefault();
        if (!postId) {
            return;
        }

        browserHistory.push(`/${team.name}/pl/${postId}`);

        if (isMobile()) {
            dispatch(toggleRHS());
        }
    };
    const {formatMessage} = useIntl();

    const {iconClass, title, subtitle, testid} = useEvent(event);

    const now = useNow();
    const eventTime = DateTime.fromMillis(event.event_at);
    const diff = DateTime.fromMillis(event.event_at).diff(now);

    return (
        <TimelineItem
            data-testid={'timeline-item ' + testid}
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
        >
            {/* <TimeContainer>
                {diff}
            </TimeContainer> */}
            <Circle>
                <i className={iconClass}/>
            </Circle>

            <SummaryContainer>
                {/* <TimeStamp dateTime={eventTime.setZone('Etc/UTC').toISO()}>
                    {eventTime.setZone('Etc/UTC').toLocaleString(DATETIME_FORMAT)}
                    <Tooltip
                        id={`timeline-${event.id}`}
                        content={eventTime.toLocaleString(DATETIME_FORMAT)}
                    >
                        <Icon
                            path={mdiClockOutline}
                            size={0.85}
                        />
                    </Tooltip>
                </TimeStamp> */}
                <SummaryTitle
                    onClick={(e) => !statusPostDeleted && goToPost(e, event.post_id)}
                    deleted={statusPostDeleted}
                    postIdExists={event.post_id !== ''}
                >
                    {title}
                </SummaryTitle>
                {statusPostDeleted && (
                    <SummaryDeleted>
                        {formatMessage({defaultMessage: 'Deleted: {timestamp}'}, {
                            timestamp: DateTime.fromMillis(event.status_delete_at!)
                                .setZone('Etc/UTC')
                                .toLocaleString(DATETIME_FORMAT),
                        })}
                    </SummaryDeleted>
                )}
                <SummaryDetail>{messageHtmlToComponent(formatText(/*subtitle*/ '', markdownOptions), true, {})}</SummaryDetail>
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
                    deleteEvent();
                    setShowDeleteConfirm(false);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </TimelineItem>
    );
};

export default TimelineEventItem;

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

const TimeContainer = styled.div`
    position: absolute;
    width: 75px;
    line-height: 16px;
    text-align: left;
    left: 4px;
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

// const TimeSinceStart = styled.span`
//     font-size: 11px;
//     display: inline-block;
//     white-space: nowrap;
//     border: 1px solid #EFF1F5;
//     padding: 0.1rem .25rem;
//     border-radius: 5px;
//     margin-left: 1rem;
// `;

// const TimeBetween = styled.div`
//     font-size: 10px;
//     position: absolute;
//     top: -23px;
//     left: -10px;
//     white-space: nowrap;
//     text-align: right;
//     width: 3rem;

//     &::after {
//         content: '';
//         background: #EFF1F5;
//         width: 7px;
//         height: 7px;
//         position: absolute;
//         top: 5px;
//         right: -12px;
//         border-radius: 50%;
//     }
// `;

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
    color: rgba(var(--center-channel-color-rgb), 0.64)
`;
