// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {RHSContainer, RHSContent} from 'src/components/rhs/rhs_shared';
import RHSTabView from 'src/components/rhs/rhs_tab_view';
import {RHSTabState} from 'src/types/rhs';
import {currentIncident, currentRHSTabState} from 'src/selectors';
import RHSAbout from 'src/components/rhs/rhs_about';
import RHSIncidentTasks from 'src/components/rhs/rhs_incident_tasks';
import RHSFooter from 'src/components/rhs/rhs_footer';
import {Incident} from 'src/types/incident';
import RHSTimeline from 'src/components/rhs/rhs_timeline';

const RHSDetailsView = () => {
    const incident = useSelector<GlobalState, Incident | undefined>(currentIncident);
    const currentTabState = useSelector<GlobalState, RHSTabState>(currentRHSTabState);

    if (!incident) {
        return null;
    }

    let currentView;
    switch (currentTabState) {
    case RHSTabState.ViewingAbout:
        currentView = <RHSAbout incident={incident}/>;
        break;
    case RHSTabState.ViewingTasks:
        currentView = <RHSIncidentTasks incident={incident}/>;
        break;
    case RHSTabState.ViewingTimeline:
        currentView = <RHSTimeline incident={incident}/>;
        break;
    }

    return (
        <RHSContainer>
            <RHSContent>
                <RHSTabView/>
                {currentView}
                <RHSFooter incident={incident}/>
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSDetailsView;
