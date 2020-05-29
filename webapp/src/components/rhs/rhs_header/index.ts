// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {isMobile} from 'src/utils/utils';
import {
    startIncident,
    setBackstageModal,
} from 'src/actions';

import {BackstageArea} from 'src/types/backstage';

import RHSHeader from './rhs_header';

function mapStateToProps() {
    return {
        isMobile: isMobile(),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            startIncident,
            openBackstageModal: (selectedArea: BackstageArea) => setBackstageModal(true, selectedArea),
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RHSHeader);
