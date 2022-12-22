// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {useDispatch, useSelector} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {Playbook} from 'src/types/playbook';

import NoContentPlaybookRunSvg from 'src/components/assets/no_content_playbook_runs_svg';
import {startPlaybookRun} from 'src/actions';
import {navigateToUrl} from 'src/browser_routing';
import {useCanCreatePlaybooksInTeam, usePlaybooksCrud, usePlaybooksRouting} from 'src/hooks';

import {clientHasPlaybooks} from 'src/client';

const NoContentContainer = styled.div`
    display: flex;
    flex-direction: row;
    margin: 0 10vw;
    height: 100%;
    align-items: center;
`;

const NoContentTextContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0 20px;
`;

const NoContentTitle = styled.h2`
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 28px;
    color: var(--center-channel-color);
    text-align: left;
`;

const NoContentDescription = styled.h5`
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 16px;
    line-height: 24px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    text-align: left;
`;

const NoContentButton = styled.button`
    display: inline-flex;
    background: var(--button-bg);
    color: var(--button-color);
    border-radius: 4px;
    border: 0px;
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 16px;
    line-height: 18px;
    align-items: center;
    padding: 14px 24px;
    transition: all 0.15s ease-out;
    align-self: center;
    &:hover {
        opacity: 0.8;
    }
    &:active  {
        background: rgba(var(--button-bg-rgb), 0.8);
    }
    i {
        font-size: 24px;
    }
`;

const NoContentPlaybookRunSvgContainer = styled.div`
    @media (max-width: 1000px) {
        display: none;
    }
`;

const NoContentPage = () => {
    const dispatch = useDispatch();
    const teamId = useSelector(getCurrentTeamId);
    const [playbookExist, setPlaybookExist] = useState(false);
    const {setSelectedPlaybook} = usePlaybooksCrud({team_id: '', per_page: BACKSTAGE_LIST_PER_PAGE});
    const {create} = usePlaybooksRouting<Playbook>({onGo: setSelectedPlaybook});
    const canCreatePlaybooks = useCanCreatePlaybooksInTeam(teamId);

    // When the component is first mounted, determine if there are any
    // playbooks at all.If yes show Run playbook else create playbook
    useEffect(() => {
        async function checkForPlaybook() {
            const returnedPlaybookExist = await clientHasPlaybooks(teamId);
            setPlaybookExist(returnedPlaybookExist);
        }
        checkForPlaybook();
    }, [teamId]);

    const goToMattermost = () => {
        navigateToUrl('');
    };
    const handleClick = () => {
        if (playbookExist) {
            goToMattermost();
            dispatch(startPlaybookRun(teamId));
        } else {
            create({teamId});
        }
    };
    return (
        <NoContentContainer>
            <NoContentTextContainer>
                <NoContentTitle><FormattedMessage defaultMessage='What are playbook runs?'/></NoContentTitle>
                <NoContentDescription><FormattedMessage defaultMessage='Running a playbook orchestrates workflows for your team and tools.'/></NoContentDescription>
                {(canCreatePlaybooks || playbookExist) &&
                <NoContentButton
                    className='mt-6'
                    onClick={handleClick}
                >
                    <i className='icon-plus mr-2'/>
                    {playbookExist ? <FormattedMessage defaultMessage='Run playbook'/> : <FormattedMessage defaultMessage='Create playbook'/>}
                </NoContentButton>
                }
            </NoContentTextContainer>
            <NoContentPlaybookRunSvgContainer>
                <NoContentPlaybookRunSvg/>
            </NoContentPlaybookRunSvgContainer>
        </NoContentContainer>
    );
};

export default NoContentPage;
