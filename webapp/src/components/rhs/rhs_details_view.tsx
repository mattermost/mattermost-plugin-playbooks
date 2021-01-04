// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';

import {IncidentFetchState, useCurrentIncident} from 'src/hooks';
import {RHSContainer, RHSContent} from 'src/components/rhs/rhs_shared';
import Spinner from 'src/components/assets/icons/spinner';
import RHSTabView from 'src/components/rhs/rhs_tab_view';
import {RHSTabState} from 'src/types/rhs';
import {currentRHSTabState} from 'src/selectors';
import RHSIncidentSummary from 'src/components/rhs/rhs_incident_summary';
import RHSIncidentTasks from 'src/components/rhs/rhs_incident_tasks';
import RHSFooterSummary from 'src/components/rhs/rhs_footer_summary';

const RHSDetailsView = () => {
    const [incident, incidentFetchState] = useCurrentIncident();
    const currentTabState = useSelector<GlobalState, RHSTabState>(currentRHSTabState);

    if (incidentFetchState === IncidentFetchState.Loading) {
        return spinner;
    } else if (incidentFetchState === IncidentFetchState.NotFound || incident === null) {
        // This should not happen--if incident is not found or null, we should be viewing the list.
        // Returning the spinner so that if it ever happens, we at least show something.
        return spinner;
    }

    let currentView = <RHSIncidentSummary incident={incident}/>;
    if (currentTabState === RHSTabState.ViewingTasks) {
        currentView = <RHSIncidentTasks incident={incident}/>;
    }

    return (
        <RHSContainer>
            <RHSContent>
                <RHSTabView/>
                {currentView}
                <RHSFooterSummary/>
            </RHSContent>
        </RHSContainer>
    );
};

export const SpinnerContainer = styled.div`
    text-align: center;
    padding: 20px;
`;

const spinner = (
    <RHSContainer>
        <RHSContent>
            <SpinnerContainer>
                <Spinner/>
                <span>{'Loading...'}</span>
            </SpinnerContainer>
        </RHSContent>
    </RHSContainer>
);

export default RHSDetailsView;
