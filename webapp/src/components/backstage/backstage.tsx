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

const BackstageContainer = styled.div`
    overflow: hidden;
    background: var(--center-channel-bg);
    display: flex;
    flex-direction: column;
    height: 100%;
`;

export const BackstageNavbarIcon = styled.button`
    border: none;
    outline: none;
    background: transparent;
    border-radius: 4px;
    font-size: 24px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--center-channel-color-56);

    &:hover {
        background: var(--button-bg-08);
        text-decoration: unset;
        color: var(--button-bg);
    }
`;

export const BackstageNavbar = styled.div`
    display: flex;
    align-items: center;
    height: 80px;
    padding: 28px 31px;
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
        font-size: 16px;
        cursor: pointer;
        color: var(--center-channel-color);
        fill: var(--center-channel-color);
        padding: 8px;
        margin-right: 39px;
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
                <Route path={`${match.url}/incidents/*`}/>
                <Route>
                    <BackstageNavbar className='flex justify-content-between'>
                        <div className='d-flex items-center'>
                            <BackstageTitlebarItem
                                to={`${match.url}/playbooks`}
                                activeClassName={'active'}
                                data-testid='playbooksLHSButton'
                            >
                                <span className='mr-3 d-flex items-center'>
                                    <PlaybookIcon/>
                                </span>
                                {'Playbooks'}
                            </BackstageTitlebarItem>
                            <BackstageTitlebarItem
                                to={`${match.url}/incidents`}
                                activeClassName={'active'}
                                data-testid='incidentsLHSButton'
                            >
                                <span className='mr-3 d-flex items-center'>
                                    <IncidentIcon/>
                                </span>
                                {'Incidents'}
                            </BackstageTitlebarItem>
                        </div>
                        <BackstageNavbarIcon
                            className='icon-close close-icon'
                            onClick={goToMattermost}
                        />
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
        </BackstageContainer>
    );
};

export default Backstage;
