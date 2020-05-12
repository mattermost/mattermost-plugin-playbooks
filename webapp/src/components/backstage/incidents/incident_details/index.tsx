// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {Channel, ChannelWithTeamData} from 'mattermost-redux/types/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getChannel, getAllChannelStats} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {Permissions} from 'mattermost-redux/constants';

import {Incident} from 'src/types/incident';

import {navigateToUrl} from 'src/actions';

import BackstageIncidentDetails from './incident_details';

type Props = {
    incident: Incident;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    let totalMessages = 0;
    const mainChannelId = ownProps.incident.channel_ids?.[0] || '';
    const involvedInIncident = haveIChannelPermission(state,
        {channel: mainChannelId, team: ownProps.incident.team_id, permission: Permissions.READ_CHANNEL});

    let mainChannelDetails: ChannelWithTeamData;
    if (ownProps.incident.channel_ids.length > 0) {
        const c = getChannel(state, mainChannelId) as Channel;
        if (c) {
            const t = getTeam(state, c.team_id) as Team;
            mainChannelDetails = {
                ...c,
                team_display_name: t.display_name,
                team_name: t.name,
            };

            totalMessages = c.total_msg_count;
        }
    }

    const channelStats = getAllChannelStats(state)[mainChannelId];

    return {
        involvedInIncident,
        totalMessages,
        membersCount: channelStats?.member_count || 1,
        mainChannelDetails,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            navigateToUrl,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(BackstageIncidentDetails);

