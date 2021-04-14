// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import {useDispatch} from 'react-redux';

import {Footer, StyledFooterButton} from 'src/components/rhs/rhs_shared';
import {updateStatus} from 'src/actions';
import {Incident, incidentCurrentStatus} from 'src/types/incident';

interface Props {
    incident: Incident;
}

const RHSFooter: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();

    let text = 'Update Status';
    if (incidentCurrentStatus(props.incident) === 'Archived') {
        text = 'Reopen Incident';
    }

    return (
        <Footer id='incidentRHSFooter'>
            <StyledFooterButton
                primary={true}
                onClick={() => dispatch(updateStatus())}
            >
                {text}
            </StyledFooterButton>
        </Footer>
    );
};

export default RHSFooter;
