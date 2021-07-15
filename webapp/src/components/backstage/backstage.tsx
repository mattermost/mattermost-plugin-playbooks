// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {Switch, Route, NavLink, useRouteMatch, Redirect} from 'react-router-dom';
import {useSelector} from 'react-redux';

import styled from 'styled-components';
import Icon from '@mdi/react';
import {mdiThumbsUpDown} from '@mdi/js';

import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';

import IncidentIcon from 'src/components/assets/icons/incident_icon';
import {promptForFeedback} from 'src/client';

import PlaybookRunBackstage
    from 'src/components/backstage/playbook_runs/playbook_run_backstage/playbook_run_backstage';

import BackstagePlaybookRunList from 'src/components/backstage/playbook_runs/playbook_run_list/playbook_run_list';

import PlaybookList from 'src/components/backstage/playbook_list';
import PlaybookEdit from 'src/components/backstage/playbook_edit';
import {NewPlaybook} from 'src/components/backstage/new_playbook';
import {ErrorPageTypes} from 'src/constants';
import {navigateToUrl, teamPluginErrorUrl} from 'src/browser_routing';
import PlaybookIcon from 'src/components/assets/icons/playbook_icon';

import PlaybookBackstage from 'src/components/backstage/playbooks/playbook_backstage';
import {useExperimentalFeaturesEnabled} from 'src/hooks';
import CloudModal from 'src/components/cloud_modal';

import StatsView from './stats';
import SettingsView from './settings';
import {BackstageNavbar, BackstageNavbarIcon} from './backstage_navbar';

const BackstageContainer = styled.div`
    background: var(--center-channel-bg);
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
`;

const BackstageTitlebarItem = styled(NavLink)`
    && {
        font-size: 16px;
        cursor: pointer;
        color: var(--center-channel-color);
        fill: var(--center-channel-color);
        padding: 0 8px;
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
    flex-grow: 1;
`;

const Backstage = () => {
    //@ts-ignore plugins state is a thing
    const npsAvailable = useSelector<GlobalState, boolean>((state) => Boolean(state.plugins?.plugins?.['com.mattermost.nps']));
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

    const experimentalFeaturesEnabled = useExperimentalFeaturesEnabled();

    return (
        <BackstageContainer>
            <BackstageNavbar className='flex justify-content-between'>
                <div className='d-flex items-center'>
                    {experimentalFeaturesEnabled &&
                        <BackstageTitlebarItem
                            to={`${match.url}/stats`}
                            activeClassName={'active'}
                            data-testid='statsLHSButton'
                        >
                            <span className='mr-3 d-flex items-center'>
                                <div className={'fa fa-line-chart'}/>
                            </span>
                            {'Stats'}
                        </BackstageTitlebarItem>
                    }
                    <BackstageTitlebarItem
                        to={`${match.url}/runs`}
                        activeClassName={'active'}
                        data-testid='playbookRunsLHSButton'
                    >
                        <span className='mr-3 d-flex items-center'>
                            <IncidentIcon/>
                        </span>
                        {'Runs'}
                    </BackstageTitlebarItem>
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
                        to={`${match.url}/settings`}
                        activeClassName={'active'}
                        data-testid='settingsLHSButton'
                    >
                        <span className='mr-3 d-flex items-center'>
                            <div className={'fa fa-gear'}/>
                        </span>
                        {'Settings'}
                    </BackstageTitlebarItem>
                </div>
                <div className='d-flex items-center'>
                    {npsAvailable &&
                        <BackstageTitlebarItem
                            onClick={promptForFeedback}
                            to={`/${currentTeam.name}/messages/@surveybot`}
                            data-testid='giveFeedbackButton'
                        >
                            <span className='mr-3 d-flex items-center'>
                                <Icon
                                    path={mdiThumbsUpDown}
                                    title='Give Feedback'
                                    size={1}
                                />
                            </span>
                            {'Give Feedback'}
                        </BackstageTitlebarItem>
                    }
                    <BackstageNavbarIcon
                        className='icon-close close-icon'
                        onClick={goToMattermost}
                    />
                </div>
            </BackstageNavbar>
            <BackstageBody>
                <Switch>
                    <Route path={`${match.url}/playbooks/new`}>
                        <NewPlaybook
                            currentTeam={currentTeam}
                        />
                    </Route>
                    <Route path={`${match.url}/playbooks/:playbookId/edit/:tabId?`}>
                        <PlaybookEdit
                            isNew={false}
                            currentTeam={currentTeam}
                        />
                    </Route>
                    <Route path={`${match.url}/playbooks/:playbookId`}>
                        <PlaybookBackstage/>
                    </Route>
                    <Route path={`${match.url}/playbooks`}>
                        <PlaybookList/>
                    </Route>
                    <Redirect
                        from={`${match.url}/incidents/:playbookRunId`}
                        to={`${match.url}/runs/:playbookRunId`}
                    />
                    <Route path={`${match.url}/runs/:playbookRunId`}>
                        <PlaybookRunBackstage/>
                    </Route>
                    <Redirect
                        from={`${match.url}/incidents`}
                        to={`${match.url}/runs`}
                    />
                    <Route path={`${match.url}/runs`}>
                        <BackstagePlaybookRunList/>
                    </Route>
                    <Route path={`${match.url}/stats`}>
                        <StatsView/>
                    </Route>
                    <Route path={`${match.url}/settings`}>
                        <SettingsView/>
                    </Route>
                    <Route
                        exact={true}
                        path={`${match.url}/`}
                    >
                        <Redirect to={experimentalFeaturesEnabled ? `${match.url}/stats` : `${match.url}/runs`}/>
                    </Route>
                    <Route>
                        <Redirect to={teamPluginErrorUrl(currentTeam.name, ErrorPageTypes.DEFAULT)}/>
                    </Route>
                </Switch>
            </BackstageBody>
            <CloudModal/>
        </BackstageContainer>
    );
};

export default Backstage;
