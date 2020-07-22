// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, FC} from 'react';
import {Switch, Route, NavLink, useRouteMatch, Redirect} from 'react-router-dom';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';

import BackstageIncidentList from 'src/components/backstage/incidents/incident_list/incident_list';
import BackstageIncidentDetails
    from 'src/components/backstage/incidents/incident_details/incident_details';
import PlaybookList from 'src/components/backstage/playbook/playbook_list';
import PlaybookEdit from 'src/components/backstage/playbook/playbook_edit';
import {ErrorPageTypes} from 'src/constants';

import {navigateToUrl, navigateToTeamPluginUrl, teamPluginErrorUrl} from 'src/browser_routing';

import Waves from '../assets/waves';

const BackstageContainer = styled.div`
    overflow: hidden;
    background: var(--center-channel-bg);
`;

const BackstageSidebar = styled.div`
    position: absolute;
    height: 100vh;
    width: 32rem;
    font-size: 16px;
    line-height: 24px;
    background: var(--sidebar-bg);
    color: var(--sidebar-text);
`;

const BackstageSidebarHeader = styled.div`
    padding: 32px 0px 0px 32px;
    cursor: pointer;
`;

const BackstageSidebarMenu = styled.div`
    padding: 4rem 0 0 2.4rem;
    width: 100%;
    font-weight: 600;
`;

const SidebarNavLink = styled(NavLink)`
    &&& {
        display: block;
        border-radius: 4px 0 0 4px;
        height: 48px;
        padding-left: 1.6rem;
        line-height: 48px;
        opacity: 0.56;
        color: var(--sidebar-text);

        &:hover {
            opacity: 1;
            cursor: pointer;
        }

        &.active {
            background: var(--center-channel-bg);
            color: var(--center-channel-color);
            opacity: 1;

            &:hover {
                cursor: default;
            }
        }
    }
`;

const BackstageBody = styled.div`
    position: relative;
    z-index: 1;
    margin-left: 32rem;
    width: calc(100% - 32rem);
    overflow: auto;
    height: 100vh;
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
            <BackstageSidebar>
                <BackstageSidebarHeader
                    onClick={goToMattermost}
                >
                    <i className='icon-arrow-left mr-2 back-icon'/>
                    {'Back to Mattermost'}
                </BackstageSidebarHeader>
                <BackstageSidebarMenu>
                    <SidebarNavLink
                        data-testid='incidentsLHSButton'
                        to={`${match.url}/incidents`}
                        activeClassName={'active'}
                    >
                        {'Incidents'}
                    </SidebarNavLink>
                    <SidebarNavLink
                        data-testid='playbooksLHSButton'
                        to={`${match.url}/playbooks`}
                        activeClassName={'active'}
                    >
                        {'Playbooks'}
                    </SidebarNavLink>
                </BackstageSidebarMenu>
            </BackstageSidebar>
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
            <Waves/>
        </BackstageContainer>
    );
};

export default Backstage;
