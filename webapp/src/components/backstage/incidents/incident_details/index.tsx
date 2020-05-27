// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {Channel, ChannelWithTeamData} from 'mattermost-redux/types/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getChannel, getAllChannelStats} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {Permissions} from 'mattermost-redux/constants';

import {isExportPluginLoaded} from 'src/utils/utils';

import {Incident} from 'src/types/incident';

import {navigateToUrl} from 'src/actions';

import {isExportLicensed} from 'src/selectors';

import BackstageIncidentDetails from './incident_details';

type Props = {
    incident: Incident;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const mainChannelId = ownProps.incident.channel_ids?.[0] || '';
    const involvedInIncident = haveIChannelPermission(state,
        {channel: mainChannelId, team: ownProps.incident.team_id, permission: Permissions.READ_CHANNEL});

    return {
        involvedInIncident,
        exportAvailable: isExportPluginLoaded(),
        exportLicensed: isExportLicensed(state),
        theme: getTheme(state),
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

