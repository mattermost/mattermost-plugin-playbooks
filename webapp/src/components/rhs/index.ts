// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {getServerVersion} from 'mattermost-redux/selectors/entities/general';
import {isMinimumServerVersion} from 'mattermost-redux/utils/helpers';

import {
    withLoading,
    startIncident,
    getIncidentsForCurrentTeam,
    getIncidentDetails,
    setRHSState,
    setRHSOpen,
} from 'src/actions';

import {activeIncidents, incidentDetails, rhsState, isLoading} from 'src/selectors';

import RightHandSidebar from './rhs_main';

function mapStateToProps(state: GlobalState) {
    return {
        incidents: activeIncidents(state) || [],
        incident: incidentDetails(state),
        rhsState: rhsState(state),
        isLoading: isLoading(state),
        addLegacyHeader: !isMinimumServerVersion(getServerVersion(state), 5, 24),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            startIncident,
            getIncidentsForCurrentTeam: () => withLoading(getIncidentsForCurrentTeam()),
            getIncidentDetails: (id: string) => withLoading(getIncidentDetails(id)),
            setRHSState,
            setRHSOpen,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RightHandSidebar);
