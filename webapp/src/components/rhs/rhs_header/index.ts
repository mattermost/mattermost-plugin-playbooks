// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {Permissions} from 'mattermost-redux/constants';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {isMobile} from 'src/utils/utils';
import {
    startIncident,
    navigateToTeamPluginUrl,
} from 'src/actions';

import RHSHeader from './rhs_header';

function mapStateToProps(state: GlobalState) {
    const hasPermissionToCreateChannels = haveITeamPermission(
        state,
        {
            team: getCurrentTeamId(state),
            permission: Permissions.CREATE_PUBLIC_CHANNEL,
        },
    ) || haveITeamPermission(
        state,
        {
            team: getCurrentTeamId(state),
            permission: Permissions.CREATE_PRIVATE_CHANNEL,
        },
    );

    return {
        hasPermissionToCreateChannels,
        isMobile: isMobile(),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            startIncident,
            navigateToTeamPluginUrl,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RHSHeader);
