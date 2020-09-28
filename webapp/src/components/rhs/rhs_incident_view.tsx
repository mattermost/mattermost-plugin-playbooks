// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    RHSContainer,
    RHSContent,
    SpinnerContainer,
} from 'src/components/rhs/rhs_shared_styled_components';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import Spinner from 'src/components/assets/icons/spinner';
import RHSIncidentDetails from 'src/components/rhs/incident_details';
import {CurrentIncidentState, useCurrentIncident} from 'src/hooks';

const RHSIncidentView = () => {
    const [incident, incidentState] = useCurrentIncident();

    if (incidentState === CurrentIncidentState.Loading) {
        return (
            <RHSContainer>
                <RHSContent>
                    <SpinnerContainer>
                        <Spinner/>
                        <span>{'Loading...'}</span>
                    </SpinnerContainer>
                </RHSContent>
            </RHSContainer>
        );
    } else if (incident === null || incidentState === CurrentIncidentState.NotFound) {
        return <RHSWelcomeView/>;
    }

    return (
        <RHSContainer>
            <RHSContent>
                <RHSIncidentDetails
                    incident={incident}
                />
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSIncidentView;
