// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import moment, {duration, Moment} from 'moment';
import {Team} from 'mattermost-redux/types/teams';

import {TimelineEvent, TimelineEventType} from 'src/types/rhs';
import {isMobile} from 'src/mobile';
import {toggleRHS} from 'src/actions';
import {ChannelNamesMap} from 'src/types/backstage';
import {messageHtmlToComponent, formatText} from 'src/components/shared';
import {renderDuration} from 'src/components/duration';

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

const SummaryTitle = styled.div`
    font-size: 12px;
    font-weight: 600;

    :hover {
        cursor: pointer;
    }
`;

const SummaryDetail = styled.div`
    font-size: 11px;
    margin: 4px 0 0 0;
    color: var(--center-channel-color-64)
`;

interface Props {
    event: TimelineEvent;
    reportedAt: Moment;
    channelNames: ChannelNamesMap;
    team: Team;
}

const RHSTimelineEventItem = (props: Props) => {
    const dispatch = useDispatch();
    const markdownOptions = {
        atMentions: true,
        team: props.team,
        channelNamesMap: props.channelNames,
    };

    const goToPost = (e: React.MouseEvent<Element, MouseEvent>, postId?: string) => {
        e.preventDefault();
        if (!postId) {
            return;
        }

        // @ts-ignore
        window.WebappUtils.browserHistory.push(`/_redirect/pl/${postId}`);

        if (isMobile()) {
            dispatch(toggleRHS());
        }
    };

    let iconClass = '';
    let summaryTitle = '';
    let summary = '';
    const diff = duration(moment(props.event.event_at).diff(moment(props.reportedAt)));
    let timeSince: JSX.Element | null = <TimeDay>{'Time: ' + renderDuration(diff)}</TimeDay>;

    switch (props.event.event_type) {
    case TimelineEventType.IncidentCreated:
        iconClass = 'icon icon-shield-alert-outline';
        summaryTitle = 'Incident Reported by ' + props.event.subject_display_name;
        timeSince = null;
        break;
    case TimelineEventType.StatusUpdated:
        iconClass = 'icon icon-flag-outline';
        if (props.event.summary === '') {
            summaryTitle = props.event.subject_display_name + ' posted a status update';
        } else {
            summaryTitle = props.event.subject_display_name + ' changed status from ' + props.event.summary;
        }
        break;
    case TimelineEventType.CommanderChanged:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = 'Commander changed from ' + props.event.summary;
        break;
    case TimelineEventType.TaskStateModified:
        iconClass = 'icon icon-format-list-bulleted';
        summaryTitle = 'Task Modified';
        summary = props.event.subject_display_name + ' ' + props.event.summary;
        break;
    case TimelineEventType.AssigneeChanged:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = 'Assignee Changed';
        summary = props.event.subject_display_name + ' ' + props.event.summary;
        break;
    case TimelineEventType.RanSlashCommand:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = 'Slash Command Executed';
        summary = props.event.subject_display_name + ' ' + props.event.summary;
        break;
    }

    return (
        <TimelineItem>
            <TimeContainer>
                <TimeHours>{moment(props.event.event_at).format('MMM DD HH:mm')}</TimeHours>
                {timeSince}
            </TimeContainer>
            <Circle>
                <i className={iconClass}/>
            </Circle>
            <SummaryContainer>
                <SummaryTitle onClick={(e) => goToPost(e, props.event.post_id)}>
                    {summaryTitle}
                </SummaryTitle>
                <SummaryDetail>{messageHtmlToComponent(formatText(summary, markdownOptions), true, {})}</SummaryDetail>
            </SummaryContainer>
        </TimelineItem>
    );
};

export default RHSTimelineEventItem;
