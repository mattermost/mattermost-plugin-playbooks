// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {
    withLoading,
    startIncident,
    getIncidentsForCurrentTeam,
    getIncident,
    setRHSState,
    setRHSOpen,
} from 'src/actions';

import {activeIncidents, incidentDetails, rhsState, isLoading} from 'src/selectors';
import {RHSState} from 'types/rhs';

import RightHandSidebar from './rhs_main';

function mapStateToProps(state: GlobalState) {
    const incident = incidentDetails(state);
    const currentRHSState = rhsState(state);
    return {
        incidents: activeIncidents(state) || [],
        incident,
        rhsState: currentRHSState,
        isLoading: isLoading(state) || ((!incident || !incident.id) && currentRHSState === RHSState.Details),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            startIncident,
            getIncidentsForCurrentTeam: () => withLoading(getIncidentsForCurrentTeam()),
            getIncident: (id: string) => withLoading(getIncident(id)),
            setRHSState,
            setRHSOpen,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RightHandSidebar);
