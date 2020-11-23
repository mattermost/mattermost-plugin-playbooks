// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import {Footer, StyledFooterButton} from 'src/components/rhs/rhs_shared';
import {updateStatus} from 'src/actions';

const RHSFooterSummary = () => {
    const dispatch = useDispatch();

    return (
        <Footer id='incidentRHSFooter'>
            <StyledFooterButton
                primary={false}
                onClick={() => dispatch(updateStatus())}
            >
                {'Update Status'}
            </StyledFooterButton>
        </Footer>
    );
};

export default RHSFooterSummary;
