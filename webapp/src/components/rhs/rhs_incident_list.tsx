// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import Spinner from 'src/components/assets/icons/spinner';
import {
    RHSContainer,
    RHSContent,
    SpinnerContainer,
} from 'src/components/rhs/rhs_shared_styled_components';
import {CurrentIncidentListState, useCurrentIncidentList} from 'src/hooks';

const Title = styled.div`
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
    letter-spacing: 0;
    text-align: left;
`;

const RHSListView = () => {
    const [incidents, incidentsState] = useCurrentIncidentList();

    if (incidentsState === CurrentIncidentListState.Loading) {
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
    } else if (incidents === null || incidentsState === CurrentIncidentListState.NotFound) {
        return <RHSWelcomeView/>;
    }

    return (
        <RHSContainer>
            <RHSContent>
                {incidents.map((incident) => {
                    return <Title key={incident.id}>{incident.name}</Title>;
                })}
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSListView;
