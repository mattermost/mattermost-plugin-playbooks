// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, FC} from 'react';
import {Switch, Route, NavLink, useRouteMatch, Redirect} from 'react-router-dom';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';

import PlaybookList from 'src/components/backstage/playbook_list';
import PlaybookEdit from 'src/components/backstage/playbook_edit';
import BackstageIncidentList from 'src/components/backstage/incidents/incident_list/incident_list';
import BackstageIncidentDetails from 'src/components/backstage/incidents/incident_details/incident_details';

import {ErrorPageTypes} from 'src/constants';

import {navigateToUrl, navigateToTeamPluginUrl, teamPluginErrorUrl} from 'src/browser_routing';

import PlaybookIcon from '../assets/icons/playbook_icon';
import IncidentIcon from '../assets/icons/incident_icon';
import RightDots from '../assets/right_dots';
import LeftDots from '../assets/left_dots';

const RightFade = styled.div`
    position: absolute;
    top: 85px;
    right: 0;
    height: 100%;
    width: 188px;
    z-index: 0;
    background: linear-gradient(270deg, var(--center-channel-bg),transparent 60%);
    pointer-events: none;
`;

const LeftFade = styled.div`
    position: absolute;
    width: 176px;
    top: 85px;
    left: 0;
    height: 100%;
    background: linear-gradient(90deg, var(--center-channel-bg) 0%, rgba(255, 255, 255, 0) 94.89%);
    pointer-events: none;
`;

const BackstageContainer = styled.div`
    overflow: hidden;
    background: var(--center-channel-bg);
    display: flex;
    flex-direction: column;
    height: 100%;
`;

export const BackstageNavbarBackIcon = styled.i`
    font-size: 18px;
    cursor: pointer;

    &:hover {
        text-decoration: unset;
        color: var(--button-bg);
        fill: var(--button-bg);
    }
`;

export const BackstageNavbar = styled.div`
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
    height: 100%;
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
            <Switch>
                <Route path={`${match.url}/playbooks/*`}/>
                <Route>
                    <BackstageNavbar>
                        <BackstageNavbarBackIcon
                            className='icon-arrow-back-ios back-icon'
                            onClick={goToMattermost}
                        />
                        <BackstageTitlebarItem
                            to={`${match.url}/incidents`}
                            activeClassName={'active'}
                            data-testid='incidentsLHSButton'
                        >
                            <IncidentIcon/>
                            <i className='mr-2'/>
                            {'Incidents'}
                        </BackstageTitlebarItem>
                        <BackstageTitlebarItem
                            to={`${match.url}/playbooks`}
                            activeClassName={'active'}
                            data-testid='playbooksLHSButton'
                        >
                            <PlaybookIcon/>
                            <i className='mr-2'/>
                            {'Playbooks'}
                        </BackstageTitlebarItem>
                    </BackstageNavbar>
                </Route>
            </Switch>
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
                    <Route path={`${match.url}/incidents/:incidentId`}>
                        <BackstageIncidentDetails/>
                    </Route>
                    <Route path={`${match.url}/incidents`}>
                        <BackstageIncidentList/>
                    </Route>
                    <Route>
                        <Redirect to={teamPluginErrorUrl(currentTeam.name, ErrorPageTypes.DEFAULT)}/>
                    </Route>
                </Switch>
            </BackstageBody>
            <RightDots/>
            <RightFade/>
            <LeftDots/>
            <LeftFade/>
        </BackstageContainer>
    );
};

export default Backstage;
