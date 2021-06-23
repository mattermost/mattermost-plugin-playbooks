// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import {startPlaybookRun} from 'src/actions';
import {navigateToTeamPluginUrl} from 'src/browser_routing';
import {clientHasPlaybooks} from 'src/client';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import NoContentPlaybookSvgRhs from 'src/components/assets/no_content_playbooks_rhs_svg';
import {RHSContainer} from 'src/components/rhs/rhs_shared';

const NoPlaybookRunsContainer = styled.div`
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

const NoPlaybookRunsItem = styled.div`
    margin-bottom: 24px;
`;

const SideBySide = styled.span`
    display: flex;
    align-items: center;
`;

const RHSWelcomeView = () => {
    const dispatch = useDispatch();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const [hasPlaybooks, setHasPlaybooks] = useState<boolean>(false);

    useEffect(() => {
        const fetchData = async () => {
            const result = await clientHasPlaybooks(currentTeam.id) as boolean;
            setHasPlaybooks(result);
        };
        fetchData();
    }, [currentTeam.id]);

    if (hasPlaybooks) {
        return (
            <RHSContainer>
                <NoPlaybookRunsContainer data-testid='welcome-view-has-playbooks'>
                    <NoContentPlaybookSvgRhs/>
                    <NoPlaybookRunsItem>
                        <h1>
                            {'Take action now using playbooks'}
                        </h1>
                        <p className='mt-3 mb-4 light'>
                            {'There are no runs in progress at the moment. Run a playbook to start orchestrating workflows for your team and tools.'}
                        </p>
                        <div className='header-button-div mb-4'>
                            <PrimaryButton
                                onClick={() => dispatch(startPlaybookRun())}
                            >
                                <SideBySide>
                                    <i className='icon-plus icon--no-spacing mr-2'/>
                                    {'Run playbook'}
                                </SideBySide>
                            </PrimaryButton>
                        </div>
                        <p className='mt-3 mb-4 light'>
                            {'You can also create a playbook ahead of time so it’s available when you need it.'}
                        </p>
                        <TertiaryButton
                            onClick={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks')}
                        >
                            {'Create playbook'}
                        </TertiaryButton>
                    </NoPlaybookRunsItem>
                </NoPlaybookRunsContainer>
            </RHSContainer>
        );
    }

    return (
        <RHSContainer>
            <NoPlaybookRunsContainer data-testid='welcome-view'>
                <NoContentPlaybookSvgRhs/>
                <NoPlaybookRunsItem>
                    <h1>
                        {'Streamline your processes with playbooks'}
                    </h1>
                    <p className='mt-3 mb-8 light'>
                        {'Create a playbook to prescribe the workflow that your teams and tools should follow, including everything from checklists, actions, templates, and retrospectives.'}
                    </p>
                    <div className='header-button-div mb-4'>
                        <PrimaryButton
                            onClick={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks')}
                        >
                            {'Create playbook'}
                        </PrimaryButton>
                    </div>
                </NoPlaybookRunsItem>
            </NoPlaybookRunsContainer>
        </RHSContainer>
    );
};

export default RHSWelcomeView;
