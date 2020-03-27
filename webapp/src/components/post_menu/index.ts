// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {startIncident} from 'src/actions';

import StartIncidentPostMenu from './post_menu';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            startIncident,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(StartIncidentPostMenu);

