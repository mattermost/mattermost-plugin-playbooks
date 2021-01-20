// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import styled from 'styled-components';
import moment from 'moment';

import {GlobalState} from 'mattermost-redux/types/store';
import {Post} from 'mattermost-redux/types/posts';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getPost as getPostAction} from 'mattermost-redux/actions/posts';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUser as getUserAction} from 'mattermost-redux/actions/users';
import {UserProfile} from 'mattermost-redux/types/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {DispatchFunc} from 'mattermost-redux/types/actions';

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

    :before {
        font-family: 'compass-icons';
        text-rendering: auto;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        content: '\\xf23b';
        font-size: 12px;
        font-weight: bold;
        color: var(--button-bg);
        transition: transform 0.15s;
        transform: scale(0) rotate(90deg);
        position: relative;
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

type IdToPostFn = (postId: string) => Post;
type IdToUserFn = (userId: string) => UserProfile;

interface Event {
    create_at: number;
    post_id: string;
    display_name: string;
    status: string;
}

interface Props {
    incident: Incident;
}

const RHSTimeline = (props: Props) => {
    const dispatch = useDispatch();
    const displayPreference = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || 'username';
    const getStateFn = useStore().getState;
    const getPostFn = (postId: string) => getPostAction(postId)(dispatch as DispatchFunc, getStateFn);
    const getUserFn = (userId: string) => getUserAction(userId)(dispatch as DispatchFunc, getStateFn);

    const selectPost = useSelector<GlobalState, IdToPostFn>((state) => (postId: string) => getPost(state, postId));
    const selectUser = useSelector<GlobalState, IdToUserFn>((state) => (userId: string) => getUser(state, userId));

    const [events, setEvents] = useState<Event[]>([]);

    useEffect(() => {
        Promise.all(props.incident.status_posts.map(async (p) => {
            let post = selectPost(p.id) as Post | undefined;

            if (!post) {
                const ret = await getPostFn(p.id);
                if (!ret.data) {
                    return Promise.reject(new Error('no post'));
                }
                post = ret.data;
            }

            let user = selectUser(post.user_id) as UserProfile | undefined;

            if (!user) {
                const ret = await getUserFn(post.user_id) as {data?: UserProfile, error?: any};
                if (!ret.data) {
                    return Promise.reject(new Error('no user'));
                }
                user = ret.data;
            }

            const displayName = displayUsername(user, displayPreference);
            return {
                create_at: p.create_at,
                post_id: p.id,
                display_name: displayName,
                status: p.status || 'unset',
            } as Event;
        })).then((eventArray) => {
            setEvents(eventArray);
        });
    }, [props.incident.status_posts, displayPreference]);

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
                events.map((event) => {
                    return (
                        <TimelineItem key={event.post_id}>
                            <TimeContainer onClick={(e) => goToPost(e, event.post_id)}>
                                <TimeHours>{moment(event.create_at).format('HH:mm:ss')}</TimeHours>
                                <TimeDay>{moment(event.create_at).format('MMM DD')}</TimeDay>
                            </TimeContainer>
                            <Circle onClick={(e) => goToPost(e, event.post_id)}/>
                            {/*<ClickableLine onClick={() => console.log('add an event')}/>*/}
                            {/*<Button className={'button'}>{'+'}</Button>*/}
                            <SummaryContainer onClick={(e) => goToPost(e, event.post_id)}>
                                <SummaryTitle>{'Incident Status Update'}</SummaryTitle>
                                <SummaryDetail>{event.display_name + ' updated incident to ' + event.status}</SummaryDetail>
                            </SummaryContainer>
                        </TimelineItem>
                    );
                })
            }
        </Timeline>
    );
};

export default RHSTimeline;
