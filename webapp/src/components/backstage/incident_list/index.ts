// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {IncidentList} from './incident_list';

interface Props {
    currentTeamId: string;
    currentTeamName: string;
}

function mapStateToProps(state: GlobalState, props: Props) {
    return {
        getUser: (userId: string) => getUser(state, userId),
    };
}

export default connect(mapStateToProps, null)(IncidentList);
