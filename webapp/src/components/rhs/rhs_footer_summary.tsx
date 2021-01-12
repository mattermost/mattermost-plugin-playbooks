// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {isCurrentChannelArchived} from 'mattermost-redux/selectors/entities/channels';

import {Footer, StyledFooterButton} from 'src/components/rhs/rhs_shared';
import {updateStatus} from 'src/actions';

const RHSFooterSummary = () => {
    const dispatch = useDispatch();

    const isChannelArchived = useSelector<GlobalState, boolean>(isCurrentChannelArchived);

    return !isChannelArchived && (
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
