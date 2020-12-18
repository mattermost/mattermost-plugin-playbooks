// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {RHSContainer, RHSContent} from 'src/components/rhs/rhs_shared';
import RHSTabView from 'src/components/rhs/rhs_tab_view';
import {RHSTabState} from 'src/types/rhs';
import {currentIncident, currentRHSTabState} from 'src/selectors';
import RHSIncidentSummary from 'src/components/rhs/rhs_incident_summary';
import RHSIncidentTasks from 'src/components/rhs/rhs_incident_tasks';
import {Incident} from 'src/types/incident';

const RHSDetailsView = () => {
    const incident = useSelector<GlobalState, Incident | undefined>(currentIncident);
    const currentTabState = useSelector<GlobalState, RHSTabState>(currentRHSTabState);

    // This shouldn't happen, because we're only rendering this view after calling inIncidentChannel,
    // but we need to guard against the undefined that could be returned by currentIncident:
    if (!incident) {
        return <></>;
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
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSDetailsView;
