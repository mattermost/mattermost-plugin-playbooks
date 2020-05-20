// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {Channel, ChannelWithTeamData} from 'mattermost-redux/types/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getChannel, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeam, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {Permissions} from 'mattermost-redux/constants';

import {Incident} from 'src/types/incident';
import {
    endIncident,
    modifyChecklistItemState,
    addChecklistItem,
    removeChecklistItem,
    renameChecklistItem,
    reorderChecklist,
    toggleRHS,
} from 'src/actions';

import RHSIncidentDetails from './incident_details';

type Props = {
    incident: Incident;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    let lastPictureUpdate = null;
    const primaryChannelId = ownProps.incident.primary_channel_id;
    const incidentTeamId = ownProps.incident.team_id;

    const commander = getUser(state, ownProps.incident.commander_user_id);
    if (commander) {
        lastPictureUpdate = commander.last_picture_update;
    }

    let primaryChannelDetails = null;
    const c = getChannel(state, primaryChannelId) as Channel;
    if (c) {
        const t = getTeam(state, c.team_id) as Team;
        const newChannelWithTeamData = {
            ...c,
            team_display_name: t.display_name,
            team_name: t.name,
        };

        primaryChannelDetails = newChannelWithTeamData;
    }

    // If you can read the channel, you are involved in the incident.
    const involvedInIncident = haveIChannelPermission(state,
        {channel: primaryChannelId, team: incidentTeamId, permission: Permissions.READ_CHANNEL});

    return {
        commander,
        profileUri: Client4.getProfilePictureUrl(ownProps.incident.commander_user_id, lastPictureUpdate),
        primaryChannelDetails,
        viewingIncidentChannel: primaryChannelId === getCurrentChannel(state)?.id,
        involvedInIncident,
        teamName: getCurrentTeam(state).name,
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
            toggleRHS,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RHSIncidentDetails);

