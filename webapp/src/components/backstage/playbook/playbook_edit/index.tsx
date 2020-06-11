// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withRouter} from 'react-router-dom';

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {playbooksForTeam} from 'src/selectors';
import {newPlaybook} from 'src/types/playbook';
import {getPlaybook} from 'src/actions';

import {PlaybookEdit, Props} from './playbook_edit';

const mapStateToProps = (state: GlobalState, ownProps: Props): object => {
    const playbook = playbooksForTeam(state).find((p) => p.id === ownProps.match.params.playbookId);

    return {
        playbook: playbook || newPlaybook(),
    };
};

const mapDispatchToProps = (dispatch: Dispatch): object => {
    return {
        actions: bindActionCreators({
            getPlaybook,
        }, dispatch),
    };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(PlaybookEdit));
