// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, FC} from 'react';
import {Switch, Route, NavLink, useRouteMatch, Redirect} from 'react-router-dom';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import styled from 'styled-components';

import BackstageIncidentList from 'src/components/backstage/incidents/incident_list/incident_list';
import PlaybookList from 'src/components/backstage/playbook/playbook_list';
import PlaybookEdit from 'src/components/backstage/playbook/playbook_edit';
import {ErrorPageTypes} from 'src/constants';

import {navigateToUrl, navigateToTeamPluginUrl, teamPluginErrorUrl} from 'src/browser_routing';

import Waves from '../assets/waves';
import PlaybookIcon from '../assets/icons/playbook_icon';
import WorkflowsIcon from '../assets/icons/workflows_icon';

const BackstageContainer = styled.div`
    overflow: hidden;
    background: var(--center-channel-bg);
    display: flex;
    flex-direction: column;
    height: 100%;
`;

const Icon = styled.i`
    font-size: 18px;
    cursor: pointer;

    &:hover {
        text-decoration: unset;
        color: var(--button-bg);
        fill: var(--button-bg);
    }
`;

const BackstageNavbar = styled.div`
    display: flex;
    align-items: center;
    height: 80px;
    padding: 24px 30px 24px 30px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-family: 'compass-icons';
    box-shadow: 0px 1px 0px var(--center-channel-color-16);

    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 600;
`;

const BackstageTitlebarItem = styled(NavLink)`
    && {
        cursor: pointer;
        color: var(--center-channel-color);
        fill: var(--center-channel-color);
        padding: 8px;
        margin-left: 28px;
        display: flex;
        align-items: center;

        &:hover {
            text-decoration: unset;
            color: var(--button-bg);
            fill: var(--button-bg);
        }

        &.active {
            color: var(--button-bg);
            fill: var(--button-bg);
            text-decoration: unset;
        }
    }
`;

const BackstageBody = styled.div`
    z-index: 1;
    width: 100%;
    overflow: auto;
    margin: 0 auto;
`;

const Backstage: FC = () => {
    useEffect(() => {
        // This class, critical for all the styling to work, is added by ChannelController,
        // which is not loaded when rendering this root component.
        document.body.classList.add('app__body');

        return function cleanUp() {
            document.body.classList.remove('app__body');
        };
    }, []);

    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const match = useRouteMatch();

    const goToMattermost = () => {
        navigateToUrl(`/${currentTeam.name}`);
    };

    const goToPlaybooks = () => {
        navigateToTeamPluginUrl(currentTeam.name, '/playbooks');
    };

    return (
        <BackstageContainer>
            <BackstageNavbar>
                <Icon
                    className='icon-arrow-back-ios back-icon'
                    onClick={goToMattermost}
                />
                <BackstageTitlebarItem
                    to={`${match.url}/incidents`}
                    activeClassName={'active'}
                >
                    <WorkflowsIcon/>
                    <i className='mr-2'/>
                    {'Workflows'}
                </BackstageTitlebarItem>
                <BackstageTitlebarItem
                    to={`${match.url}/playbooks`}
                    activeClassName={'active'}
                >
                    <PlaybookIcon/>
                    <i className='mr-2'/>
                    {'Playbooks'}
                </BackstageTitlebarItem>
            </BackstageNavbar>
            <BackstageBody>
                <Switch>
                    <Route path={`${match.url}/playbooks/new`}>
                        <PlaybookEdit
                            isNew={true}
                            currentTeam={currentTeam}
                            onClose={goToPlaybooks}
                        />
                    </Route>
                    <Route path={`${match.url}/playbooks/:playbookId`}>
                        <PlaybookEdit
                            isNew={false}
                            currentTeam={currentTeam}
                            onClose={goToPlaybooks}
                        />
                    </Route>
                    <Route path={`${match.url}/playbooks`}>
                        <PlaybookList/>
                    </Route>
                    <Route path={`${match.url}/incidents`}>
                        <BackstageIncidentList/>
                    </Route>
                    <Route>
                        <Redirect to={teamPluginErrorUrl(currentTeam.name, ErrorPageTypes.DEFAULT)}/>
                    </Route>
                </Switch>
            </BackstageBody>
        </BackstageContainer>
    );
};

export default Backstage;
