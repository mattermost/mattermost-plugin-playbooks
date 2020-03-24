// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {Client4} from 'mattermost-redux/client';
import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUser as fetchUser} from 'mattermost-redux/actions/users';

import {Incident} from 'src/types/incident';

import IncidentDetails from './incident_details';

type Props = {
    incident: Incident;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    let userId = null;
    let lastPictureUpdate = null;

    const commander = getUser(state, ownProps.incident.commander_user_id);
    if (commander) {
        userId = commander.id;
        lastPictureUpdate = commander.last_picture_update;
    }

    return {
        commander,
        profileUri: Client4.getProfilePictureUrl(userId, lastPictureUpdate),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            fetchUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(IncidentDetails);

