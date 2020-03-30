// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {getRHSOpen} from '../../selectors';

import IncidentIcon from './incident_icon';

function mapStateToProps(state: GlobalState) {
    return {
        isRHSOpen: getRHSOpen(state),
    };
}

export default connect(mapStateToProps, null)(IncidentIcon);
