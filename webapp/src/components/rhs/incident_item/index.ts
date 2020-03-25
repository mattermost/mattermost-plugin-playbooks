// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUser as fetchUser} from 'mattermost-redux/actions/users';

import {Incident} from 'src/types/incident';

import IncidentItem from './incident_item';

type Props = {
    incident: Incident;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    return {
        commander: getUser(state, ownProps.incident.commander_user_id),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            fetchUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(IncidentItem);

