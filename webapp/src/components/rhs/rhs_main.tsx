// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';

import {Team} from 'mattermost-redux/types/teams';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {setRHSOpen, startIncident} from 'src/actions';
import Spinner from 'src/components/assets/icons/spinner';
import {CurrentIncidentState, useCurrentIncident} from 'src/hooks';
import {clientHasPlaybooks} from 'src/client';

import {navigateToTeamPluginUrl} from 'src/browser_routing';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';

import NoContentPlaybookSvgRhs from '../assets/no_content_playbooks_rhs_svg';

import RHSIncidentDetails from './incident_details';

// @ts-ignore
/* const {formatText, messageHtmlToComponent} = window.PostUtils; */

const RHSContainer = styled.div`
    height: calc(100vh - 120px);
    display: flex;
    flex-direction: column;
    position: relative;
`;

const RHSContent = styled.div`
    flex: 1 1 auto;
    position: relative;
`;

const SpinnerContainer = styled.div`
    text-align: center;
    padding: 20px;
`;

const StyledSpinner = styled(Spinner)`
    margin-right: 4px;
`;

const NoIncidentsContainer = styled.div`
    margin: 48px 40px 0;
    display: block;
    flex-direction: column;
    align-items: center;

    h1 {
        margin: 0;
        font-size: 24px;
        font-weight: bold;
        text-align: left;
        line-height: 32px;
    }
`;

const NoIncidentsItem = styled.div`
    margin-bottom: 24px;
`;

const RightHandSidebar: FC<null> = () => {
    const dispatch = useDispatch();
    const [incident, incidentState] = useCurrentIncident();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const [hasPlaybooks, setHasPlaybooks] = useState<boolean>(false);

    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);
    useEffect(() => {
        const fetchData = async () => {
            const result = await clientHasPlaybooks(currentTeam.id) as boolean;
            setHasPlaybooks(result);
        };
        fetchData();
    }, [currentTeam.id]);

    if (incidentState === CurrentIncidentState.Loading) {
        return (
            <RHSContainer>
                <RHSContent>
                    <SpinnerContainer>
                        <StyledSpinner/>
                        <span>{'Loading...'}</span>
                    </SpinnerContainer>
                </RHSContent>
            </RHSContainer>
        );
    } else if (incident === null || incidentState === CurrentIncidentState.NotFound) {
        if (hasPlaybooks) {
            return (
                <RHSContainer>
                    <NoIncidentsContainer>
                        <NoContentPlaybookSvgRhs/>
                        <NoIncidentsItem>
                            <h1>
                                {'Start taking action now with Incident Response.'}
                            </h1>
                            <p className='mt-3 mb-8 light'>
                                {'You do not have any incidents created yet. Create an incident now.'}
                            </p>
                            <div className='header-button-div mb-4'>
                                <PrimaryButton
                                    onClick={() => dispatch(startIncident())}
                                >
                                    <span>
                                        <i className='icon-plus icon--no-spacing mr-2'/>
                                        {'Start Incident'}
                                    </span>
                                </PrimaryButton>
                            </div>
                            <TertiaryButton
                                onClick={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks')}
                            >
                                {'Create Playbook'}
                            </TertiaryButton>
                        </NoIncidentsItem>
                    </NoIncidentsContainer>
                </RHSContainer>
            );
        }

        return (
            <RHSContainer>
                <NoIncidentsContainer>
                    <NoContentPlaybookSvgRhs/>
                    <NoIncidentsItem>
                        <h1>
                            {'Simplify your processes with Incident Response'}
                        </h1>
                        <p className='mt-3 mb-8 light'>
                            {'Create a playbook to define your incident response workflow. Select a template or create your playbook from scratch.'}
                        </p>
                        <div className='header-button-div mb-4'>
                            <PrimaryButton
                                onClick={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks')}
                            >
                                {'Create Playbook'}
                            </PrimaryButton>
                        </div>
                    </NoIncidentsItem>
                </NoIncidentsContainer>
            </RHSContainer>
        );
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
