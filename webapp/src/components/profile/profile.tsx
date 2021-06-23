// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {UserProfile} from 'mattermost-redux/types/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUser as fetchUser} from 'mattermost-redux/actions/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {Client4} from 'mattermost-redux/client';

import classNames from 'classnames';

import './profile.scss';

interface Props {
    userId: string;
    classNames?: Record<string, boolean>;
    className?: string;
    extra?: JSX.Element;
    withoutProfilePic?: boolean;
    withoutName?: boolean;
    nameFormatter?: (preferredName: string, userName: string, firstName: string, lastName: string, nickName: string) => JSX.Element;
}

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
        <div className={classNames('PlaybookRunProfile', props.classNames, props.className)}>
            {
                !props.withoutProfilePic &&
                <img
                    className='image'
                    src={profileUri || ''}
                />
            }
            { !props.withoutName &&
                <div className='name'>{name}</div>
            }
            {props.extra}
        </div>
    );
};

export default Profile;
