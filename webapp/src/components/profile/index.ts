// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {connect} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUser as fetchUser} from 'mattermost-redux/actions/users';
import {bindActionCreators, Dispatch} from 'redux';

import Profile from 'src/components/profile/profile';

type Props = {
    userId: string;
    nameFormatter?: (preferredName: string, userName: string, firstName: string, lastName: string, nickName: string) => JSX.Element;
}

function mapStateToProps(state: GlobalState, props: Props) {
    let name = null;
    let profileUri = null;

    const user = getUser(state, props.userId);
    if (user) {
        const preferredName = displayUsername(user, getTeammateNameDisplaySetting(state));
        name = preferredName;
        if (props.nameFormatter) {
            name = props.nameFormatter(preferredName, user.username, user.first_name, user.last_name, user.nickname);
        }
        profileUri = Client4.getProfilePictureUrl(props.userId, user.last_picture_update);
    }

    return {
        profileUri,
        name,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            fetchUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Profile);
