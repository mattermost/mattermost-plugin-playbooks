// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {Footer, StyledFooterButton} from 'src/components/rhs/rhs_shared';
import {updateStatus} from 'src/actions';
import {Incident, incidentCurrentStatus} from 'src/types/incident';
import {navigateToUrl} from 'src/browser_routing';
import {pluginId} from 'src/manifest';
import {currentIncident} from 'src/selectors';

interface Props {
    incident: Incident;
}

const RHSFooter: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
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
                {'Incident Overview'}
            </StyledFooterButton>
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
