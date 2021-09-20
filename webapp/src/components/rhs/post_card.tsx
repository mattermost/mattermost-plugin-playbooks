// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import moment from 'moment';

import {useDispatch, useSelector} from 'react-redux';
import React from 'react';

import {Post} from 'mattermost-redux/types/posts';
import {UserProfile} from 'mattermost-redux/types/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {Client4} from 'mattermost-redux/client';

import {browserHistory} from 'src/webapp_globals';

import {isMobile} from 'src/mobile';
import {ChannelNamesMap} from 'src/types/backstage';
import {promptUpdateStatus, toggleRHS} from 'src/actions';
import ShowMore from 'src/components/rhs/show_more';
import PostText from 'src/components/post_text';

const NoRecentUpdates = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const UpdateSection = styled.div`
    display: flex;
    flex-direction: row;
`;

const UpdateContainer = styled.div`
    display: inline;
`;

const ProfilePic = styled.img`
    width: 32px;
    height: 32px;
    margin-right: 10px;
    border-radius: 50%;
`;

const UpdateHeader = styled.div`
    margin-bottom: 4px;
`;

const UpdateAuthor = styled.span`
    font-size: 15px;
    font-weight: 600;
    color: var(--center-channel-color);
    margin-right: 6px;
`;

const UpdateTimeLink = styled.a`
    && {
        font-size: 12px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const EditedIndicator = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: .87em;
    margin-top: -7px;
`;

function useAuthorInfo(userID: string) : [string, string] {
    const teamnameNameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || '';
    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, userID));

    let profileUrl = '';
    let preferredName = '';
    if (user) {
        profileUrl = Client4.getProfilePictureUrl(user.id, user.last_picture_update);
        preferredName = displayUsername(user, teamnameNameDisplaySetting);
    }

    return [profileUrl, preferredName];
}

interface Props {
    post: Post | null;
    team: Team;
    playbookRunId: string;
    playbookId: string
    channelId: string;
}

const PostCard = (props: Props) => {
    const dispatch = useDispatch();
    const [authorProfileUrl, authorUserName] = useAuthorInfo(props.post?.user_id || '');

    if (!props.post) {
        return (
            <NoRecentUpdates>
                {'No recent updates. '}<a onClick={() => dispatch(promptUpdateStatus(props.team.id, props.playbookRunId, props.playbookId, props.channelId))}>{'Click here'}</a>{' to update status.'}
            </NoRecentUpdates>
        );
    }

    const updateTimestamp = moment(props.post.create_at).calendar(undefined, {sameDay: 'LT'}); //eslint-disable-line no-undefined

    return (
        <UpdateSection>
            <ProfilePic src={authorProfileUrl}/>
            <UpdateContainer>
                <UpdateHeader>
                    <UpdateAuthor>{authorUserName}</UpdateAuthor>
                    <UpdateTimeLink
                        href={`/_redirect/pl/${props.post.id}`}
                        onClick={(e) => {
                            e.preventDefault();

                            if (props.post) {
                                browserHistory.push(`/_redirect/pl/${props.post.id}`);
                            }

                            if (isMobile()) {
                                dispatch(toggleRHS());
                            }
                        }}
                    >
                        {updateTimestamp}
                    </UpdateTimeLink>
                </UpdateHeader>
                <ShowMore
                    text={props.post.message}
                >
                    <PostText
                        text={props.post.message}
                        team={props.team}
                    >
                        {props.post.edit_at !== 0 && <EditedIndicator>{'(edited)'}</EditedIndicator>}
                    </PostText>
                </ShowMore>
            </UpdateContainer>
        </UpdateSection>
    );
};

export default PostCard;
