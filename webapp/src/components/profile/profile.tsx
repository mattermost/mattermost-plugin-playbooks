// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUser as fetchUser} from 'mattermost-redux/actions/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {Client4} from 'mattermost-redux/client';

import classNames from 'classnames';
import styled from 'styled-components';

interface Props {
    userId: string;
    classNames?: Record<string, boolean>;
    className?: string;
    extra?: React.ReactNode;
    withoutProfilePic?: boolean;
    withoutName?: boolean;
    style?: React.CSSProperties;
    nameFormatter?: (preferredName: string, userName: string, firstName: string, lastName: string, nickName: string) => JSX.Element;
}

const PlaybookRunProfile = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;

export const ProfileImage = styled.img`
    display: inline-block;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    margin: 0 8px 0 0;
    background-color: #bbb;

    .image-sm {
        width: 24px;
        height: 24px;
    }

    .Assigned-button & {
        width: 20px;
        height: 20px;
        margin: 0 4px 0 0;
    }
`;

export const ProfileName = styled.div<{$hasExtra: boolean}>`
    display: flex;
    overflow: hidden;
    min-height: 18px;
    align-items: center;
    padding: 0;
    padding-right: ${({$hasExtra}) => ($hasExtra ? '4px' : '8px')};
    text-overflow: ellipsis;
    white-space: nowrap;

    .description {
        margin-left: 4px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const Profile = (props: Props) => {
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
        const preferredName = displayUsername(user, teamnameNameDisplaySetting);
        name = preferredName;
        if (props.nameFormatter) {
            name = props.nameFormatter(preferredName, user.username, user.first_name, user.last_name, user.nickname);
        }
        profileUri = Client4.getProfilePictureUrl(props.userId, user.last_picture_update);
    }

    return (
        <PlaybookRunProfile
            className={classNames('PlaybookRunProfile', props.classNames, props.className)}
            data-testid={'profile-option-' + user?.username}
            style={props.style}
        >
            {
                !props.withoutProfilePic &&
                <ProfileImage
                    className='image'
                    src={profileUri || ''}
                />
            }
            { !props.withoutName &&
                <ProfileName
                    $hasExtra={Boolean(props.extra)}
                    className='name'
                >{name}</ProfileName>
            }
            {props.extra}
        </PlaybookRunProfile>
    );
};

export default Profile;
