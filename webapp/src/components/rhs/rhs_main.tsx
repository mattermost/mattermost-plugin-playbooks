// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';

import {Team} from 'mattermost-redux/types/teams';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {setRHSOpen, startIncident} from 'src/actions';
import Spinner from 'src/components/assets/icons/spinner';
import RHSHeader from 'src/components/rhs/rhs_header';
import {CurrentIncidentState, useCurrentIncident} from 'src/hooks';

import {navigateToTeamPluginUrl} from 'src/browser_routing';

import NoContentPlaybookSvg from '../assets/no_content_playbooks_svg';

import RHSIncidentDetails from './incident_details';

// @ts-ignore
const {formatText, messageHtmlToComponent} = window.PostUtils;

interface Props {
    theme: Record<string, string>;
}

const RHSContainer = styled.div`
    height: calc(100vh - 120px);
    display: flex;
    flex-direction: column;
`;

const RHSContent = styled.div`
    flex: 1 1 auto;
    position: relative;
`;

const SpinnerContainer = styled.div`
    text-align: center;
    padding: 20px;
`;

const NoIncidentsContainer = styled.div`
    margin: 65px 50px;
    display: flex;
    flex-direction: column;
    align-items: center;
`;

const NoIncidentsItem = styled.div`
    margin-bottom: 24px;
    text-align: center;
`;

const CreatePlaybookButton = styled.button`
    font-size: 14px;
    line-height: 20px;
    color: var(--button-bg);
    border: none;
    background: none;
`;

const RightHandSidebar: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();
    const [incident, incidentState] = useCurrentIncident();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, []);

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
        return (
            <RHSContainer>
                <NoIncidentsContainer>
                    <NoIncidentsItem>{'There is no active incident in this channel.'}</NoIncidentsItem>
                    <NoIncidentsItem>
                        <div className='header-button-div'>
                            <button
                                className='btn btn-primary'
                                onClick={() => dispatch(startIncident())}
                            >
                                <i className='icon-plus mr-2'/>
                                {'Start Incident'}
                            </button>
                        </div>
                    </NoIncidentsItem>
                    <NoIncidentsItem>
                        <CreatePlaybookButton
                            onClick={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks/new')}
                        >
                            {'Create Playbook'}
                        </CreatePlaybookButton>
                    </NoIncidentsItem>
                    <NoContentPlaybookSvg/>
                </NoIncidentsContainer>
            </RHSContainer>
        );
    }

    return (
        <RHSContainer>
            <RHSHeader/>
            <RHSContent>
                <RHSIncidentDetails
                    incident={incident}
                />
            </RHSContent>
        </RHSContainer>
    );
};

export default RightHandSidebar;
