// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {startIncident, getIncidents, getIncidentDetails, setRHSState, setRHSOpen} from 'src/actions';
import {activeIncidents, incidentDetails, getRHSState} from 'src/selectors';

import RightHandSidebar from './rhs_main';

function mapStateToProps(state: GlobalState) {
    return {
        incidents: activeIncidents(state) || [],
        incident: incidentDetails(state),
        rhsState: getRHSState(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            startIncident,
            getIncidents,
            getIncidentDetails,
            setRHSState,
            setRHSOpen,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RightHandSidebar);
