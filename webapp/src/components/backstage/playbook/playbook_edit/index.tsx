// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {playbooksForTeam} from 'src/selectors';
import {newPlaybook} from 'src/types/playbook';
import {getPlaybook} from 'src/actions';

import {PlaybookEdit, Props} from './playbook_edit';

const mapStateToProps = (state: GlobalState, ownProps: Props) => {
    let playbook;
    if (ownProps.newPlaybook) {
        playbook = newPlaybook();
    } else {
        playbook = playbooksForTeam(state).find((p) => p.id === ownProps.playbookId);
    }

    return {
        playbook,
    };
};

const mapDispatchToProps = (dispatch: Dispatch) => {
    return {
        actions: bindActionCreators({
            getPlaybook,
        }, dispatch),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PlaybookEdit);
