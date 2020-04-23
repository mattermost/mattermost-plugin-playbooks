// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {
    startIncident,
    setRHSState,
    setRHSOpen,
} from 'src/actions';

import {incidentDetails, rhsState, isLoading, toggleRHS} from 'src/selectors';

import RhsHeader from './rhs_header';

function mapStateToProps(state: GlobalState) {
    return {
        incident: incidentDetails(state),
        rhsState: rhsState(state),
        isLoading: isLoading(state),
        toggleRHS: toggleRHS(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            startIncident,
            setRHSState,
            setRHSOpen,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RhsHeader);
