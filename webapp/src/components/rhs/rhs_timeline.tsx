// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import styled from 'styled-components';

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
import {TimelineEvent, TimelineEventType} from 'src/types/rhs';
import RHSTimelineEventItem from 'src/components/rhs/rhs_timeline_event_item';

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

type IdToPostFn = (postId: string) => Post;
type IdToUserFn = (userId: string) => UserProfile;

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

    const [events, setEvents] = useState<TimelineEvent[]>([]);

    useEffect(() => {
        Promise.all(props.incident.status_posts.map(async (p) => {
            let post = selectPost(p.id) as Post | undefined;

            if (!post) {
                const ret = await getPostFn(p.id);
                if (!ret.data) {
                    return null;
                }
                post = ret.data;
            }

            let user = selectUser(post.user_id) as UserProfile | undefined;

            if (!user) {
                const ret = await getUserFn(post.user_id) as { data?: UserProfile, error?: any };
                if (!ret.data) {
                    return null;
                }
                user = ret.data;
            }

            const displayName = displayUsername(user, displayPreference);
            return {
                type: TimelineEventType.StatusUpdated,
                create_at: p.create_at,
                post_id: p.id,
                display_name: displayName,
                status: p.status || 'unset',
            } as TimelineEvent;
        })).then((eventArray) => {
            setEvents(eventArray.filter((e) => e) as TimelineEvent[]);
        });
    }, [props.incident.status_posts, displayPreference]);

    return (
        <Timeline>
            <RHSTimelineEventItem
                event={{
                    type: TimelineEventType.IncidentCreated,
                    create_at: props.incident.create_at,
                }}
            />
            {
                events.map((event) => {
                    return (
                        <RHSTimelineEventItem
                            key={event.post_id}
                            event={event}
                        />
                    );
                })
            }
        </Timeline>
    );
};

export default RHSTimeline;
