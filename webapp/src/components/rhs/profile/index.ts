// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {connect} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import Profile from './profile';

type Props = {
    userId: string;
}

function mapStateToProps(state: GlobalState, props: Props) {
    let name = null;
    let profileUri = null;

    const user = getUser(state, props.userId);
    if (user) {
        name = displayUsername(user, getTeammateNameDisplaySetting(state));
        if (name === user.username) {
            name = '@' + name;
        }
        profileUri = Client4.getProfilePictureUrl(props.userId, user.last_picture_update);
    }

    return {
        profileUri,
        name,
    };
}

export default connect(mapStateToProps, null)(Profile);
