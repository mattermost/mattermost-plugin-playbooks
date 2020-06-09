// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {Incident} from 'src/types/incident';

import {navigateToUrl} from 'src/actions';

import {incidentDetails, isExportLicensed} from 'src/selectors';

import BackstageIncidentDetails from './incident_details';

function mapStateToProps(state: GlobalState) {
    const isExportPluginLoaded = Boolean(state.plugins?.plugins?.['com.mattermost.plugin-channel-export']);

    const incident = incidentDetails(state);

    // Determine if involved in incident by checking if full details fetched.
    const involvedInIncident = Boolean(incident.channel_name);

    return {
        incident,
        involvedInIncident,
        exportAvailable: isExportPluginLoaded,
        exportLicensed: isExportLicensed(state),
        theme: getTheme(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            navigateToUrl,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(BackstageIncidentDetails);

