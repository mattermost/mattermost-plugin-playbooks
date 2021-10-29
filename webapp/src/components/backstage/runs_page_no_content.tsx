// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {Team} from 'mattermost-redux/types/teams';

import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {FormattedMessage} from 'react-intl';

import NoContentPlaybookRunSvg from 'src/components/assets/no_content_playbook_runs_svg';
import {startPlaybookRun} from 'src/actions';
import {navigateToUrl} from 'src/browser_routing';

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
    const teams = useSelector<GlobalState, Team[]>(getMyTeams);

    const goToMattermost = () => {
        navigateToUrl('');
    };

    const newPlaybookRun = () => {
        goToMattermost();
        dispatch(startPlaybookRun(teams[0].id));
    };

    return (
        <NoContentContainer>
            <NoContentTextContainer>
                <NoContentTitle><FormattedMessage defaultMessage='What are playbook runs?'/></NoContentTitle>
                <NoContentDescription><FormattedMessage defaultMessage='Running a playbook orchestrates workflows for your team and tools.'/></NoContentDescription>
                <NoContentButton
                    className='mt-6'
                    onClick={newPlaybookRun}
                >
                    <i className='icon-plus mr-2'/>
                    <FormattedMessage defaultMessage='Run playbook'/>
                </NoContentButton>
            </NoContentTextContainer>
            <NoContentPlaybookRunSvgContainer>
                <NoContentPlaybookRunSvg/>
            </NoContentPlaybookRunSvgContainer>
        </NoContentContainer>
    );
};

export default NoContentPage;
