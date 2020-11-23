// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import moment from 'moment';

import {useDispatch, useSelector} from 'react-redux';
import React, {FC, useEffect, useState} from 'react';

import {Post} from 'mattermost-redux/types/posts';
import {UserProfile} from 'mattermost-redux/types/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {Client4} from 'mattermost-redux/client';

import {Team} from 'mattermost-redux/types/teams';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {isMobile} from 'src/mobile';
import {updateStatus, toggleRHS} from 'src/actions';
import {ChannelNamesMap} from 'src/types/backstage';
import ShowMore from 'src/components/rhs/show_more';

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

const UpdateBody = styled.div`
    padding-right: 6px;

    h1,h2,h3,h4,h5,h6 {
        font-size: inherit;
        font-weight: 600;
    }
`;

const EditedIndicator = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: .87em;
    margin-top: -7px;
`;

interface LatestUpdateProps {
    posts_ids: string[];
}

const LatestUpdate: FC<LatestUpdateProps> = (props: LatestUpdateProps) => {
    const dispatch = useDispatch();

    const [latestUpdate, setLatestUpdate] = useState<Post | null>(null);

    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, latestUpdate?.user_id || ''));
    const teamnameNameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || '';
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);

    type GetPostType = (postId: string) => Post;
    const getPostFromState = useSelector<GlobalState, GetPostType>((state) => (postId) => getPost(state, postId));

    useEffect(() => {
        for (let i = props.posts_ids.length - 1; i >= 0; --i) {
            const post = getPostFromState(props.posts_ids[i]);

            if (post) {
                setLatestUpdate(post);
                return;
            }
        }

        setLatestUpdate(null);
    });

    let profileUri = '';
    let userName = '';
    if (user) {
        const preferredName = displayUsername(user, teamnameNameDisplaySetting);
        userName = preferredName;
        profileUri = Client4.getProfilePictureUrl(user.id, user.last_picture_update);
    }

    if (latestUpdate === null) {
        return (
            <NoRecentUpdates>
                {'No recent updates. '}<a onClick={() => dispatch(updateStatus())}>{'Click here'}</a>{' to update status.'}
            </NoRecentUpdates>
        );
    }

    const updateTimestamp = moment(latestUpdate.create_at).calendar(undefined, {sameDay: 'LT'}); //eslint-disable-line no-undefined

    // @ts-ignore
    const {formatText, messageHtmlToComponent} = window.PostUtils;

    const markdownOptions = {
        singleline: false,
        mentionHighlight: true,
        atMentions: true,
        team,
        channelNamesMap,
    };

    return (
        <UpdateSection>
            <ProfilePic src={profileUri}/>
            <UpdateContainer>
                <UpdateHeader>
                    <UpdateAuthor>{userName}</UpdateAuthor>
                    <UpdateTimeLink
                        href={`/_redirect/pl/${latestUpdate.id}`}
                        onClick={(e) => {
                            e.preventDefault();

                            // @ts-ignore
                            window.WebappUtils.browserHistory.push(`/_redirect/pl/${latestUpdate.id}`);

                            if (isMobile()) {
                                dispatch(toggleRHS());
                            }
                        }}
                    >
                        {updateTimestamp}
                    </UpdateTimeLink>
                </UpdateHeader>
                <ShowMore
                    text={latestUpdate.message}
                >
                    <UpdateBody>
                        {messageHtmlToComponent(formatText(latestUpdate.message, markdownOptions), true, {})}
                        {latestUpdate.edit_at !== 0 && <EditedIndicator>{'(edited)'}</EditedIndicator>}
                    </UpdateBody>
                </ShowMore>
            </UpdateContainer>
        </UpdateSection>
    );
};

export default LatestUpdate;
