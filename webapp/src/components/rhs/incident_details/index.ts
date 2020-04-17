// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {GlobalState} from 'mattermost-redux/types/store';
import {getUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {Channel, ChannelWithTeamData} from 'mattermost-redux/types/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getChannel, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {Incident} from 'src/types/incident';
import {
    endIncident,
    modifyChecklistItemState,
    addChecklistItem,
    removeChecklistItem,
    renameChecklistItem,
    reorderChecklist,
} from 'src/actions';

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

    const channelDetails = [] as ChannelWithTeamData[];
    if (ownProps.incident?.channel_ids) {
        for (const channelId of ownProps.incident?.channel_ids) {
            const c = getChannel(state, channelId) as Channel;
            if (c) {
                const t = getTeam(state, c.team_id) as Team;
                const newChannelWithTeamData = {
                    ...c,
                    team_display_name: t.display_name,
                    team_name: t.name,
                };

                channelDetails.push(newChannelWithTeamData);
            }
        }
    }

    // Get the incident main channel. Assuming the first one for now.
    const incidentChannelId = ownProps.incident?.channel_ids?.[0] || '';

    return {
        commander,
        profileUri: Client4.getProfilePictureUrl(ownProps.incident.commander_user_id, lastPictureUpdate),
        channelDetails,
        isCommander: getCurrentUserId(state) === ownProps.incident.commander_user_id,
        allowEndIncident: incidentChannelId === getCurrentChannel(state)?.id,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            endIncident,
            modifyChecklistItemState,
            addChecklistItem,
            removeChecklistItem,
            renameChecklistItem,
            reorderChecklist,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(IncidentDetails);

