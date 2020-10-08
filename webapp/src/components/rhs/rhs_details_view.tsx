// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {IncidentFetchState, useCurrentIncident} from 'src/hooks';
import {RHSContainer, RHSContent} from 'src/components/rhs/rhs_shared';
import Spinner from 'src/components/assets/icons/spinner';
import RHSIncidentDetails from 'src/components/rhs/incident_details';

const RHSDetailsView = () => {
    const [incident, incidentFetchState] = useCurrentIncident();

    if (incidentFetchState === IncidentFetchState.Loading) {
        return spinner;
    } else if (incidentFetchState === IncidentFetchState.NotFound || incident === null) {
        // This should not happen--if incident is not found or null, we should be viewing the list.
        // Returning the spinner so that if it ever happens, we at least show something.
        return spinner;
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
