// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';

import Link from 'src/components/rhs/link/link';
import {toggleRHSAction} from 'src/selectors';

function mapStateToProps(state: GlobalState) {
    return {
        toggleRHSAction: toggleRHSAction(state),
    };
}

export default connect(mapStateToProps, null)(Link);
