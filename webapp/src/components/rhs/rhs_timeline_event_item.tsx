// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import moment from 'moment';

import {TimelineEvent, TimelineEventType} from 'src/types/rhs';
import {isMobile} from 'src/mobile';
import {toggleRHS} from 'src/actions';

const Circle = styled.div`
    position: absolute;
    width: 24px;
    height: 24px;
    color: var(--button-bg);
    background: #EFF1F5;
    border-radius: 50%;
    left: 80px;
    z-index: 3;

    > .icon {
        font-size: 14px;
        margin: 5px 0 0 3px;
    }
`;

const TimelineItem = styled.li`
    position: relative;
    margin: 20px 0 0 0;

    :hover {
        cursor: pointer;
    }
`;

const TimeContainer = styled.div`
    position: absolute;
    width: 60px;
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
`;

const SummaryDetail = styled.div`
    font-size: 11px;
    margin: 4px 0 0 0;
    color: var(--center-channel-color-64)
`;

interface Props {
    event: TimelineEvent;
}

const RHSTimelineEventItem = (props: Props) => {
    const dispatch = useDispatch();

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
    let summaryDetail: JSX.Element | null = null;

    switch (props.event.type) {
    case TimelineEventType.IncidentCreated:
        iconClass = 'icon icon-shield-alert-outline';
        summaryTitle = 'Incident Created';
        break;
    case TimelineEventType.StatusUpdated:
        iconClass = 'icon icon-flag-outline';
        summaryTitle = 'Incident Status Update';
        summaryDetail = <SummaryDetail>{props.event.display_name + ' updated incident to ' + props.event.status}</SummaryDetail>;
    }

    return (
        <TimelineItem onClick={(e) => goToPost(e, props.event.post_id)}>
            <TimeContainer>
                <TimeHours>{moment(props.event.create_at).format('HH:mm:ss')}</TimeHours>
                <TimeDay>{moment(props.event.create_at).format('MMM DD')}</TimeDay>
            </TimeContainer>
            <Circle>
                <i className={iconClass}/>
            </Circle>
            <SummaryContainer>
                <SummaryTitle>{summaryTitle}</SummaryTitle>
                {summaryDetail}
            </SummaryContainer>
        </TimelineItem>
    );
};

export default RHSTimelineEventItem;
