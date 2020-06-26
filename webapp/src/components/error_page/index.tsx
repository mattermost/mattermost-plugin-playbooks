// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {withRouter} from 'react-router-dom';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import ErrorPage from './error_page';

function mapStateToProps(state: GlobalState) {
    return {
        teamName: getCurrentTeam(state).name,
    };
}

export default withRouter(connect(mapStateToProps)(ErrorPage));
