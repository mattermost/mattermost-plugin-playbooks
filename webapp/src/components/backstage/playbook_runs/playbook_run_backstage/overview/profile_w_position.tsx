// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import styled from 'styled-components';

import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUser as fetchUser} from 'mattermost-redux/actions/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {Client4} from 'mattermost-redux/client';

interface Props {
    userId: string;
}

const Profile = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;

const Wrapper = styled.div`
    padding: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const Name = styled.div`
    font-weight: 600;
`;

const Position = styled.div``;

const ProfilePic = styled.img`
    margin: 0 8px 0 0;
    width: 32px;
    height: 32px;
    background-color: #bbb;
    border-radius: 50%;
    display: inline-block;
`;

const ProfileWithPosition = (props: Props) => {
    const dispatch = useDispatch();
    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, props.userId));
    const teamnameNameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || '';

    useEffect(() => {
        if (!user) {
            dispatch(fetchUser(props.userId));
        }
    }, [props.userId]);

    let name = null;
    let profileUri = null;
    if (user) {
        name = displayUsername(user, teamnameNameDisplaySetting);
        profileUri = Client4.getProfilePictureUrl(props.userId, user.last_picture_update);
    }

    return (
        <Profile>
            <ProfilePic src={profileUri || ''}/>
            <Wrapper>
                <Name>{name}</Name>
                <Position>{user?.position}</Position>
            </Wrapper>
        </Profile>
    );
};

export default ProfileWithPosition;
