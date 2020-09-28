// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import {setRHSState} from 'src/actions';
import {navigateToUrl} from 'src/browser_routing';
import Spinner from 'src/components/assets/icons/spinner';
import {
    RHSContainer,
    RHSContent,
    SpinnerContainer,
} from 'src/components/rhs/rhs_shared_styled_components';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import {CurrentIncidentListState, useCurrentIncidentList} from 'src/hooks';
import {RHSState} from 'src/types/rhs';

const IncidentContainer = styled.div`
    cursor: pointer;
`;

const Title = styled.div`
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
    letter-spacing: 0;
    text-align: left;
`;

const RHSListView = () => {
    const dispatch = useDispatch();
    const [incidents, incidentsState] = useCurrentIncidentList();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const viewIncident = (channelId: string) => {
        navigateToUrl(`/${currentTeam.name}/channels/${channelId}`);
        dispatch(setRHSState(RHSState.ViewingIncident));
    };

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
                    return (
                        <IncidentContainer key={incident.id}>
                            <Title
                                onClick={() => viewIncident(incident.channel_id)}
                            >
                                {incident.name}
                            </Title>
                        </IncidentContainer>
                    );
                })}
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSListView;
