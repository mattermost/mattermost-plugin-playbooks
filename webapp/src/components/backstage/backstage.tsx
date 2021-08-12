// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {Switch, Route, NavLink, useRouteMatch, Redirect} from 'react-router-dom';
import {useSelector} from 'react-redux';

import styled from 'styled-components';
import Icon from '@mdi/react';
import {mdiThumbsUpDown, mdiClipboardPlayMultipleOutline} from '@mdi/js';

import {GlobalState} from 'mattermost-redux/types/store';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';
import {Theme} from 'mattermost-redux/types/preferences';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import IncidentIcon from 'src/components/assets/icons/incident_icon';
import {promptForFeedback} from 'src/client';

import PlaybookRunBackstage
    from 'src/components/backstage/playbook_runs/playbook_run_backstage/playbook_run_backstage';

import BackstagePlaybookRunList from 'src/components/backstage/playbook_runs/playbook_run_list/playbook_run_list';

import PlaybookList from 'src/components/backstage/playbook_list';
import PlaybookEdit from 'src/components/backstage/playbook_edit';
import {NewPlaybook} from 'src/components/backstage/new_playbook';
import {ErrorPageTypes} from 'src/constants';
import {navigateToUrl, pluginErrorUrl} from 'src/browser_routing';
import PlaybookIcon from 'src/components/assets/icons/playbook_icon';

import PlaybookBackstage from 'src/components/backstage/playbooks/playbook_backstage';
import {useExperimentalFeaturesEnabled, useForceDocumentTitle} from 'src/hooks';
import CloudModal from 'src/components/cloud_modal';

import ErrorPage from '../error_page';

import SettingsView from './settings';
import {BackstageNavbar, BackstageNavbarIcon} from './backstage_navbar';

import {applyTheme} from './css_utils';

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
        const root = document.getElementById('root');
        if (root) {
            root.className += ' channel-view';
        }

        applyTheme(currentTheme);
        return function cleanUp() {
            document.body.classList.remove('app__body');
        };
    }, []);

    useForceDocumentTitle('Playbooks');

    const currentTheme = useSelector<GlobalState, Theme>(getTheme);
    const teams = useSelector<GlobalState, Team[]>(getMyTeams);

    const match = useRouteMatch();

    const goToMattermost = () => {
        navigateToUrl('');
    };

    const experimentalFeaturesEnabled = useExperimentalFeaturesEnabled();

    return (
        <BackstageContainer>
            <BackstageNavbar className='flex justify-content-between'>
                <div className='d-flex items-center'>
                    <BackstageTitlebarItem
                        to={`${match.url}/runs`}
                        activeClassName={'active'}
                        data-testid='playbookRunsLHSButton'
                    >
                        <span className='mr-3 d-flex items-center'>
                            <Icon
                                path={mdiClipboardPlayMultipleOutline}
                                title='Runs'
                                size={1.4}
                            />
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
                            to={`/${teams[0].name}/messages/@surveybot`}
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
                        <NewPlaybook/>
                    </Route>
                    <Route path={`${match.url}/playbooks/:playbookId/edit/:tabId?`}>
                        <PlaybookEdit
                            isNew={false}
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
                    <Route path={`${match.url}/settings`}>
                        <SettingsView/>
                    </Route>
                    <Route path={`${match.url}/error`}>
                        <ErrorPage/>
                    </Route>
                    <Route
                        exact={true}
                        path={`${match.url}/`}
                    >
                        <Redirect to={`${match.url}/runs`}/>
                    </Route>
                    <Route>
                        <Redirect to={pluginErrorUrl(ErrorPageTypes.DEFAULT)}/>
                    </Route>
                </Switch>
            </BackstageBody>
            <CloudModal/>
        </BackstageContainer>
    );
};

export default Backstage;
