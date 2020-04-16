// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {getDisplayName} from 'src/utils/utils';

import Profile from './profile';

type Props = {
    userId: string;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    let lastPictureUpdate = null;
    let name = null;

    const user = getUser(state, ownProps.userId);
    if (user) {
        lastPictureUpdate = user.last_picture_update;
        name = getDisplayName(user);
    }

    return {
        profileUri: Client4.getProfilePictureUrl(ownProps.userId, lastPictureUpdate),
        name,
    };
}

export default connect(mapStateToProps, null)(Profile);
