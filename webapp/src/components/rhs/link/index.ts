// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import Link from 'src/components/rhs/link/link';
import {toggleRHS} from 'src/actions';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            toggleRHS,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(Link);
