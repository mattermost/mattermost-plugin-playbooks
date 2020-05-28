// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {
    startIncident,
    setRHSState,
    setRHSOpen,
    setBackstageModal,
} from 'src/actions';

import {incidentDetails, rhsState, isLoading} from 'src/selectors';
import {BackstageArea} from 'src/types/backstage';

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
            startIncident,
            setRHSState,
            setRHSOpen,
            openBackstageModal: (selectedArea: BackstageArea) => setBackstageModal(true, selectedArea),
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RHSTitle);
