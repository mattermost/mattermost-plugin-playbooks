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
import {StatusPost} from 'src/types/incident';

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

interface Props {
    statusPosts: StatusPost[];
}

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

function usePostFromState(statusPosts: StatusPost[]) : [string, Post | null] {
    const sortedPosts = [...statusPosts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);

    const postID = sortedPosts[0]?.id;

    return [postID, useSelector<GlobalState, Post | null>((state) => getPost(state, postID || ''))];
}

const LatestUpdate: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();
    const [latestUpdate, setLatestUpdate] = useState<Post | null>(null);

    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const [authorProfileUrl, authorUserName] = useAuthorInfo(latestUpdate?.user_id || '');
    const [postID, postFromState] = usePostFromState(props.statusPosts);

    useEffect(() => {
        const updateLatestUpdate = async () => {
            if (postFromState) {
                setLatestUpdate(postFromState);
                return;
            }

            if (postID) {
                setLatestUpdate(await Client4.getPost(postID));
                return;
            }

            setLatestUpdate(null);
        };

        updateLatestUpdate();
    }, [props.statusPosts]);

    if (!latestUpdate) {
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
            <ProfilePic src={authorProfileUrl}/>
            <UpdateContainer>
                <UpdateHeader>
                    <UpdateAuthor>{authorUserName}</UpdateAuthor>
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
