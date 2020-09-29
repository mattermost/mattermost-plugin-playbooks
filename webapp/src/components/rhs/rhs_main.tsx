// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';

import {setRHSOpen, setRHSState, startIncident} from 'src/actions';
import Spinner from 'src/components/assets/icons/spinner';
import RHSIncidentDetails from 'src/components/rhs/incident_details';
import RHSListView from 'src/components/rhs/rhs_list_view';
import {RHSContainer, RHSContent} from 'src/components/rhs/rhs_shared';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import {
    IncidentFetchState,
    ListFetchState,
    useCurrentIncident,
    useCurrentIncidentList,
} from 'src/hooks';
import {currentRHSState} from 'src/selectors';
import {RHSState} from 'src/types/rhs';

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

const RightHandSidebar: FC<null> = () => {
    const dispatch = useDispatch();
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);

    // Only get the current incident, and incidentList at the top of the rhs hierarchy.
    // This prevents race conditions.
    const [incident, incidentFetchState] = useCurrentIncident();
    const [incidentList, listFetchState] = useCurrentIncidentList();

    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);

    if (rhsState === RHSState.ViewingList) {
        if (listFetchState === ListFetchState.Loading) {
            return spinner;
        } else if (listFetchState === ListFetchState.NotFound) {
            return <RHSWelcomeView/>;
        }
        return (
            <RHSContainer>
                <RHSContent>
                    <RHSListView
                        incidentList={incidentList}
                        currentIncidentId={incident?.id}
                    />
                </RHSContent>
            </RHSContainer>
        );
    }

    if (incidentFetchState === IncidentFetchState.Loading) {
        return spinner;
    } else if (incidentFetchState === IncidentFetchState.NotFound || incident === null) {
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

export default RightHandSidebar;
