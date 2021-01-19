// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import moment from 'moment';

import {Incident} from 'src/types/incident';
import {isMobile} from 'src/mobile';
import {toggleRHS} from 'src/actions';

const Timeline = styled.ul`
    margin: 10px 0 0 0;
    padding: 0;
    list-style: none;
    position: relative;

    :before {
        content: '';
        position: absolute;
        top: 5px;
        bottom: -10px;
        left: 92px;
        width: 1px;
        background: #EFF1F5;
    }
`;

const Circle = styled.div`
    position: absolute;
    width: 24px;
    height: 24px;
    color: var(--button-bg);
    background: #EFF1F5;
    border-radius: 50%;
    left: 80px;
    z-index: 3;
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

    :hover {
        cursor: pointer;
    }
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

    :hover {
        cursor: pointer;
    }
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

// const ClickableLine = styled.div`
//     position: absolute;
//     width: 15px;
//     height: 36px;
//     left: 20%;
//     top: 20px;
//     margin: 0 0 0 -24px;
//
//     //background: lightblue;
//     //opacity: 0.5;
//
//     z-index: 2;
//
//     :hover + button, button:hover {
//         display: inline-flex;
//     }
// `;
//
// const Button = styled.button`
//     display: none;
//
//     position: absolute;
//     width: 20px;
//     height: 15px;
//     left: 20%;
//     top: 20px;
//     margin: 0 0 0 -26px;
//
//     align-items: center;
//     background: var(--button-color);
//     color: var(--button-bg);
//     border-radius: 4px;
//     border: 1px solid var(--button-bg);
//     font-weight: 600;
//     font-size: 10px;
//
//     &:active {
//         background: rgba(var(--button-bg-rgb), 0.8);
//     }
//
//     &:disabled {
//         background: rgba(var(--button-bg-rgb), 0.4);
//     }
// `;

interface Props {
    incident: Incident;
}

const RHSTimeline = (props: Props) => {
    const dispatch = useDispatch();

    const goToPost = (e: React.MouseEvent<Element, MouseEvent>, postId: string) => {
        e.preventDefault();

        // @ts-ignore
        window.WebappUtils.browserHistory.push(`/_redirect/pl/${postId}`);

        if (isMobile()) {
            dispatch(toggleRHS());
        }
    };

    return (
        <Timeline>
            {
                props.incident.status_posts.map((p) => {
                    return (
                        <TimelineItem key={p.id}>
                            <TimeContainer onClick={(e) => goToPost(e, p.id)}>
                                <TimeHours>{moment(p.create_at).format('HH:mm:ss')}</TimeHours>
                                <TimeDay>{moment(p.create_at).format('MMM DD')}</TimeDay>
                            </TimeContainer>
                            <Circle onClick={(e) => goToPost(e, p.id)}/>
                            {/*<ClickableLine onClick={() => console.log('add an event')}/>*/}
                            {/*<Button className={'button'}>{'+'}</Button>*/}
                            <SummaryContainer onClick={(e) => goToPost(e, p.id)}>
                                <SummaryTitle>{'Incident Status Update'}</SummaryTitle>
                                <SummaryDetail>{'Updated, id: ' + p.id}</SummaryDetail>
                            </SummaryContainer>
                        </TimelineItem>
                    );
                })
            }
        </Timeline>
    );
};

export default RHSTimeline;
