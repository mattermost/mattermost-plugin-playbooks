// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {
    setRHSState,
} from 'src/actions';

import {incidentDetails, rhsState, isLoading} from 'src/selectors';

import RHSTitle from './rhs_title';

function mapStateToProps(state: GlobalState) {
    return {
        incident: incidentDetails(state),
        rhsState: rhsState(state),
        isLoading: isLoading(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            setRHSState,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RHSTitle);
