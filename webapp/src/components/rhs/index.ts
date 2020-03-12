// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {getIncidents} from '../../actions';
import {activeIncidents} from '../../selectors';

import RightHandSidebar from './rhs_main';

function mapStateToProps(state: GlobalState) {
    return {
        incidents: activeIncidents(state) || [],
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getIncidents,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RightHandSidebar);
