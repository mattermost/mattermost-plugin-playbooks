// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {Footer, StyledFooterButton} from 'src/components/rhs/rhs_shared';
import {updateStatus} from 'src/actions';
import {Incident, incidentCurrentStatus} from 'src/types/incident';
import {navigateToUrl} from 'src/browser_routing';
import {pluginId} from 'src/manifest';
import {currentIncident} from 'src/selectors';

const SpacedFooterButton = styled(StyledFooterButton)`
    margin-left: 10px;
`;

interface Props {
    incident: Incident;
}

const RHSFooter = (props: Props) => {
    const dispatch = useDispatch();
    const currentTeam = useSelector(getCurrentTeam);
    const incident = useSelector(currentIncident);

    let text = 'Update Status';
    if (incidentCurrentStatus(props.incident) === 'Archived') {
        text = 'Reopen Incident';
    }

    return (
        <Footer id='incidentRHSFooter'>
            <StyledFooterButton
                primary={false}
                onClick={() => navigateToUrl(`/${currentTeam.name}/${pluginId}/incidents/${incident?.id}`)}
            >
                {'Overview'}
            </StyledFooterButton>
            <SpacedFooterButton
                primary={true}
                onClick={() => dispatch(updateStatus())}
            >
                {text}
            </SpacedFooterButton>
        </Footer>
    );
};

export default RHSFooter;
