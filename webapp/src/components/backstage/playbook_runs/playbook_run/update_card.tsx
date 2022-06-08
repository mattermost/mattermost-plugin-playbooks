// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import {useDispatch, useSelector} from 'react-redux';
import React from 'react';
import {useIntl} from 'react-intl';

import {Post} from 'mattermost-redux/types/posts';
import {UserProfile} from 'mattermost-redux/types/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {Client4} from 'mattermost-redux/client';

import {Timestamp, messageHtmlToComponent, formatText} from 'src/webapp_globals';

import {useEnsureProfile} from 'src/hooks';

function useAuthorInfo(userID: string) : [string, string] {
    const teamnameNameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || '';
    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, userID));
    useEnsureProfile(userID);

    let profileUrl = '';
    let preferredName = '';
    if (user) {
        profileUrl = Client4.getProfilePictureUrl(user.id, user.last_picture_update);
        preferredName = displayUsername(user, teamnameNameDisplaySetting);
    }

    return [profileUrl, preferredName];
}

interface Props {
    post: Post;
    team?: Team;
}

const REL_UNITS = [
    'Today',
    'Yesterday',
];

const StatusUpdateCard = ({post, team}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    let authorId = post.user_id || '';

    // TODO: double-check how reliable is that field
    if (post.props?.participantIds?.length) {
        authorId = post.props.participantIds[0];
    }
    const [authorProfileUrl, authorUserName] = useAuthorInfo(authorId);
    const markdownOptions = {
        singleline: false,
        mentionHighlight: true,
        atMentions: true,
    };

    return (
        <Container>
            <Header>
                <ProfilePic src={authorProfileUrl}/>
                <Author>{authorUserName}</Author>
                <Date>
                    <Timestamp
                        value={post.create_at}
                        units={REL_UNITS}
                    />
                </Date>
            </Header>
            <Body>
                {messageHtmlToComponent(formatText(post.message, markdownOptions), true, {})}
            </Body>
        </Container>
    );
};

export default StatusUpdateCard;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    padding: 8px;
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    margin-bottom: 8px;
    align-items: center;
`;

const ProfilePic = styled.img`
    width: 20px;
    height: 20px;
    margin-right: 8px;
    border-radius: 50%;
`;
const Author = styled.span`
    font-size: 14px;
    font-weight: 600;
    color: var(--center-channel-color);
    margin-right: 6px;
`;

const Date = styled.span`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const Body = styled.div`
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
`;