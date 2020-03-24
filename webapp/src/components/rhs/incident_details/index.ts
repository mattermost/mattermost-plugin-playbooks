// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {Client4} from 'mattermost-redux/client';
import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getUser as fetchUser} from 'mattermost-redux/actions/users';
import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {Channel} from 'mattermost-redux/types/channels';

import {Incident} from 'src/types/incident';

import IncidentDetails from './incident_details';

type Props = {
    incident: Incident;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    let lastPictureUpdate = null;

    const commander = getUser(state, ownProps.incident.commander_user_id);
    if (commander) {
        lastPictureUpdate = commander.last_picture_update;
    }

    const channelDetails = [] as Channel[];
    if (ownProps.incident?.channel_ids) {
        for (const channelId of ownProps.incident?.channel_ids) {
            const c = getChannel(state, channelId);
            if (c) {
                channelDetails.push(c);
            }
        }
    }

    return {
        commander,
        profileUri: Client4.getProfilePictureUrl(ownProps.incident.commander_user_id, lastPictureUpdate),
        channelDetails,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            fetchUser,
            fetchChannel,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(IncidentDetails);

